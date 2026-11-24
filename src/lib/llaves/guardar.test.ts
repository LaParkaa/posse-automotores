import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { ImagenDescargada } from "./descargar";
import { guardarImagenLlave, quitarImagenLlave } from "./guardar";

const BASE = "https://proyecto.supabase.co/storage/v1/object/public/vehiculos-posse/";
const IMAGEN: ImagenDescargada = { contentType: "image/jpeg", ext: "jpg", bytes: new Uint8Array([0xff, 0xd8, 0xff]) };

function fakeDb(opciones: { previo?: string | null; falloSubida?: boolean; falloUpdate?: boolean } = {}) {
  const subidas: Array<{ ruta: string; tipo?: string }> = [];
  const borradas: string[][] = [];
  const updates: Array<Record<string, unknown>> = [];

  const db = {
    storage: {
      from: () => ({
        upload: async (ruta: string, _bytes: Uint8Array, o?: { contentType?: string }) => {
          subidas.push({ ruta, tipo: o?.contentType });
          return opciones.falloSubida ? { error: { message: "cuota llena" } } : { error: null };
        },
        getPublicUrl: (ruta: string) => ({ data: { publicUrl: `${BASE}${ruta}` } }),
        remove: async (rutas: string[]) => {
          borradas.push(rutas);
          return { error: null };
        },
      }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: { key_image_url: opciones.previo ?? null } }) }),
      }),
      update: (campos: Record<string, unknown>) => ({
        eq: async () => {
          updates.push(campos);
          return opciones.falloUpdate ? { error: { message: "violación" } } : { error: null };
        },
      }),
    }),
  } as unknown as SupabaseClient;

  return { db, subidas, borradas, updates };
}

describe("guardarImagenLlave", () => {
  it("sube a llaves/, guarda el link público y devuelve la dirección", async () => {
    const f = fakeDb();
    const url = await guardarImagenLlave(f.db, "auto-1", IMAGEN, 1700000000000);

    expect(f.subidas).toEqual([{ ruta: "llaves/auto-1-1700000000000.jpg", tipo: "image/jpeg" }]);
    expect(url).toBe(`${BASE}llaves/auto-1-1700000000000.jpg`);
    expect(f.updates).toEqual([{ key_image_url: url }]);
    expect(f.borradas).toEqual([]);
  });

  it("borra la foto vieja de la llave cuando es de la carpeta llaves/", async () => {
    const f = fakeDb({ previo: `${BASE}llaves/auto-1-111.png` });
    await guardarImagenLlave(f.db, "auto-1", IMAGEN, 222);
    expect(f.borradas).toEqual([["llaves/auto-1-111.png"]]);
  });

  it("nunca borra una foto que no es de llaves/ (por ejemplo la portada del auto)", async () => {
    const f = fakeDb({ previo: `${BASE}portada-del-auto.jpg` });
    await guardarImagenLlave(f.db, "auto-1", IMAGEN, 222);
    expect(f.borradas).toEqual([]);
  });

  it("no toca fotos de otro sitio", async () => {
    const f = fakeDb({ previo: "https://otro.com/llave.jpg" });
    await guardarImagenLlave(f.db, "auto-1", IMAGEN, 222);
    expect(f.borradas).toEqual([]);
  });

  it("si falla la subida lanza y no toca la base", async () => {
    const f = fakeDb({ falloSubida: true });
    await expect(guardarImagenLlave(f.db, "auto-1", IMAGEN)).rejects.toThrow(/cuota llena/);
    expect(f.updates).toEqual([]);
  });

  it("si falla la base borra el archivo recién subido para no dejarlo huérfano", async () => {
    const f = fakeDb({ falloUpdate: true });
    await expect(guardarImagenLlave(f.db, "auto-1", IMAGEN, 333)).rejects.toThrow(/violación/);
    expect(f.borradas).toEqual([["llaves/auto-1-333.jpg"]]);
  });
});

describe("quitarImagenLlave", () => {
  it("deja la llave en null y borra el archivo", async () => {
    const f = fakeDb({ previo: `${BASE}llaves/auto-1-111.png` });
    await quitarImagenLlave(f.db, "auto-1");
    expect(f.updates).toEqual([{ key_image_url: null }]);
    expect(f.borradas).toEqual([["llaves/auto-1-111.png"]]);
  });

  it("si falla la base lanza y no borra el archivo", async () => {
    const f = fakeDb({ previo: `${BASE}llaves/auto-1-111.png`, falloUpdate: true });
    await expect(quitarImagenLlave(f.db, "auto-1")).rejects.toThrow(/violación/);
    expect(f.borradas).toEqual([]);
  });
});
