import { describe, expect, it } from "vitest";
import { CATALOGO } from "./__fixtures__/catalogo";
import { violacionesDeTono } from "./__fixtures__/tono";
import { conversar, type ResultadoMotor } from "./motor";
import { NEGOCIO } from "./negocio";
import { normalizarSesion, sesionNueva, type Sesion } from "./sesion";

const AHORA = new Date("2026-10-13T15:00:00Z");

type Turno = string | { texto?: string | null; historiaId?: string; adjuntos?: string[] };

/** Simula una charla: encadena la sesion de cada turno en el siguiente. */
function charlar(turnos: Turno[], sesionInicial?: Sesion): ResultadoMotor[] {
  let sesion = sesionInicial ?? sesionNueva(AHORA);
  return turnos.map((turno, i) => {
    const t = typeof turno === "string" ? { texto: turno } : turno;
    const r = conversar({
      texto: t.texto ?? null,
      adjuntos: t.adjuntos ?? [],
      historiaId: t.historiaId ?? null,
      vehiculoDeHistoria: null,
      mid: `mid.${i}`,
      sesion,
      catalogo: CATALOGO,
      perfil: null,
      ahora: AHORA,
      siteUrl: "https://posse.example",
      negocio: NEGOCIO,
    });
    sesion = r.sesion;
    return r;
  });
}

const textos = (r: ResultadoMotor) => r.mensajes.flatMap((m) => (m.tipo === "texto" ? [m.texto] : []));
const tarjetas = (r: ResultadoMotor) => r.mensajes.flatMap((m) => (m.tipo === "tarjetas" ? m.tarjetas : []));
const urls = (r: ResultadoMotor) => tarjetas(r).flatMap((t) => t.botones.map((b) => b.url));
const ultimoTexto = (r: ResultadoMotor) => textos(r)[textos(r).length - 1] ?? "";
const botonMarcos = (r: ResultadoMotor) => urls(r).some((u) => u.startsWith("https://wa.me/5493537662444?text="));
const botonNati = (r: ResultadoMotor) => urls(r).some((u) => u.startsWith("https://wa.me/5493537558947?text="));
/** El mensaje que Marcos va a recibir: el que lleva el boton, ya decodificado. */
const mensajeParaMarcos = (r: ResultadoMotor) => decodeURIComponent((urls(r)[0] ?? "").split("?text=")[1] ?? "");
const emojis = (t: string) => Array.from(t.matchAll(/\p{Extended_Pictographic}/gu)).length;
const datos = (r: ResultadoMotor) => r.sesion.postulacion?.datos;

/** La pregunta que tiene que hacer el bot despues de cada turno del flujo completo. */
const PREGUNTAS = [/nombre/i, /edad|años/i, /localidad/i, /WhatsApp|teléfono|número/i, /ventas/i, /rubro|autos/i, /financiaciones/i, /disponibilidad|horarios/i];
const FLUJO = [
  "cv",
  "Juan Pérez",
  "28",
  "Justiniano Posse",
  "3537 123456",
  "3 años vendiendo en una agencia",
  "trabajé en gestoría del automotor",
  "manejo prendarios y créditos bancarios",
  "de lunes a sábado, jornada completa",
];
const MENSAJE_ESPERADO = [
  "Hola Marcos, te escribo desde Instagram por el puesto de vendedor.",
  "Nombre: Juan Pérez",
  "Edad: 28 años",
  "Localidad: Justiniano Posse",
  "Teléfono: 3537 123456",
  "Experiencia en ventas: 3 años vendiendo en una agencia",
  "Experiencia en el rubro automotor: trabajé en gestoría del automotor",
  "Financiaciones: manejo prendarios y créditos bancarios",
  "Disponibilidad: de lunes a sábado, jornada completa",
  "Te mando mi CV.",
].join("\n");
/** Charla hasta tener contestado el telefono: la pregunta pendiente es la experiencia en ventas. */
const HASTA_VENTAS = ["cv", "Juan Pérez", "28", "Posse", "3537 123456"];

