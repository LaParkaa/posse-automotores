import { describe, expect, it } from "vitest";
import { normalizarSesion, sesionNueva, sesionVigente } from "./sesion";

const AHORA = new Date("2026-10-11T15:00:00Z");

describe("sesionNueva", () => {
  it("arranca libre, sin contexto y con la fecha de ahora", () => {
    const s = sesionNueva(AHORA);

    expect(s.paso).toBe("libre");
    expect(s.filtros).toEqual({});
    expect(s.vehiculoActualId).toBeNull();
    expect(s.historiaActualId).toBeNull();
    expect(s.mostradosIds).toEqual([]);
    expect(s.vistosIds).toEqual([]);
    expect(s.lead).toEqual({});
    expect(s.preguntaPendiente).toBeNull();
    expect(s.historiaPendienteId).toBeNull();
    expect(s.ofrecio).toBeNull();
    expect(s.fallos).toBe(0);
    expect(s.saludado).toBe(false);
    expect(s.ultimaActividad).toBe(AHORA.toISOString());
  });
});

describe("sesionVigente", () => {
  it("es vigente dentro de las 24 h y vencida despues", () => {
    const s = sesionNueva(new Date("2026-10-10T16:00:00Z"));

    expect(sesionVigente(s, AHORA)).toBe(true); // 23 h
    expect(sesionVigente(s, new Date("2026-10-11T17:00:00Z"))).toBe(false); // 25 h
  });

  it("acepta otra vigencia en horas", () => {
    const s = sesionNueva(new Date("2026-10-11T10:00:00Z"));

    expect(sesionVigente(s, AHORA, 4)).toBe(false); // 5 h > 4 h
    expect(sesionVigente(s, AHORA, 6)).toBe(true);
  });
});

describe("normalizarSesion", () => {
  it("devuelve una sesion nueva si lo guardado no es un objeto valido", () => {
    for (const basura of [null, undefined, "x", 3, [], {}]) {
      expect(normalizarSesion(basura, AHORA)).toEqual(sesionNueva(AHORA));
    }
  });

  it("conserva los campos validos y completa los que faltan", () => {
    const s = normalizarSesion(
      { paso: "pidiendo_telefono", vehiculoActualId: "v-206", saludado: true, ultimaActividad: AHORA.toISOString() },
      AHORA,
    );

    expect(s.paso).toBe("pidiendo_telefono");
    expect(s.vehiculoActualId).toBe("v-206");
    expect(s.saludado).toBe(true);
    expect(s.mostradosIds).toEqual([]);
    expect(s.fallos).toBe(0);
  });

  it("descarta valores de tipo equivocado", () => {
    const s = normalizarSesion({ paso: "inventado", fallos: "mucho", mostradosIds: "no" }, AHORA);

    expect(s.paso).toBe("libre");
    expect(s.fallos).toBe(0);
    expect(s.mostradosIds).toEqual([]);
  });
});
