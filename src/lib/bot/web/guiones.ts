import type { Negocio } from "../negocio";
import type { VehiculoCatalogo } from "../types";
import { armarMensajeMarcos } from "./mensaje-marcos";
import type { Guion, MensajeWeb, OpcionId } from "./tipos";

/**
 * Guiones cortos por opciones (financiar / usado / disponible / Marcos). Todo puro: sin red ni base de datos.
 * No se calculan cuotas ni se promete nada: se juntan los datos y se arma el mensaje para Marcos.
 */

export type ContextoGuion = {
  vehiculo: VehiculoCatalogo | null;
  /** Dato que el motor ya detectó y hay que sumar al mensaje final (por ejemplo "Tengo para entregar: bmw 2016."). */
  extra?: string;
  negocio: Negocio;
  siteUrl: string;
};

export type ResultadoGuion = { guion: Guion; mensajes: MensajeWeb[]; sugerencias: OpcionId[] };

const MAX_RESPUESTA = 200;

export function guionNuevo(): Guion {
  return { flujo: null, paso: null, datos: {} };
}

const ANTICIPO: Partial<Record<OpcionId, string>> = {
  anticipo_sin: "sin anticipo",
  anticipo_hasta_3: "hasta 3 millones",
  anticipo_mas_3: "más de 3 millones",
  anticipo_solo_usado: "solo el usado",
};

const CUOTAS: Partial<Record<OpcionId, string>> = {
  cuotas_12: "12",
  cuotas_24: "24",
  cuotas_36: "36",
  cuotas_48: "48",
};

const CHIPS_CIERRE: OpcionId[] = ["seguir", "marcos"];
const CHIPS_CUOTAS: OpcionId[] = ["cuotas_12", "cuotas_24", "cuotas_36", "cuotas_48"];

const texto = (t: string): MensajeWeb => ({ tipo: "texto", texto: t });

/** "Anticipo: " + lo dicho, cerrado con punto (sin duplicarlo si la persona ya lo puso). */
function frase(etiqueta: string, dicho: string): string {
  const limpio = dicho.trim();
  return `${etiqueta}${/[.!?]$/.test(limpio) ? limpio : `${limpio}.`}`;
}

function cierre(detalle: string[], ctx: ContextoGuion): ResultadoGuion {
  const { texto: t, url } = armarMensajeMarcos({ vehiculo: ctx.vehiculo, detalle });
  return {
    guion: guionNuevo(),
    mensajes: [
      texto(`Listo, armé el mensaje para ${ctx.negocio.secretaria}. Revisalo y tocá el botón para enviarlo por WhatsApp.`),
      { tipo: "cierre", texto: t, url, vehiculoSlug: ctx.vehiculo?.slug ?? null },
    ],
    sugerencias: [...CHIPS_CIERRE],
  };
}

function conExtra(detalle: string[], ctx: ContextoGuion): string[] {
  return ctx.extra ? [...detalle, ctx.extra] : detalle;
}

function cierrePorFlujo(g: Guion, ctx: ContextoGuion): ResultadoGuion {
  const { anticipo, cuotas, usado } = g.datos;
  if (g.flujo === "financiar") {
    const detalle = conExtra(["Quiero financiarlo."], ctx);
    if (anticipo) detalle.push(frase("Anticipo: ", anticipo));
    if (cuotas) detalle.push(frase("Cuotas: ", cuotas));
    return cierre(detalle, ctx);
  }
  if (g.flujo === "usado") {
    return cierre(conExtra(usado ? [frase("Tengo para entregar: ", usado)] : [], ctx), ctx);
  }
  return cierre(conExtra(["Quiero hablar con alguien del equipo."], ctx), ctx);
}

function empezarFinanciar(ctx: ContextoGuion): ResultadoGuion {
  const guion: Guion = { flujo: "financiar", paso: "anticipo", datos: {} };
  return {
    guion,
    mensajes: [preguntaDe(guion, ctx)!],
    sugerencias: sugerenciasDe(guion, ctx),
  };
}

function empezarUsado(ctx: ContextoGuion): ResultadoGuion {
  const guion: Guion = { flujo: "usado", paso: "usado", datos: {} };
  return { guion, mensajes: [preguntaDe(guion, ctx)!], sugerencias: [] };
}

function empezarDisponible(ctx: ContextoGuion): ResultadoGuion {
  const v = ctx.vehiculo;
  if (!v) {
    return {
      guion: guionNuevo(),
      mensajes: [texto("Decime de qué auto me hablás y lo miramos. También podés buscarlo en el catálogo o escribirle a Marcos.")],
      sugerencias: ["buscar", "marcos"],
    };
  }
  if (v.estado === "vendido") {
    return {
      guion: guionNuevo(),
      mensajes: [texto(`El ${v.nombre} ${v.anio} ya se vendió. Si querés, te muestro otros parecidos.`)],
      sugerencias: ["buscar", "marcos"],
    };
  }
  if (v.estado === "reservado") {
    return {
      guion: guionNuevo(),
      mensajes: [texto(`El ${v.nombre} ${v.anio} figura como reservado por ahora. Si querés, te muestro otros parecidos.`)],
      sugerencias: ["buscar", "marcos"],
    };
  }
  const guion: Guion = { flujo: "disponible", paso: "confirmar", datos: {} };
  return { guion, mensajes: [preguntaDe(guion, ctx)!], sugerencias: sugerenciasDe(guion, ctx) };
}