describe("postulacion de vendedor: el flujo completo", () => {
  it("'cv' arranca la postulacion: saluda y pregunta el nombre", () => {
    const [r] = charlar(["cv"]);

    expect(r.responder).toBe(true);
    expect(r.sesion.paso).toBe("postulando");
    expect(r.sesion.postulacion?.campo).toBe("nombre");
    expect(textos(r)).toHaveLength(2);
    expect(textos(r)[0]).toMatch(/sumarte al equipo/i);
    expect(ultimoTexto(r)).toMatch(PREGUNTAS[0]);
  });

  it("pregunta un dato por turno, en orden, y al final arma el mensaje completo para Marcos", () => {
    const rs = charlar(FLUJO);

    for (let i = 0; i < PREGUNTAS.length; i++) {
      expect(ultimoTexto(rs[i]), `despues del turno ${i}`).toMatch(PREGUNTAS[i]);
      expect(rs[i].sesion.paso).toBe("postulando");
      expect(tarjetas(rs[i]), `turno ${i}`).toHaveLength(0);
    }

    const fin = rs[rs.length - 1];
    expect(fin.sesion.paso).toBe("libre");
    expect(fin.sesion.postulacion?.enviada).toBe(true);
    expect(textos(fin)[0]).toMatch(/Juan/);
    expect(textos(fin)[0]).toMatch(/bot[oó]n/i);
    expect(tarjetas(fin)).toHaveLength(1);
    expect(botonMarcos(fin)).toBe(true);
    expect(botonNati(fin)).toBe(false);
    expect(mensajeParaMarcos(fin)).toBe(MENSAJE_ESPERADO);
  });

  it("entiende la edad en palabras", () => {
    const rs = charlar(["cv", "Juan Pérez", "veintiocho"]);

    expect(datos(rs[2])?.edad).toBe(28);
  });

  it("no repite lo que el candidato ya dijo: edad y localidad dentro de otra respuesta", () => {
    const rs = charlar(["cv", "Juan Pérez", "tengo 28 años y vivo en Posse"]);
    const r = rs[2];

    expect(datos(r)).toMatchObject({ nombre: "Juan Pérez", edad: 28, localidad: "Posse" });
    expect(r.sesion.postulacion?.campo).toBe("telefono");
    expect(ultimoTexto(r)).toMatch(PREGUNTAS[3]);
  });

  it("un telefono pegado al nombre se aprovecha", () => {
    const [, r] = charlar(["cv", "Juan Pérez 3537123456"]);

    expect(datos(r)).toMatchObject({ nombre: "Juan Pérez", telefono: "3537123456" });
    expect(r.sesion.postulacion?.campo).toBe("edad");
  });

  it("el nombre con otros datos despues de una coma se toma igual", () => {
    const [, r] = charlar(["cv", "Juan Pérez, 28 años"]);

    expect(datos(r)?.nombre).toBe("Juan Pérez");
  });

  it("el primer mensaje con varios datos los toma todos y no los vuelve a preguntar", () => {
    const [r] = charlar(["hola, tengo 28 años, vivo en Posse y 5 años en ventas, te mando mi cv"]);

    expect(datos(r)).toEqual({ edad: 28, localidad: "Posse", experiencia_ventas: "5 años en ventas" });
    expect(r.sesion.postulacion?.campo).toBe("nombre");
    expect(ultimoTexto(r)).toMatch(PREGUNTAS[0]);
  });

  it("una respuesta que no sirve se repregunta; a la segunda se saltea y sigue", () => {
    const [, , a, b] = charlar(["cv", "Juan Pérez", "no tengo idea", "mm"]);

    expect(a.sesion.fallos).toBe(1);
    expect(a.sesion.postulacion?.campo).toBe("edad");
    expect(ultimoTexto(a)).toMatch(/edad/i);

    expect(datos(b)?.edad).toBeUndefined();
    expect(b.sesion.postulacion?.omitidos).toEqual(["edad"]);
    expect(b.sesion.postulacion?.campo).toBe("localidad");
    expect(b.sesion.fallos).toBe(0);
    expect(ultimoTexto(b)).toMatch(PREGUNTAS[2]);
  });

  it("sin nombre despues de dos intentos: no arma el mensaje y manda a Marcos", () => {
    const [, a, b] = charlar(["cv", "123", "???"]);

    expect(a.sesion.fallos).toBe(1);
    expect(ultimoTexto(a)).toMatch(/nombre/i);
    expect(b.sesion.paso).toBe("libre");
    expect(b.sesion.postulacion?.enviada).toBe(false);
    expect(textos(b).join("\n")).toMatch(/nombre/i);
    expect(botonMarcos(b)).toBe(true);
  });

  it("una respuesta larguisima se recorta a 300 caracteres y el link sigue entrando en Instagram", () => {
    const larga = "3 años " + "é".repeat(2000);
    const rs = charlar(["cv", "Juan", "28", "Posse", "3537123456", larga, larga, larga, larga]);

    expect(rs[5].sesion.postulacion?.datos.experiencia_ventas).toHaveLength(300);
    const fin = rs[rs.length - 1];
    expect(urls(fin)[0].length).toBeLessThanOrEqual(1700);
    expect(mensajeParaMarcos(fin)).toContain("Nombre: Juan");
  });

  it("despues de armado, un nuevo 'cv' no pide todo de nuevo: confirma y vuelve a mostrar el boton", () => {
    const rs = charlar([...FLUJO, "cv"]);
    const r = rs[rs.length - 1];

    expect(textos(r).join("\n")).toMatch(/ya (tengo armado|est[aá] listo)/i);
    expect(botonMarcos(r)).toBe(true);
    expect(mensajeParaMarcos(r)).toBe(MENSAJE_ESPERADO);
    expect(r.sesion.paso).toBe("libre");
  });
});

