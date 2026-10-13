import { describe, expect, it } from "vitest";
import { normalizarSesion, sesionNueva, sesionVigente, type Sesion } from "./sesion";

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
    expect(s.postulacion).toBeNull();
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

describe("normalizarSesion (blindaje)", () => {
  const sesionCompleta: Sesion = {
    paso: "postulando",
    filtros: { marca: "Peugeot", tipos: ["pickup", "suv"], combustible: "nafta", transmision: "manual", anio: 2014 },
    vehiculoActualId: "v-206",
    historiaActualId: "h-1",
    mostradosIds: ["v-1", "v-2"],
    vistosIds: ["v-1", "v-2", "v-3"],
    lead: { nombre: "Juan", telefono: "2494123456", vehiculoInteres: "Vento", motivo: "financiar" },
    preguntaPendiente: "cuanto sale?",
    historiaPendienteId: "h-2",
    ofrecio: "mas",
    fallos: 2,
    saludado: true,
    postulacion: {
      datos: { nombre: "Juan Pérez", edad: 28, localidad: "Posse", telefono: "3537123456", experiencia_ventas: "3 años en una agencia" },
      omitidos: ["experiencia_rubro"],
      campo: "financiaciones",
      pendienteDuracion: false,
      enviada: false,
    },
    ultimaActividad: AHORA.toISOString(),
  };

  it("una sesion completa sobrevive al viaje por JSON sin perder nada", () => {
    expect(normalizarSesion(JSON.parse(JSON.stringify(sesionCompleta)), AHORA)).toEqual(sesionCompleta);
  });

  it("no lanza con una entrada hostil y cae a valores seguros", () => {
    const s = normalizarSesion(
      { lead: [], filtros: "x", paso: "inventado", ofrecio: "otro", ultimaActividad: "basura", fallos: NaN, mostradosIds: [1, "a"] },
      AHORA,
    );

    expect(s.lead).toEqual({});
    expect(s.filtros).toEqual({});
    expect(s.paso).toBe("libre");
    expect(s.ofrecio).toBeNull();
    expect(s.fallos).toBe(0);
    expect(s.mostradosIds).toEqual(["a"]);
    expect(sesionVigente(s, AHORA)).toBe(false);
  });

  it("filtros.tipos descarta lo que no es texto y se omite si queda vacio", () => {
    expect(normalizarSesion({ filtros: { tipos: [1, "pickup"] } }, AHORA).filtros).toEqual({ tipos: ["pickup"] });
    expect(normalizarSesion({ filtros: { tipos: [1] } }, AHORA).filtros).toEqual({});
    expect("tipos" in normalizarSesion({ filtros: { tipos: [] } }, AHORA).filtros).toBe(false);
  });

  it("fallos solo acepta enteros finitos no negativos", () => {
    for (const malo of [-2, 1.5, NaN, Infinity, -Infinity]) {
      expect(normalizarSesion({ fallos: malo }, AHORA).fallos).toBe(0);
    }
    expect(normalizarSesion({ fallos: 3 }, AHORA).fallos).toBe(3);
  });

  it("filtros.anio solo acepta numeros finitos", () => {
    for (const malo of [NaN, Infinity, -Infinity, "2014"]) {
      expect(normalizarSesion({ filtros: { anio: malo } }, AHORA).filtros).toEqual({});
    }
    expect(normalizarSesion({ filtros: { anio: 2014 } }, AHORA).filtros).toEqual({ anio: 2014 });
  });

  it("sesionVigente es false si ultimaActividad no es una fecha valida", () => {
    expect(sesionVigente({ ...sesionNueva(AHORA), ultimaActividad: "basura" }, AHORA)).toBe(false);
  });
});

describe("normalizarSesion — postulacion de vendedor", () => {
  it("una sesion guardada antes de este cambio (sin la clave) queda con postulacion null", () => {
    expect(normalizarSesion({ paso: "libre", saludado: true }, AHORA).postulacion).toBeNull();
  });

  it("lo que no es un objeto es null", () => {
    for (const basura of ["x", 3, [], true]) {
      expect(normalizarSesion({ postulacion: basura }, AHORA).postulacion).toBeNull();
    }
  });

  it("descarta datos invalidos, recorta los largos y no acepta campos inventados", () => {
    const s = normalizarSesion(
      {
        postulacion: {
          datos: { nombre: 5, edad: 3, localidad: "x".repeat(1000), telefono: ["a"], disponibilidad: "   " },
          omitidos: ["inventado", "edad", "edad", 7],
          campo: "otro",
          pendienteDuracion: "si",
          enviada: "si",
        },
      },
      AHORA,
    );

    expect(s.postulacion).toEqual({
      datos: { localidad: "x".repeat(300) },
      omitidos: ["edad"],
      campo: null,
      pendienteDuracion: false,
      enviada: false,
    });
  });

  it("la edad solo vale como entero de 16 a 75", () => {
    for (const mala of [15, 76, 28.5, NaN, "28"]) {
      expect(normalizarSesion({ postulacion: { datos: { edad: mala } } }, AHORA).postulacion?.datos).toEqual({});
    }
    expect(normalizarSesion({ postulacion: { datos: { edad: 28 } } }, AHORA).postulacion?.datos).toEqual({ edad: 28 });
  });

  it("'postulando' es un paso valido", () => {
    expect(normalizarSesion({ paso: "postulando" }, AHORA).paso).toBe("postulando");
  });
});
