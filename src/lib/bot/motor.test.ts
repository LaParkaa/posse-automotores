import { describe, expect, it } from "vitest";
import { CATALOGO } from "./__fixtures__/catalogo";
import { violacionesDeTono } from "./__fixtures__/tono";
import { conversar, type ResultadoMotor } from "./motor";
import { NEGOCIO, type Negocio } from "./negocio";
import { sesionNueva, type Sesion } from "./sesion";
import type { VehiculoCatalogo } from "./types";

const AHORA = new Date("2026-10-11T15:00:00Z");
const SITE = "https://posse.example";

type Turno = string | { texto?: string | null; historiaId?: string; adjuntos?: string[] };
type Opciones = {
  historias?: Record<string, string>;
  catalogo?: VehiculoCatalogo[];
  negocio?: Negocio;
  perfil?: { nombre?: string; usuario?: string } | null;
  sesion?: Sesion;
  ahora?: Date;
};

/** Simula una charla: encadena la sesion de cada turno en el siguiente. */
function charlar(turnos: Turno[], o: Opciones = {}): ResultadoMotor[] {
  let sesion = o.sesion ?? sesionNueva(AHORA);
  return turnos.map((turno, i) => {
    const t = typeof turno === "string" ? { texto: turno } : turno;
    const r = conversar({
      texto: t.texto ?? null,
      adjuntos: t.adjuntos ?? [],
      historiaId: t.historiaId ?? null,
      vehiculoDeHistoria: t.historiaId ? (o.historias?.[t.historiaId] ?? null) : null,
      mid: `mid.${i}`,
      sesion,
      catalogo: o.catalogo ?? CATALOGO,
      perfil: o.perfil ?? null,
      ahora: o.ahora ?? AHORA,
      siteUrl: SITE,
      negocio: o.negocio ?? NEGOCIO,
    });
    sesion = r.sesion;
    return r;
  });
}

const textos = (r: ResultadoMotor) => r.mensajes.flatMap((m) => (m.tipo === "texto" ? [m.texto] : [m.alternativaTexto]));
const tarjetas = (r: ResultadoMotor) => r.mensajes.flatMap((m) => (m.tipo === "tarjetas" ? m.tarjetas : []));
const todo = (r: ResultadoMotor) =>
  [...textos(r), ...tarjetas(r).flatMap((t) => [t.titulo, t.subtitulo, ...t.botones.map((b) => b.titulo)])].join("\n");
const urls = (r: ResultadoMotor) => tarjetas(r).flatMap((t) => t.botones.map((b) => b.url));
const hayBotonNati = (r: ResultadoMotor) => urls(r).some((u) => u.startsWith("https://wa.me/5493537558947?text="));
const titulos = (r: ResultadoMotor) => tarjetas(r).map((t) => t.titulo);