describe("postulacion de vendedor: cuanto tiempo de experiencia", () => {
  const SIN_TIEMPO = [...HASTA_VENTAS, "trabajé en una agencia"];

  it("si cuenta la experiencia sin decir cuanto tiempo, el bot pregunta los años o meses", () => {
    const rs = charlar(SIN_TIEMPO);
    const r = rs[rs.length - 1];

    expect(r.sesion.postulacion?.pendienteDuracion).toBe(true);
    expect(r.sesion.postulacion?.campo).toBe("experiencia_ventas");
    expect(ultimoTexto(r)).toMatch(/tiempo/i);
    expect(datos(r)?.experiencia_rubro).toBeUndefined();
  });

  it.each([
    ["2 años", "trabajé en una agencia · 2 años"],
    ["cinco años", "trabajé en una agencia · 5 años"],
    ["seis meses", "trabajé en una agencia · 6 meses"],
    ["hace 3 años que vendo", "trabajé en una agencia · 3 años"],
    ["año y medio", "trabajé en una agencia · 1 año y medio"],
  ])("responde '%s' → '%s' y sigue con el rubro", (respuesta, esperado) => {
    const rs = charlar([...SIN_TIEMPO, respuesta]);
    const r = rs[rs.length - 1];

    expect(datos(r)?.experiencia_ventas).toBe(esperado);
    expect(r.sesion.postulacion?.pendienteDuracion).toBe(false);
    expect(r.sesion.postulacion?.campo).toBe("experiencia_rubro");
    expect(ultimoTexto(r)).toMatch(PREGUNTAS[5]);
  });

  it("si en la duracion no dice un tiempo, se agrega lo que haya dicho y no se insiste", () => {
    const rs = charlar([...SIN_TIEMPO, "no me acuerdo bien"]);
    const r = rs[rs.length - 1];

    expect(datos(r)?.experiencia_ventas).toBe("trabajé en una agencia · no me acuerdo bien");
    expect(r.sesion.postulacion?.campo).toBe("experiencia_rubro");
  });

  it("saltear la duracion deja la experiencia como esta y sigue", () => {
    const rs = charlar([...SIN_TIEMPO, "no sé"]);
    const r = rs[rs.length - 1];

    expect(datos(r)?.experiencia_ventas).toBe("trabajé en una agencia");
    expect(r.sesion.postulacion?.omitidos).toEqual([]);
    expect(r.sesion.postulacion?.campo).toBe("experiencia_rubro");
  });

  it.each(["tengo 5 años de experiencia", "hace seis meses que vendo autos", "10 años vendiendo repuestos"])(
    "'%s' ya dice cuanto tiempo: no se pregunta de nuevo",
    (respuesta) => {
      const rs = charlar([...HASTA_VENTAS, respuesta]);
      const r = rs[rs.length - 1];

      expect(r.sesion.postulacion?.pendienteDuracion).toBe(false);
      expect(r.sesion.postulacion?.campo).toBe("experiencia_rubro");
      expect(datos(r)?.experiencia_ventas).toBe(respuesta);
      expect(datos(r)?.edad).toBe(28); // "5 años de experiencia" no pisa la edad
    },
  );

  it.each(["ninguna", "no", "sin experiencia", "es mi primer trabajo"])("'%s' es no tener experiencia: no se pregunta cuanto", (respuesta) => {
    const rs = charlar([...HASTA_VENTAS, respuesta]);
    const r = rs[rs.length - 1];

    expect(r.sesion.postulacion?.pendienteDuracion).toBe(false);
    expect(r.sesion.postulacion?.campo).toBe("experiencia_rubro");
  });

  it("la duracion pendiente se retoma con un nuevo 'cv' despues de cancelar", () => {
    const rs = charlar([...SIN_TIEMPO, "cancelar", "cv"]);
    const r = rs[rs.length - 1];

    expect(r.sesion.paso).toBe("postulando");
    expect(ultimoTexto(r)).toMatch(/tiempo/i);
  });
});

