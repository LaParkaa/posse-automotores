import { describe, expect, it } from "vitest";
import { CLAVE_VISITANTE, CLAVE_VISITANTE_TEMPORAL, idAlAzar, idDeVisitanteChat } from "./visitante";

const storageFalso = (inicial: Record<string, string> = {}) => {
  const datos = new Map(Object.entries(inicial));
  return {
    getItem: (k: string) => datos.get(k) ?? null,
    setItem: (k: string, v: string) => void datos.set(k, v),
    datos,
  };
};

const storageRoto = {
  getItem: (): string | null => {
    throw new Error("bloqueado");
  },
  setItem: (): void => {
    throw new Error("bloqueado");
  },
};

/** Acepta escribir pero no guarda nada (Safari privado viejo). */
const storageQueNoGuarda = { getItem: (): string | null => null, setItem: (): void => {} };

const ID = "11111111-2222-3333-4444-555555555555";
const OTRO = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const nuevo = () => OTRO;

describe("idDeVisitanteChat", () => {
  it("usa el posse_vid del sitio si ya está", () => {
    const local = storageFalso({ [CLAVE_VISITANTE]: ID });
    expect(idDeVisitanteChat({ local, sesion: storageFalso(), crear: true, nuevo })).toBe(ID);
  });

  it("si no está, lo crea en localStorage (como el rastreador)", () => {
    const local = storageFalso();
    expect(idDeVisitanteChat({ local, sesion: storageFalso(), crear: true, nuevo })).toBe(OTRO);
    expect(local.datos.get(CLAVE_VISITANTE)).toBe(OTRO);
  });

  it("con 'No rastrear' no crea uno permanente: usa uno de la sesión", () => {
    const local = storageFalso();
    const sesion = storageFalso();
    expect(idDeVisitanteChat({ local, sesion, crear: false, nuevo })).toBe(OTRO);
    expect(local.datos.has(CLAVE_VISITANTE)).toBe(false);
    expect(sesion.datos.get(CLAVE_VISITANTE_TEMPORAL)).toBe(OTRO);
  });

  it("con localStorage bloqueado usa uno temporal de la sesión, y lo reutiliza", () => {
    const sesion = storageFalso();
    expect(idDeVisitanteChat({ local: storageRoto, sesion, crear: true, nuevo })).toBe(OTRO);
    expect(idDeVisitanteChat({ local: storageRoto, sesion, crear: true, nuevo: () => ID })).toBe(OTRO);
  });

  it("si localStorage no guarda, no inventa: pasa a la sesión", () => {
    const sesion = storageFalso();
    expect(idDeVisitanteChat({ local: storageQueNoGuarda, sesion, crear: true, nuevo })).toBe(OTRO);
    expect(sesion.datos.get(CLAVE_VISITANTE_TEMPORAL)).toBe(OTRO);
  });

  it("un posse_vid con forma inválida no se pisa ni se usa", () => {
    const local = storageFalso({ [CLAVE_VISITANTE]: "x" });
    const sesion = storageFalso();
    expect(idDeVisitanteChat({ local, sesion, crear: true, nuevo })).toBe(OTRO);
    expect(local.datos.get(CLAVE_VISITANTE)).toBe("x");
  });

  it("sin ningún storage devuelve uno nuevo", () => {
    expect(idDeVisitanteChat({ local: null, sesion: null, crear: true, nuevo })).toBe(OTRO);
    expect(idDeVisitanteChat({ local: storageRoto, sesion: storageRoto, crear: true, nuevo })).toBe(OTRO);
  });
});

describe("idAlAzar", () => {
  const FORMATO = /^[A-Za-z0-9-]{8,64}$/;

  it("usa randomUUID si está", () => {
    expect(idAlAzar({ randomUUID: () => ID })).toBe(ID);
  });

  it("sin randomUUID (http en la red local) usa getRandomValues", () => {
    const id = idAlAzar({ getRandomValues: <T extends ArrayBufferView | null>(a: T) => a });
    expect(id).toMatch(FORMATO);
  });

  it("sin crypto no lanza y respeta el formato", () => {
    expect(idAlAzar(undefined)).toMatch(FORMATO);
    const a = idAlAzar({});
    const b = idAlAzar({});
    expect(a).toMatch(FORMATO);
    expect(a).not.toBe(b);
  });

  it("si randomUUID lanza, cae al siguiente", () => {
    const roto = {
      randomUUID: (): string => {
        throw new Error("no");
      },
    };
    expect(idAlAzar(roto)).toMatch(FORMATO);
  });
});