describe("respuestas a historias (los casos reales)", () => {
  it("historia conocida + 'me decis el precio?' → precio del auto y boton a Nati", () => {
    const [r] = charlar([{ texto: "hola. me decis el precio?", historiaId: "st-206" }], { historias: { "st-206": "v-206" } });

    expect(r.responder).toBe(true);
    expect(todo(r)).toContain("206");
    expect(todo(r)).toContain("$9.500.000");
    expect(tarjetas(r)).toHaveLength(1);
    expect(hayBotonNati(r)).toBe(true);
    expect(r.sesion.vehiculoActualId).toBe("v-206");
    expect(r.sesion.historiaActualId).toBe("st-206");
    expect(r.aprenderHistoria).toBeNull();
  });

  it("historia de un auto sin precio cargado → Nati lo pasa por WhatsApp", () => {
    const [r] = charlar([{ texto: "hola, me decis el precio?", historiaId: "st-208" }], { historias: { "st-208": "v-208" } });

    expect(todo(r)).toContain("208");
    expect(todo(r)).toContain("Nati");
    expect(todo(r)).not.toMatch(/consult[aá] precio/i);
    expect(hayBotonNati(r)).toBe(true);
  });

  it("historia del Vento + 'hola que valor tiene?'", () => {
    const [r] = charlar([{ texto: "Hola qué valor tiene?", historiaId: "st-vento" }], { historias: { "st-vento": "v-vento" } });

    expect(todo(r)).toContain("Vento");
    expect(todo(r)).toContain("USD 14.500");
  });

  it("historia desconocida sin nombrar el auto → pregunta cual (con la lista) y recuerda la pregunta", () => {
    const [r] = charlar([{ texto: "hola que valor tiene?", historiaId: "st-nueva" }]);

    expect(textos(r).join("\n")).toMatch(/historia/i);
    expect(textos(r).join("\n")).toContain("206");
    expect(r.sesion.paso).toBe("eligiendo_historia");
    expect(r.sesion.historiaPendienteId).toBe("st-nueva");
    expect(r.sesion.preguntaPendiente).toContain("valor");
    expect(r.aprenderHistoria).toBeNull();
  });

  it("... y cuando el cliente elige, aprende la historia y responde la pregunta pendiente", () => {
    const [, r] = charlar([{ texto: "hola que valor tiene?", historiaId: "st-nueva" }, "el 2"]);

    // la lista es: 1 amarok, 2 206, 3 208, 4 vento, 5 kangoo
    expect(r.aprenderHistoria).toEqual({ storyId: "st-nueva", vehiculoId: "v-206" });
    expect(todo(r)).toContain("$9.500.000");
    expect(r.sesion.paso).toBe("libre");
    expect(r.sesion.vehiculoActualId).toBe("v-206");
    expect(r.sesion.historiaActualId).toBe("st-nueva");
  });

  it("... tambien se puede elegir nombrando el auto", () => {
    const [, r] = charlar([{ texto: "cuanto sale?", historiaId: "st-x" }, "el vento"]);

    expect(r.aprenderHistoria).toEqual({ storyId: "st-x", vehiculoId: "v-vento" });
    expect(todo(r)).toContain("USD 14.500");
  });

  it("historia desconocida pero el texto nombra el auto → responde ese auto y aprende, sin preguntar", () => {
    const [r] = charlar([{ texto: "Hola buenas tardes, me pasas mas info del 206, gracias", historiaId: "st-206b" }]);

    expect(r.aprenderHistoria).toEqual({ storyId: "st-206b", vehiculoId: "v-206" });
    expect(todo(r)).toContain("177.000 km");
    expect(r.sesion.paso).toBe("libre");
    expect(textos(r).join("\n")).not.toMatch(/por cu[aá]l auto/i);
  });

  it("si el cliente dice que no es ese auto, olvida el vinculo y vuelve a preguntar", () => {
    const [, r] = charlar(
      [{ texto: "me decis el precio?", historiaId: "st-206" }, "no, ese no es"],
      { historias: { "st-206": "v-206" } },
    );

    expect(r.olvidarHistoria).toBe("st-206");
    expect(r.sesion.vehiculoActualId).toBeNull();
    expect(r.sesion.paso).toBe("eligiendo_historia");
  });
});

describe("autos vendidos, reservados y pedidos coloquiales", () => {
  it("foto sin texto → pide que cuente cual es; despues 'la partner' (vendida) → avisa y ofrece utilitarios parecidos", () => {
    const [a, b, c] = charlar([{ adjuntos: ["image"] }, "esa es la que había visto, la partner", "algún utilitario así?"]);

    expect(todo(a)).toMatch(/foto|imagen/i);
    expect(a.responder).toBe(true);

    expect(todo(b)).toMatch(/vendi/i);
    expect(titulos(b).join(" ")).toContain("Kangoo");
    expect(titulos(b).join(" ")).not.toContain("Partner");

    expect(titulos(c).join(" ")).toContain("Kangoo");
    expect(titulos(c).join(" ")).not.toContain("Partner");
  });

  it("entiende 'chatita'", () => {
    const [r] = charlar(["tienen alguna chatita?"]);

    expect(titulos(r).join(" ")).toContain("Kangoo");
  });

  it("un auto reservado se dice reservado", () => {
    const [r] = charlar(["tienen la xr 150?"]);

    expect(todo(r)).toMatch(/reservad/i);
  });

  it("tolera errores de tipeo en los modelos", () => {
    expect(todo(charlar(["cuanto sale el vento?"])[0])).toContain("USD 14.500");
    expect(titulos(charlar(["tenes una amarrok?"])[0]).join(" ")).toContain("Amarok");
    expect(todo(charlar(["precio del corola"])[0])).toContain("USD 9.500");
  });
});

