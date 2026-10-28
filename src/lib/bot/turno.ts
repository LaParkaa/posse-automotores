import type { Entidades } from "./nlu/entidades";
import type { Intencion } from "./nlu/intenciones";
import type { EntradaMotor } from "./motor";
import {
  alternativaTexto,
  elegir,
  primerNombre,
  tarjetaContacto,
  tarjetaDe,
  tarjetaFinanciacion,
  tarjetaPostulacion,
  urlFinanciacion,
  type Contexto,
} from "./respuestas";
import type { Sesion } from "./sesion";
import * as T from "./textos";
import type { DatosPostulacionMensaje } from "../utils";
import type { LeadInput, MensajeSalida, VehiculoCatalogo } from "./types";

/**
 * Estado de trabajo de un turno del motor y las utilidades que comparten sus reglas (decir, mostrar
 * tarjetas, resolver "el 2" o "ese"). Separado de `motor.ts` para que el motor quede como la lista
 * de reglas en orden y no como un archivo gigante.
 */

// Instagram corta la conversacion si el bot manda una rafaga: como mucho 3 mensajes por turno.
export const MAX_MENSAJES = 3;
// Un carrusel de mas de 5 abruma, y la alternativa en texto no puede pasar de 5 lineas.
export const MAX_TARJETAS = 5;
// En un paso (nombre, telefono, historia) se repregunta una vez; a la segunda se ofrece a la secretaria.
export const MAX_FALLOS_PASO = 2;
/** Preguntas sobre el negocio que se contestan con `negocio.ts` (o derivando si estan pendientes). */
export const TEMAS_NEGOCIO: Intencion[] = ["financiacion", "permuta", "pagos", "horarios", "ubicacion", "garantia", "documentacion"];

/**
 * Estado de trabajo de un turno. Se muta solo dentro de una llamada a `conversar` (que arranca de una
 * copia de la sesion), asi que el motor sigue siendo puro.
 */
export type Turno = {
  e: EntradaMotor;
  s: Sesion;
  ctx: Contexto;
  mensajes: MensajeSalida[];
  lead: LeadInput | null;
  aprenderHistoria: { storyId: string; vehiculoId: string } | null;
  olvidarHistoria: string | null;
  noEntendido: boolean;
  responder: boolean;
};

/** Variante de texto determinista: la semilla es el mid del mensaje mas una clave por situacion. */
export const variante = (t: Turno, clave: string, variantes: readonly string[]) => elegir(variantes, `${t.e.mid}:${clave}`);
export const secretaria = (t: Turno) => t.e.negocio.secretaria;
export const reclutador = (t: Turno) => t.e.negocio.reclutador.nombre;
export const tiene = (intenciones: Intencion[], i: Intencion) => intenciones.includes(i);

export function auto(t: Turno, id: string | null | undefined): VehiculoCatalogo | null {
  return id ? (t.e.catalogo.find((v) => v.id === id) ?? null) : null;
}

export const autoActual = (t: Turno) => auto(t, t.s.vehiculoActualId);

/**
 * Cambia el auto del que se habla. Si es otro distinto, la historia que lo originaba deja de aplicar:
 * un "no, ese no" posterior habla del auto nuevo y no debe borrar el vinculo viejo (que era correcto).
 */
export function fijarVehiculo(t: Turno, id: string): void {
  if (t.s.vehiculoActualId !== id) t.s.historiaActualId = null;
  t.s.vehiculoActualId = id;
}

export function decir(t: Turno, texto: string): void {
  // Un texto vacio rompe el envio en Instagram: nunca se manda.
  if (texto.trim() !== "") t.mensajes.push({ tipo: "texto", texto });
}

/** Tarjetas de autos con su alternativa en texto. Nunca vacia (alternativaTexto([]) es ""). */
export function tarjetas(t: Turno, vehiculos: VehiculoCatalogo[]): void {
  if (vehiculos.length === 0) return;
  t.mensajes.push({
    tipo: "tarjetas",
    tarjetas: vehiculos.map((v) => tarjetaDe(v, t.ctx)),
    alternativaTexto: alternativaTexto(vehiculos, t.ctx),
  });
}