function preguntaDe(g: Guion, ctx: ContextoGuion): MensajeWeb | null {
  switch (g.paso) {
    case "anticipo":
      return texto(
        ctx.extra
          ? "Dale, tomamos tu usado como parte de pago. ¿Entregás algo más en efectivo?"
          : "Dale. ¿Con cuánto pensás entregar?",
      );
    case "cuotas":
      return texto("Anotado. ¿En cuántas cuotas lo pensás?");
    case "usado":
      return texto("Contame qué auto tenés para entregar (marca, modelo y año).");
    case "confirmar": {
      const v = ctx.vehiculo;
      const cual = v ? `El ${v.nombre} ${v.anio} figura como disponible` : "Figura como disponible";
      return texto(`${cual}. Si querés, ${ctx.negocio.secretaria} te lo confirma y te manda fotos y video. ¿Se lo pedimos?`);
    }
    default:
      return null;
  }
}

function sugerenciasDe(g: Guion, ctx: ContextoGuion): OpcionId[] {
  switch (g.paso) {
    case "anticipo":
      return ctx.extra
        ? ["anticipo_solo_usado", "anticipo_hasta_3", "anticipo_mas_3"]
        : ["anticipo_sin", "anticipo_hasta_3", "anticipo_mas_3"];
    case "cuotas":
      return [...CHIPS_CUOTAS];
    case "confirmar":
      return ["confirmar_si", "ver_financiacion"];
    default:
      return [];
  }
}

/** La pregunta del guion que quedó pendiente (para repetirla después de contestar una pregunta suelta). */
export function preguntaPendiente(g: Guion, ctx: ContextoGuion): MensajeWeb | null {
  return g.flujo ? preguntaDe(g, ctx) : null;
}

/** Los chips que acompañan a la pregunta pendiente. */
export function sugerenciasPendientes(g: Guion, ctx: ContextoGuion): OpcionId[] {
  return g.flujo ? sugerenciasDe(g, ctx) : [];
}

function sinCambios(g: Guion): ResultadoGuion {
  return { guion: { ...g, datos: { ...g.datos } }, mensajes: [], sugerencias: [] };
}

function pasoAdelante(g: Guion, ctx: ContextoGuion, datos: Guion["datos"], paso: Guion["paso"]): ResultadoGuion {
  const guion: Guion = { flujo: g.flujo, paso, datos };
  return { guion, mensajes: [preguntaDe(guion, ctx)!], sugerencias: sugerenciasDe(guion, ctx) };
}

/** Avanza un paso. No muta `g`: devuelve un guion nuevo. */
export function avanzarGuion(
  g: Guion,
  entrada: { opcion?: OpcionId; texto?: string },
  ctx: ContextoGuion,
): ResultadoGuion {
  const { opcion } = entrada;

  if (opcion) {
    // Estas opciones arrancan (o reemplazan) un guion, estén donde estén.
    if (opcion === "financiar" || opcion === "ver_financiacion") return empezarFinanciar(ctx);
    if (opcion === "usado") return empezarUsado(ctx);
    if (opcion === "disponible") return empezarDisponible(ctx);
    if (opcion === "marcos") return cierrePorFlujo({ flujo: null, paso: null, datos: {} }, ctx);
    if (opcion === "confirmar_si") return cierre(conExtra(["Quiero que me confirmen si sigue disponible y que me manden fotos y video."], ctx), ctx);

    const anticipo = ANTICIPO[opcion];
    if (anticipo) {
      return pasoAdelante({ ...g, flujo: "financiar" }, ctx, { ...g.datos, anticipo }, "cuotas");
    }
    const cuotas = CUOTAS[opcion];
    if (cuotas) {
      // Sin anticipo todavía (se tocó un chip viejo): se vuelve a preguntar desde el principio.
      if (g.flujo !== "financiar" || g.datos.anticipo === undefined) return empezarFinanciar(ctx);
      return cierrePorFlujo({ ...g, datos: { ...g.datos, cuotas } }, ctx);
    }
    // "buscar" y "seguir" no son del guion: lo maneja quien llama.
    return sinCambios(g);
  }

  // Se corta por caracteres (no por unidades UTF-16): así nunca queda media pareja suplente.
  const dicho = Array.from((entrada.texto ?? "").trim()).slice(0, MAX_RESPUESTA).join("").trim();
  if (!dicho) return sinCambios(g);
  switch (g.paso) {
    case "anticipo":
      return pasoAdelante(g, ctx, { ...g.datos, anticipo: dicho }, "cuotas");
    case "cuotas":
      return cierrePorFlujo({ ...g, datos: { ...g.datos, cuotas: dicho } }, ctx);
    case "usado":
      return cierrePorFlujo({ ...g, datos: { ...g.datos, usado: dicho } }, ctx);
    default:
      return sinCambios(g);
  }
}