describe("catalogo y busquedas", () => {
  it("'que autos tienen?' → carrusel de hasta 5 disponibles, sin vendidos ni reservados", () => {
    const [r] = charlar(["que autos tienen?"]);

    expect(tarjetas(r).length).toBeGreaterThan(0);
    expect(tarjetas(r).length).toBeLessThanOrEqual(5);
    expect(titulos(r).join(" ")).not.toContain("Partner");
    expect(titulos(r).join(" ")).not.toContain("XR 150");
    expect(r.sesion.mostradosIds.length).toBe(tarjetas(r).length);
  });

  it("'ver mas' muestra los que faltan sin repetir", () => {
    const [a, b] = charlar(["que autos tienen?", "mostrame mas"]);

    const primeros = titulos(a);
    expect(titulos(b).length).toBeGreaterThan(0);
    for (const t of titulos(b)) expect(primeros).not.toContain(t);
  });

  it("pickup nafta (no hay) → lo dice y muestra la pickup mas cercana", () => {
    const [r] = charlar(["busco una pickup nafta"]);

    expect(textos(r).join("\n")).toMatch(/no (tengo|hay)/i);
    expect(titulos(r).join(" ")).toContain("Amarok");
  });

  it("sin nada parecido ofrece avisar cuando entre", () => {
    const [r] = charlar(["tienen alguna moto 250?"]);

    expect(textos(r).join("\n")).toMatch(/avis/i);
    expect(r.sesion.ofrecio).toBe("aviso");
  });
});

describe("derivacion, identidad y datos del negocio", () => {
  it("'hablo con el dueño?' → boton de WhatsApp con Nati, sin pedir datos", () => {
    const [r] = charlar(["hablo con el dueño?"]);

    expect(todo(r)).toContain("Nati");
    expect(hayBotonNati(r)).toBe(true);
    expect(r.sesion.paso).toBe("libre");
  });

  it("'sos un bot?' → respuesta honesta y boton a Nati", () => {
    const [r] = charlar(["sos un bot?"]);

    expect(todo(r)).toMatch(/asistente virtual/i);
    expect(todo(r)).toContain("Nati");
    expect(hayBotonNati(r)).toBe(true);
  });

  it("financiacion: usa el texto del negocio si esta cargado", () => {
    const [r] = charlar(["hacen financiacion?"], { negocio: { ...NEGOCIO, financiacion: "Financiamos hasta 60% con cuotas fijas." } });

    expect(todo(r)).toContain("Financiamos hasta 60% con cuotas fijas.");
  });

  it("financiacion pendiente (null) → no inventa: lo confirma Nati", () => {
    const [r] = charlar(["hacen financiacion?"], { negocio: { ...NEGOCIO, financiacion: null } });

    expect(todo(r)).toContain("Nati");
    expect(hayBotonNati(r)).toBe(true);
  });

  it("horarios: pendiente → Nati; cargados → los dice", () => {
    expect(todo(charlar(["a que hora abren?"])[0])).toContain("Nati");
    expect(todo(charlar(["a que hora abren?"], { negocio: { ...NEGOCIO, horarios: "Lunes a viernes de 9 a 13 y de 16 a 20" } })[0])).toContain(
      "Lunes a viernes de 9 a 13 y de 16 a 20",
    );
  });
});