describe("postulacion de vendedor: como entra el flujo", () => {
  it("'cv' como respuesta a una historia que el bot no conoce NO pregunta de que auto era", () => {
    const [r] = charlar([{ texto: "cv", historiaId: "st-empleo" }]);

    expect(r.sesion.paso).toBe("postulando");
    expect(r.aprenderHistoria).toBeNull();
    expect(textos(r).join("\n")).not.toMatch(/historia/i);
  });

  it("'cv' en medio de otra captacion la reemplaza", () => {
    const [, r] = charlar(["avisame cuando entre una hilux", "cv"]);

    expect(r.sesion.paso).toBe("postulando");
  });

  it("'cv' mientras se elige de que auto era la historia sale de ese paso", () => {
    const [, r] = charlar([{ texto: "hola que valor tiene?", historiaId: "st-nueva" }, "cv"]);

    expect(r.sesion.paso).toBe("postulando");
  });

  it.each(["quiero hablar con un vendedor", "lo necesito para trabajo", "busco una camioneta para trabajar"])(
    "'%s' no arranca la postulacion",
    (texto) => {
      const [r] = charlar([texto]);

      expect(r.sesion.postulacion).toBeNull();
      expect(r.sesion.paso).not.toBe("postulando");
    },
  );

  it("'quiero hablar con un vendedor' sigue derivando a Nati", () => {
    const [r] = charlar(["quiero hablar con un vendedor"]);

    expect(botonNati(r)).toBe(true);
    expect(botonMarcos(r)).toBe(false);
  });

  it("'buscan vendedor?' si arranca la postulacion (gana sobre 'humano')", () => {
    const [r] = charlar(["buscan vendedor?"]);

    expect(r.sesion.paso).toBe("postulando");
    expect(botonNati(r)).toBe(false);
  });
});

