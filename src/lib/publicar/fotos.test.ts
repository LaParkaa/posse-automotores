import { describe, expect, it } from "vitest";
import { compartirFotos, fotosDelAuto, nombreArchivoFoto, type DepsFotos } from "./fotos";
import { PLATAFORMAS } from "./plataformas";

describe("fotosDelAuto", () => {
  it("pone la portada primero, sin repetidas ni direcciones inválidas", () => {
    expect(
      fotosDelAuto({
        cover_image_url: "https://x/a.jpg",
        imagenes: ["https://x/b.jpg", "https://x/a.jpg", "", "ftp://x/c.jpg"],
      }),
    ).toEqual(["https://x/a.jpg", "https://x/b.jpg"]);
  });

  it("sin portada devuelve solo las imágenes; sin nada devuelve vacío", () => {
    expect(fotosDelAuto({ cover_image_url: null, imagenes: ["https://x/b.jpg"] })).toEqual(["https://x/b.jpg"]);
    expect(fotosDelAuto({ cover_image_url: null, imagenes: [] })).toEqual([]);
  });
});

describe("nombreArchivoFoto", () => {
  it("arma un nombre sin tildes ni espacios y conserva la extensión", () => {
    expect(nombreArchivoFoto("Volkswagen Vento 2015", 0, "https://x/y/foto.JPG?v=1")).toBe("volkswagen-vento-2015-1.jpg");
    expect(nombreArchivoFoto("Citroën C4 Cactus", 2, "https://x/y/foto.png")).toBe("citroen-c4-cactus-3.png");
  });

  it("si la dirección no tiene una extensión conocida termina en .jpg", () => {
    expect(nombreArchivoFoto("Fiat Cronos", 0, "https://x/y/foto")).toBe("fiat-cronos-1.jpg");
  });
});

function deps(over: Partial<DepsFotos> = {}) {
  const llamadas = { compartir: [] as File[][], guardar: [] as File[] };
  const base: DepsFotos = {
    bajar: async () => new Blob(["x"], { type: "image/jpeg" }),
    puedeCompartir: () => true,
    compartir: async (archivos) => {
      llamadas.compartir.push(archivos);
    },
    guardar: (archivo) => {
      llamadas.guardar.push(archivo);
    },
    ...over,
  };
  return { base, llamadas };
}

const URLS = ["https://x/a.jpg", "https://x/b.jpg"];

describe("compartirFotos", () => {
  it("si el navegador puede compartir archivos, comparte todas juntas", async () => {
    const { base, llamadas } = deps();
    expect(await compartirFotos(URLS, "Fiat Cronos", base)).toEqual({ estado: "compartido" });
    expect(llamadas.compartir).toHaveLength(1);
    expect(llamadas.compartir[0].map((f) => f.name)).toEqual(["fiat-cronos-1.jpg", "fiat-cronos-2.jpg"]);
    expect(llamadas.guardar).toHaveLength(0);
  });

  it("si no puede compartir, descarga una por una", async () => {
    const { base, llamadas } = deps({ puedeCompartir: () => false });
    expect(await compartirFotos(URLS, "Fiat Cronos", base)).toEqual({ estado: "descargado" });
    expect(llamadas.guardar).toHaveLength(2);
    expect(llamadas.compartir).toHaveLength(0);
  });

  it("si el usuario cancela el compartir, no es un error", async () => {
    const { base } = deps({
      compartir: async () => {
        throw new DOMException("cancelado", "AbortError");
      },
    });
    expect(await compartirFotos(URLS, "Fiat Cronos", base)).toEqual({ estado: "cancelado" });
  });

  it("si una foto no se puede bajar, devuelve un error con mensaje claro", async () => {
    const { base } = deps({
      bajar: async () => {
        throw new Error("CORS");
      },
    });
    const r = await compartirFotos(URLS, "Fiat Cronos", base);
    expect(r.estado).toBe("error");
    expect(r.estado === "error" && r.mensaje.length > 0).toBe(true);
  });

  it("sin fotos devuelve un error", async () => {
    const { base } = deps();
    expect((await compartirFotos([], "Fiat Cronos", base)).estado).toBe("error");
  });
});

describe("PLATAFORMAS", () => {
  it("cada plataforma abre su pantalla de publicar y usa los colores de su marca", () => {
    expect(PLATAFORMAS.mercadolibre.urlPublicar.startsWith("https://")).toBe(true);
    expect(PLATAFORMAS.marketplace.urlPublicar.startsWith("https://")).toBe(true);
    expect(PLATAFORMAS.mercadolibre).toMatchObject({ nombre: "Mercado Libre", fondo: "#FFE600", texto: "#2D3277" });
    expect(PLATAFORMAS.marketplace).toMatchObject({ nombre: "Marketplace", fondo: "#1877F2", texto: "#FFFFFF" });
  });
});