describe("captacion de datos (secundaria)", () => {
  it("'avisame cuando entre una hilux' → pide nombre, despues telefono, y entrega el lead", () => {
    const [a, b, c] = charlar(["avisame cuando entre una hilux", "Juan Pérez", "3537 123456"]);

    expect(a.sesion.paso).toBe("pidiendo_nombre");
    expect(b.sesion.paso).toBe("pidiendo_telefono");
    expect(c.lead).toMatchObject({ nombre: "Juan Pérez", telefono: "3537 123456" });
    expect(c.lead?.mensaje ?? "").toMatch(/hilux/i);
    expect(c.sesion.paso).toBe("libre");
  });

  it("un telefono invalido se repregunta; 'cancelar' sale del paso", () => {
    const [, , c, d] = charlar(["avisame cuando entre una hilux", "Juan", "hola", "cancelar"]);

    expect(c.lead).toBeNull();
    expect(c.sesion.paso).toBe("pidiendo_telefono");
    expect(d.sesion.paso).toBe("libre");
    expect(d.lead).toBeNull();
  });
});

describe("conversacion natural", () => {
  it("'Hola !como estas??' → saluda y pregunta que busca, sin tarjetas", () => {
    const [r] = charlar(["Hola !como estas??"]);

    expect(tarjetas(r)).toHaveLength(0);
    expect(textos(r).join("\n")).toMatch(/\?/);
  });

  it("el primer saludo usa el nombre del perfil", () => {
    const [r] = charlar(["hola"], { perfil: { nombre: "Juanma Centurion" } });

    expect(todo(r)).toContain("Juanma");
  });

  it("agradecer y despedirse cierran amable", () => {
    const [r] = charlar(["gracias, chau"]);

    expect(r.responder).toBe(true);
    expect(tarjetas(r)).toHaveLength(0);
  });

  it("no entendido: repregunta la primera vez y ofrece a Nati la segunda", () => {
    const [a, b] = charlar(["asdfgh", "qwerty"]);

    expect(a.noEntendido).toBe(true);
    expect(b.noEntendido).toBe(true);
    expect(a.sesion.fallos).toBe(1);
    expect(b.sesion.fallos).toBe(2);
    expect(hayBotonNati(a)).toBe(false);
    expect(hayBotonNati(b)).toBe(true);
  });

  it("entender algo despues de un fallo reinicia el contador", () => {
    const [, b] = charlar(["asdfgh", "que autos tienen?"]);

    expect(b.noEntendido).toBe(false);
    expect(b.sesion.fallos).toBe(0);
  });
});

describe("mensajes que no son texto", () => {
  it("audio → pide que lo escriba", () => {
    const [r] = charlar([{ adjuntos: ["audio"] }]);

    expect(r.responder).toBe(true);
    expect(todo(r)).toMatch(/audio/i);
    expect(todo(r)).toMatch(/escrib/i);
  });

  it("emoji suelto sin contexto → no responde", () => {
    expect(charlar(["🎉"])[0].responder).toBe(false);
    expect(charlar(["👍"])[0].responder).toBe(false);
  });

  it("mencion en una historia → no responde", () => {
    expect(charlar([{ adjuntos: ["story_mention"] }])[0].responder).toBe(false);
  });

  it("un 👍 dentro de una conversacion cuenta como afirmacion", () => {
    const [, r] = charlar(["tienen la 206?", "👍"]);

    expect(r.responder).toBe(true);
    expect(hayBotonNati(r)).toBe(true);
  });
});

describe("sesion", () => {
  it("una sesion vencida (25 h) arranca sin contexto", () => {
    const vieja = { ...sesionNueva(new Date("2026-10-10T14:00:00Z")), vehiculoActualId: "v-206", saludado: true };
    const [r] = charlar(["cuanto sale?"], { sesion: vieja });

    expect(r.sesion.vehiculoActualId).toBeNull();
    expect(textos(r).join("\n")).toMatch(/cu[aá]l|qu[eé] auto/i);
  });

  it("'cuanto sale?' sin auto en contexto pregunta de cual habla", () => {
    const [r] = charlar(["cuanto sale?"]);

    expect(textos(r).join("\n")).toMatch(/cu[aá]l|qu[eé] auto/i);
    expect(r.noEntendido).toBe(false);
  });

  it("'y el precio?' despues de mostrar un auto usa ese auto", () => {
    const [, r] = charlar(["tienen la 206?", "y el precio?"]);

    expect(todo(r)).toContain("$9.500.000");
  });

  it("actualiza la ultima actividad", () => {
    expect(charlar(["hola"])[0].sesion.ultimaActividad).toBe(AHORA.toISOString());
  });
});