describe("postulacion de vendedor: cancelar y retomar", () => {
  it("'cancelar' sale del flujo y conserva lo respondido; un nuevo 'cv' retoma sin repetir preguntas", () => {
    const [, , c, d] = charlar(["cv", "Juan Pérez", "cancelar", "cv"]);

    expect(c.sesion.paso).toBe("libre");
    expect(datos(c)?.nombre).toBe("Juan Pérez");
    expect(c.sesion.postulacion?.enviada).toBe(false);
    expect(textos(c).join("\n")).toMatch(/CV/);

    expect(d.sesion.paso).toBe("postulando");
    expect(textos(d)[0]).toMatch(/seguimos|retomamos/i);
    expect(ultimoTexto(d)).toMatch(PREGUNTAS[1]);
    expect(datos(d)?.nombre).toBe("Juan Pérez");
  });

  it("solo cancela una frase corta que empieza con la palabra", () => {
    const rs = charlar([...HASTA_VENTAS, "no cancelé nunca una venta, siempre cerraba todo"]);
    const r = rs[rs.length - 1];

    expect(r.sesion.paso).toBe("postulando");
    expect(datos(r)?.experiencia_ventas).toMatch(/cerraba todo/);
  });
});

describe("postulacion de vendedor: saltear una pregunta", () => {
  it.each(["no sé", "paso", "después", "prefiero no decirlo", "ahora no"])("'%s' saltea el dato y sigue", (salto) => {
    const [, , r] = charlar(["cv", "Juan Pérez", salto]);

    expect(r.sesion.postulacion?.omitidos).toEqual(["edad"]);
    expect(r.sesion.postulacion?.campo).toBe("localidad");
    expect(ultimoTexto(r)).toMatch(PREGUNTAS[2]);
  });

  it("el nombre no se puede saltear: se repregunta", () => {
    const [, r] = charlar(["cv", "no sé"]);

    expect(r.sesion.postulacion?.campo).toBe("nombre");
    expect(r.sesion.postulacion?.omitidos).toEqual([]);
    expect(r.sesion.fallos).toBe(1);
    expect(ultimoTexto(r)).toMatch(/nombre/i);
  });

  it("'no' es una respuesta valida a una pregunta de experiencia, no un salto", () => {
    const rs = charlar([...HASTA_VENTAS, "trabajé 3 años en una agencia", "no"]);
    const r = rs[rs.length - 1];

    expect(datos(r)?.experiencia_rubro).toBe("no");
    expect(r.sesion.postulacion?.omitidos).toEqual([]);
  });

  it("una edad salteada no se confunde despues con los años de experiencia", () => {
    const rs = charlar(["cv", "Juan Pérez", "no sé", "Posse", "3537 123456", "tengo 20 años de experiencia vendiendo"]);
    const r = rs[rs.length - 1];

    expect(datos(r)?.edad).toBeUndefined();
    expect(datos(r)?.experiencia_ventas).toMatch(/20 años de experiencia/);
  });

  it("un mensaje sin edad en el link: el mensaje a Marcos omite las lineas vacias", () => {
    const rs = charlar(["cv", "Juan Pérez", "no sé", "Posse", "3537 123456", "2 años en ventas", "no", "no", "completa"]);
    const mensaje = mensajeParaMarcos(rs[rs.length - 1]);

    expect(mensaje).not.toContain("Edad");
    expect(mensaje).toContain("Nombre: Juan Pérez");
    expect(mensaje).toContain("Experiencia en ventas: 2 años en ventas");
  });
});

describe("postulacion de vendedor: preguntas que no son de los datos", () => {
  it.each(["cuánto pagan?", "hay comisiones", "el sueldo es fijo?", "cuanto se gana?", "horario de trabajo?"])(
    "'%s' lo ve Marcos y se repite la pregunta pendiente",
    (pregunta) => {
      const rs = charlar([...HASTA_VENTAS, pregunta]);
      const r = rs[rs.length - 1];

      expect(textos(r)[0]).toMatch(/Marcos/);
      expect(ultimoTexto(r)).toMatch(PREGUNTAS[4]);
      expect(r.sesion.postulacion?.campo).toBe("experiencia_ventas");
      expect(datos(r)?.experiencia_ventas).toBeUndefined();
      expect(r.sesion.fallos).toBe(0);
    },
  );

  it.each([
    "vendía a comisión, sin sueldo fijo",
    "tengo experiencia en financiaciones",
    "vendía autos usados, el precio lo negociaba yo",
  ])("'%s' es una respuesta de la postulacion, no una pregunta", (respuesta) => {
    const rs = charlar([...HASTA_VENTAS, respuesta]);
    const r = rs[rs.length - 1];

    expect(datos(r)?.experiencia_ventas).toBe(respuesta);
    expect(r.sesion.paso).toBe("postulando");
  });

  it("'mi horario de trabajo actual es de 8 a 16' es la disponibilidad, no una pregunta", () => {
    const rs = charlar([
      ...HASTA_VENTAS,
      "3 años en una agencia",
      "gestoría",
      "prendarios",
      "mi horario de trabajo actual es de 8 a 16",
    ]);
    const r = rs[rs.length - 1];

    expect(mensajeParaMarcos(r)).toContain("Disponibilidad: mi horario de trabajo actual es de 8 a 16");
  });
});