/** Muestra una lista y la recuerda en orden, para que "el segundo" se resuelva despues. */
export function mostrarLista(t: Turno, vehiculos: VehiculoCatalogo[]): void {
  const pagina = vehiculos.slice(0, MAX_TARJETAS);
  tarjetas(t, pagina);
  t.s.mostradosIds = pagina.map((v) => v.id);
}

/** Boton de WhatsApp con la secretaria (con el auto, si lo hay, para que el mensaje ya lo diga). */
export function mostrarContacto(t: Turno, v: VehiculoCatalogo | null): void {
  const tarjeta = tarjetaContacto(v, t.ctx);
  t.mensajes.push({
    tipo: "tarjetas",
    tarjetas: [tarjeta],
    alternativaTexto: T.contactoEnTexto(secretaria(t), tarjeta.botones[0].url),
  });
}

/**
 * Tarjeta con el link al simulador de financiacion (y el boton de Marcos). Sin un link https valido no hay
 * simulador que ofrecer, asi que queda el contacto de siempre.
 */
export function mostrarFinanciacion(t: Turno, v: VehiculoCatalogo | null): void {
  const url = urlFinanciacion(v, t.ctx.siteUrl);
  if (url === null) return mostrarContacto(t, v);
  t.mensajes.push({
    tipo: "tarjetas",
    tarjetas: [tarjetaFinanciacion(v, t.ctx)],
    alternativaTexto: T.financiacionEnTexto(url),
  });
}

/** Boton de WhatsApp con Marcos: abre el chat con el mensaje de la postulacion ya armado con lo que se sabe del candidato. */
export function mostrarContactoReclutador(t: Turno, datos: DatosPostulacionMensaje): void {
  const tarjeta = tarjetaPostulacion(datos, t.ctx);
  t.mensajes.push({
    tipo: "tarjetas",
    tarjetas: [tarjeta],
    alternativaTexto: T.contactoReclutadorEnTexto(reclutador(t), t.e.negocio.reclutador.whatsappVisible),
  });
}

export function salirDelPaso(s: Sesion): void {
  s.paso = "libre";
  s.historiaPendienteId = null;
  s.preguntaPendiente = null;
  s.fallos = 0;
}

/** El nombre del perfil solo en el primer saludo: repetirlo en cada mensaje suena a robot. */
export function nombreParaSaludo(t: Turno): string | null {
  const nombre = t.s.saludado ? null : primerNombre(t.e.perfil);
  t.s.saludado = true;
  return nombre;
}

/** "hola, cuanto sale?": el saludo va pegado al comienzo de la respuesta, no en un mensaje aparte. */
export function saludarAntes(t: Turno): void {
  const prefijo = T.prefijoSaludo(nombreParaSaludo(t));
  const primero = t.mensajes[0];
  if (primero?.tipo === "texto") t.mensajes[0] = { tipo: "texto", texto: prefijo + primero.texto };
  else if (t.mensajes.length < MAX_MENSAJES) t.mensajes.unshift({ tipo: "texto", texto: `${prefijo}👋` });
}

/** "el 2" / "el ultimo" sobre la ultima lista mostrada. */
export function idDeOrdinal(lista: string[], ordinal: number | null): string | null {
  if (ordinal === null || lista.length === 0) return null;
  return (ordinal === -1 ? lista[lista.length - 1] : lista[ordinal - 1]) ?? null;
}

/**
 * "el 2" o "ese" solo significan algo si hay una lista mostrada o un auto en contexto: sin eso, el
 * 2 de "dame 2 fotos" no es un auto.
 */
export function referenciaContextual(t: Turno, ent: Entidades): VehiculoCatalogo | null {
  const { mostradosIds } = t.s;
  if (ent.ordinal !== null && mostradosIds.length > 0) return auto(t, idDeOrdinal(mostradosIds, ent.ordinal));
  if (ent.deictico) return autoActual(t) ?? (mostradosIds.length === 1 ? auto(t, mostradosIds[0]) : null);
  return null;
}

export const nombrados = (t: Turno, ent: Entidades) =>
  ent.vehiculoIds.map((id) => auto(t, id)).filter((v): v is VehiculoCatalogo => v !== null);