describe("invariantes de tono y de formato en cualquier respuesta", () => {
  const entradas: Turno[] = [
    "hola", "Hola !como estas??", "que autos tienen?", "tienen alguna chatita?", "busco una pickup nafta",
    "hablo con el dueño?", "sos un bot?", "hacen financiacion?", "toman usados?", "a que hora abren?", "donde estan?",
    "tienen garantia?", "que papeles necesito", "formas de pago", "avisame cuando entre una hilux", "asdfgh", "gracias",
    "tienen alguna moto 250?", "la partner", "cuanto sale?", { adjuntos: ["audio"] }, { adjuntos: ["image"] },
    { texto: "me decis el precio?", historiaId: "st-206" }, { texto: "que valor tiene?", historiaId: "st-nueva" },
  ];

  it("todo texto cumple las reglas de tono y nunca pasa de 3 mensajes", () => {
    for (const entrada of entradas) {
      const [r] = charlar([entrada], { historias: { "st-206": "v-206" } });

      expect(r.mensajes.length).toBeLessThanOrEqual(3);
      for (const t of textos(r)) expect(violacionesDeTono(t), `${JSON.stringify(entrada)} → ${t}`).toEqual([]);
    }
  });

  it("las tarjetas respetan los limites de Instagram", () => {
    for (const entrada of entradas) {
      const [r] = charlar([entrada], { historias: { "st-206": "v-206" } });

      for (const m of r.mensajes) {
        if (m.tipo !== "tarjetas") continue;
        expect(m.tarjetas.length).toBeLessThanOrEqual(10);
        for (const t of m.tarjetas) {
          expect(t.botones.length).toBeLessThanOrEqual(3);
          for (const b of t.botones) expect(b.titulo.length).toBeLessThanOrEqual(20);
          if (t.imagenUrl) expect(t.imagenUrl.startsWith("https://")).toBe(true);
        }
      }
    }
  });

  it("es determinista: la misma entrada da la misma respuesta", () => {
    expect(charlar(["hola"])).toEqual(charlar(["hola"]));
  });

  it("nunca menciona datos que no estan en el catalogo", () => {
    const [r] = charlar(["cuanto sale la 208?"]);

    expect(todo(r)).not.toMatch(/\$\s?\d|USD\s?\d/);
  });
});

// ---------------------------------------------------------------------------------------------
// Casos agregados en la implementacion (reglas 4 a 8 y 12 que las conversaciones doradas no cubren).

const emojis = (t: string) => Array.from(t.matchAll(/\p{Extended_Pictographic}/gu)).length;
const porId = (id: string) => CATALOGO.find((v) => v.id === id)!;