describe("postulacion de vendedor: cambio de tema", () => {
  it("una pregunta por un auto concreto se responde aparte y la postulacion queda guardada", () => {
    const rs = charlar([...HASTA_VENTAS, "cuanto sale el vento?"]);
    const r = rs[rs.length - 1];

    expect(r.sesion.paso).toBe("libre");
    expect(textos(r).join("\n") + JSON.stringify(tarjetas(r))).toContain("USD 14.500");
    expect(datos(r)?.nombre).toBe("Juan Pérez");
    expect(r.sesion.postulacion?.campo).toBe("experiencia_ventas");
  });

  it("despues del cambio de tema, 'cv' retoma donde quedo", () => {
    const rs = charlar([...HASTA_VENTAS, "cuanto sale el vento?", "cv"]);
    const r = rs[rs.length - 1];

    expect(r.sesion.paso).toBe("postulando");
    expect(ultimoTexto(r)).toMatch(PREGUNTAS[4]);
  });
});

describe("postulacion de vendedor: fotos, audios y archivos", () => {
  it.each([["image"], ["audio"], ["file"]])("un adjunto '%s' en medio del flujo manda el CV a Marcos y no pierde la pregunta", (adjunto) => {
    const rs = charlar([...HASTA_VENTAS, { texto: null, adjuntos: [adjunto] }]);
    const r = rs[rs.length - 1];

    expect(r.responder).toBe(true);
    expect(textos(r).join("\n")).toMatch(/Marcos/);
    expect(botonMarcos(r)).toBe(true);
    expect(botonNati(r)).toBe(false);
    expect(r.sesion.paso).toBe("postulando");
    expect(r.sesion.postulacion?.campo).toBe("experiencia_ventas");
  });
});

describe("postulacion de vendedor: pureza, tono y persistencia", () => {
  it("no modifica la sesion de entrada", () => {
    const sesion = sesionNueva(AHORA);
    const copia = structuredClone(sesion);

    charlar(FLUJO, sesion);

    expect(sesion).toEqual(copia);
  });

  it("cada texto del flujo lleva de 1 a 3 emojis y cumple el tono", () => {
    for (const r of charlar([...FLUJO, "cv"])) {
      for (const texto of textos(r)) {
        expect(emojis(texto), texto).toBeGreaterThanOrEqual(1);
        expect(emojis(texto), texto).toBeLessThanOrEqual(3);
        expect(violacionesDeTono(texto), texto).toEqual([]);
      }
      for (const m of r.mensajes) if (m.tipo === "tarjetas") expect(violacionesDeTono(m.alternativaTexto)).toEqual([]);
    }
  });

  it("la sesion a mitad del flujo sobrevive al viaje por JSON y la charla sigue", () => {
    const [, r1] = charlar(["cv", "Juan Pérez"]);
    const viaJson = normalizarSesion(JSON.parse(JSON.stringify(r1.sesion)), AHORA);

    expect(viaJson).toEqual(r1.sesion);

    const [r2] = charlar(["28"], viaJson);
    expect(datos(r2)).toMatchObject({ nombre: "Juan Pérez", edad: 28 });
    expect(r2.sesion.postulacion?.campo).toBe("localidad");
  });
});