describe("captacion: casos borde", () => {
  it("un nombre invalido se repregunta una vez; a la segunda manda el boton de Nati y sale", () => {
    const [, b, c] = charlar(["avisame cuando entre una hilux", "hola", "dale"]);

    expect(b.sesion.paso).toBe("pidiendo_nombre");
    expect(hayBotonNati(b)).toBe(false);
    expect(c.sesion.paso).toBe("libre");
    expect(hayBotonNati(c)).toBe(true);
    expect(c.lead).toBeNull();
  });

  it("un telefono invalido dos veces manda el boton de Nati y sale del paso", () => {
    const [, , c, d] = charlar(["avisame cuando entre una hilux", "Juan", "abc", "123"]);

    expect(c.sesion.paso).toBe("pidiendo_telefono");
    expect(d.sesion.paso).toBe("libre");
    expect(d.lead).toBeNull();
    expect(hayBotonNati(d)).toBe(true);
  });

  it("acepta 'me llamo Ana' y telefonos con +54 y guiones (guardados tal cual)", () => {
    const [, b, c] = charlar(["avisame cuando entre una hilux", "me llamo Ana", "+54 9 3537 12-3456"]);

    expect(b.sesion.lead.nombre).toBe("Ana");
    expect(c.lead).toMatchObject({ nombre: "Ana", telefono: "+54 9 3537 12-3456" });
  });

  it("'no' tambien cancela, y una pregunta en medio del paso se responde (el paso se abandona)", () => {
    expect(charlar(["avisame cuando entre una hilux", "no"])[1].sesion.paso).toBe("libre");

    const [, r] = charlar(["avisame cuando entre una hilux", "cuanto sale el vento?"]);
    expect(r.sesion.paso).toBe("libre");
    expect(todo(r)).toContain("USD 14.500");
    expect(r.sesion.lead.nombre).toBeUndefined();
  });

  it("aceptar el aviso de un reservado deja el auto y el motivo en el lead", () => {
    const [a, b, , d] = charlar(["tienen la xr 150?", "si", "Juan", "3537123456"]);

    expect(a.sesion.ofrecio).toBe("aviso");
    expect(b.sesion.paso).toBe("pidiendo_nombre");
    expect(d.lead).toMatchObject({ nombre: "Juan", telefono: "3537123456", vehiculo_interes: "Honda XR 150 2022" });
    expect(d.lead?.mensaje).toMatch(/libera/i);
  });

  it("si ya dejo sus datos en la charla, un nuevo 'avisame' entrega el lead sin volver a pedirlos", () => {
    const [, , , d] = charlar(["avisame cuando entre una hilux", "Juan", "3537 123456", "avisame si entra una ranger"]);

    expect(d.sesion.paso).toBe("libre");
    expect(d.lead).toMatchObject({ nombre: "Juan", telefono: "3537 123456" });
    expect(d.lead?.mensaje).toMatch(/ranger/i);
  });

  it("un emoji en medio del paso no se contesta", () => {
    const [, r] = charlar(["avisame cuando entre una hilux", "👍"]);

    expect(r.responder).toBe(false);
    expect(r.sesion.paso).toBe("pidiendo_nombre");
  });
});

describe("historias: casos borde", () => {
  it("la lista para elegir son los 5 ultimos cargados, numerados y en orden", () => {
    const [r] = charlar([{ texto: "precio?", historiaId: "st-x" }]);

    expect(r.sesion.mostradosIds).toEqual(["v-amarok", "v-206", "v-208", "v-vento", "v-kangoo"]);
    expect(titulos(r)[0]).toMatch(/^1\) /);
    expect(titulos(r)[1]).toContain("206");
    expect(r.mensajes.length).toBeLessThanOrEqual(3);
  });

  it("un vendido en la lista de la historia no se muestra como si se pudiera comprar", () => {
    const catalogo = CATALOGO.map((v) => (v.id === "v-partner" ? { ...v, created_at: "2026-10-10T10:00:00Z" } : v));
    const [r] = charlar([{ texto: "precio?", historiaId: "st-x" }], { catalogo });
    const partner = tarjetas(r).find((t) => t.titulo.includes("Partner"))!;

    expect(partner.subtitulo).toMatch(/vendi/i);
    expect(partner.botones.map((b) => b.titulo)).toEqual(["Hablar con Nati"]);
  });

  it("'el ultimo' elige el quinto de la lista", () => {
    const [, r] = charlar([{ texto: "precio?", historiaId: "st-x" }, "el ultimo"]);

    expect(r.aprenderHistoria).toEqual({ storyId: "st-x", vehiculoId: "v-kangoo" });
    expect(todo(r)).toContain("$11.000.000");
  });

  it("'ninguno' muestra el catalogo, sale del paso y no aprende nada", () => {
    const [, r] = charlar([{ texto: "precio?", historiaId: "st-x" }, "ninguno"]);

    expect(r.sesion.paso).toBe("libre");
    expect(r.aprenderHistoria).toBeNull();
    expect(tarjetas(r).length).toBeGreaterThan(0);
  });

  it("si no entiende la eleccion repregunta (cuenta como fallo) y a la segunda ofrece a Nati", () => {
    const [, b, c] = charlar([{ texto: "precio?", historiaId: "st-x" }, "asdf", "qwer"]);

    expect(b.noEntendido).toBe(true);
    expect(b.sesion.paso).toBe("eligiendo_historia");
    expect(b.sesion.fallos).toBe(1);
    expect(c.sesion.paso).toBe("libre");
    expect(hayBotonNati(c)).toBe(true);
  });

  it("si nombra varios autos pregunta cual de esos", () => {
    const [r] = charlar([{ texto: "es el 206 o el 208?", historiaId: "st-x" }]);

    expect(r.sesion.paso).toBe("eligiendo_historia");
    expect(r.sesion.mostradosIds).toEqual(["v-206", "v-208"]);
  });

  it("historia conocida y solo un saludo → presenta el auto de la historia", () => {
    const [r] = charlar([{ texto: "hola!", historiaId: "st-vento" }], { historias: { "st-vento": "v-vento" } });

    expect(todo(r)).toContain("USD 14.500");
    expect(textos(r)[0]).toMatch(/^¡Hola/);
  });

  it("historia conocida y un emoji que no es afirmacion → no responde", () => {
    const [r] = charlar([{ texto: "😍", historiaId: "st-vento" }], { historias: { "st-vento": "v-vento" } });

    expect(r.responder).toBe(false);
  });

  it("despues de corregir, la eleccion aprende de nuevo la misma historia", () => {
    const [, , r] = charlar([{ texto: "me decis el precio?", historiaId: "st-206" }, "no, ese no es", "el vento"], {
      historias: { "st-206": "v-206" },
    });

    expect(r.aprenderHistoria).toEqual({ storyId: "st-206", vehiculoId: "v-vento" });
    expect(todo(r)).toContain("USD 14.500");
  });

  it("un 'no' a la oferta de Nati no se lee como correccion de la historia", () => {
    const [, r] = charlar([{ texto: "me decis el precio?", historiaId: "st-206" }, "no"], { historias: { "st-206": "v-206" } });

    expect(r.olvidarHistoria).toBeNull();
    expect(r.sesion.paso).toBe("libre");
  });
});

describe("listas, ofertas y estados", () => {
  it("'ver mas' sin mas resultados lo dice y ofrece a Nati", () => {
    const [, , c] = charlar(["que autos tienen?", "mostrame mas", "mostrame mas"]);

    expect(tarjetas(c).every((t) => t.titulo === NEGOCIO.nombre)).toBe(true);
    expect(hayBotonNati(c)).toBe(true);
  });

  it("un 'si' despues de mostrar una lista con mas resultados muestra los siguientes", () => {
    const [a, b] = charlar(["que autos tienen?", "si"]);

    expect(a.sesion.ofrecio).toBe("mas");
    expect(titulos(b)).toEqual(["Toyota Corolla XEI 2011"]);
    expect(b.sesion.ofrecio).toBeNull();
  });

  it("'cuanto sale?' sin auto deja ofrecido el catalogo: un 'si' lo muestra", () => {
    const [, b] = charlar(["cuanto sale?", "dale"]);

    expect(tarjetas(b).length).toBe(5);
  });

  it("'el 2' despues de una lista presenta ese auto; sin lista el numero no es un auto", () => {
    const [, b] = charlar(["que autos tienen?", "el 2"]);
    expect(b.sesion.vehiculoActualId).toBe("v-206");

    const [c] = charlar(["dame 2 fotos"]);
    expect(c.noEntendido).toBe(true);
    expect(c.sesion.vehiculoActualId).toBeNull();
  });

  it("un reservado no se muestra en tarjeta y queda ofrecido el aviso", () => {
    const [r] = charlar(["tienen la xr 150?"]);

    expect(titulos(r).join(" ")).not.toContain("XR 150");
    expect(r.sesion.vehiculoActualId).toBe("v-xr150");
    expect(r.sesion.ofrecio).toBe("aviso");
  });

  it("un vendido sin parecidos ofrece avisar (y no muestra su tarjeta)", () => {
    const catalogo = [porId("v-partner"), porId("v-xr150")];
    const [r] = charlar(["la partner"], { catalogo });

    expect(todo(r)).toMatch(/vendi/i);
    expect(tarjetas(r)).toHaveLength(0);
    expect(r.sesion.ofrecio).toBe("aviso");
  });

  it("'cuanto sale la cuota' (precio + financiacion) es una pregunta de financiacion", () => {
    const [r] = charlar(["cuanto sale la cuota"]);

    expect(todo(r)).toContain(NEGOCIO.financiacion!);
    expect(textos(r).join("\n")).not.toMatch(/qu[eé] auto/i);
  });

  it("'ok gracias' no es un si a la oferta: cierra amable sin boton", () => {
    const [, r] = charlar(["tienen la 206?", "ok gracias"]);

    expect(hayBotonNati(r)).toBe(false);
    expect(r.sesion.ofrecio).toBeNull();
  });

  it("'me interesa el vento' presenta el Vento aunque la afirmacion venga primero", () => {
    const [r] = charlar(["me interesa el vento"]);

    expect(todo(r)).toContain("USD 14.500");
    expect(r.sesion.vehiculoActualId).toBe("v-vento");
  });

  it("precio de un auto y permuta en el mismo mensaje: las dos cosas, sin pasar de 3 mensajes", () => {
    const [r] = charlar(["cuanto sale el vento y toman usados?"]);

    expect(todo(r)).toContain("USD 14.500");
    expect(todo(r)).toContain(NEGOCIO.permutas!);
    expect(r.mensajes.length).toBeLessThanOrEqual(3);
  });

  it("'hola, cuanto sale el vento?' antepone un saludo breve", () => {
    const [r] = charlar(["hola, cuanto sale el vento?"]);

    expect(textos(r)[0]).toMatch(/^¡Hola/);
    expect(todo(r)).toContain("USD 14.500");
  });

  it("el nombre del perfil se usa solo en el primer saludo", () => {
    const [a, b] = charlar(["hola", "hola"], { perfil: { nombre: "Juanma Centurion" } });

    expect(todo(a)).toContain("Juanma");
    expect(todo(b)).not.toContain("Juanma");
  });

  it("un emoji que no es afirmacion, aun con contexto, no se contesta", () => {
    expect(charlar(["tienen la 206?", "🎉"])[1].responder).toBe(false);
  });

  it("varios datos del negocio en un mensaje: los cargados y los pendientes, sin inventar", () => {
    const [r] = charlar(["a que hora abren y tienen garantia?"]);

    expect(todo(r)).toContain(NEGOCIO.garantia!);
    expect(todo(r)).toMatch(/horarios te lo confirma Nati/);
    expect(hayBotonNati(r)).toBe(true);
  });
});

describe("pureza y tono", () => {
  it("no modifica la sesion de entrada", () => {
    const sesion = sesionNueva(AHORA);
    const copia = structuredClone(sesion);
    charlar(["que autos tienen?", "el 2", "avisame cuando entre una hilux"], { sesion });

    expect(sesion).toEqual(copia);
  });

  it("cada texto lleva entre 1 y 3 emojis, en charlas de varios turnos", () => {
    const charlas: Turno[][] = [
      [{ texto: "hola que valor tiene?", historiaId: "st-nueva" }, "el 2", "👍"],
      ["que autos tienen?", "mostrame mas", "mostrame mas"],
      ["tienen la xr 150?", "si", "Juan", "abc", "3537 123456"],
      ["la partner", "algún utilitario así?", "a que hora abren y donde estan?", "hacen financiacion?"],
      ["cuanto sale el vento y toman usados?", "no", "asdfgh", "qwerty", "gracias, chau"],
      [{ texto: "me decis el precio?", historiaId: "st-206" }, "no, ese no es", "ninguno"],
    ];
    for (const turnos of charlas) {
      for (const r of charlar(turnos, { historias: { "st-206": "v-206" } })) {
        for (const m of r.mensajes) {
          if (m.tipo !== "texto") continue;
          expect(emojis(m.texto), m.texto).toBeGreaterThanOrEqual(1);
          expect(emojis(m.texto), m.texto).toBeLessThanOrEqual(3);
          expect(violacionesDeTono(m.texto), m.texto).toEqual([]);
        }
        for (const m of r.mensajes) if (m.tipo === "tarjetas") expect(violacionesDeTono(m.alternativaTexto)).toEqual([]);
      }
    }
  });
});
