import { filtrosDeEntidades } from "./busqueda";
import { extraerEntidades, type Entidades } from "./nlu/entidades";
import { detectarIntenciones, type Intencion } from "./nlu/intenciones";
import { tokenizar } from "./nlu/normalizar";
import type { Oferta, Sesion } from "./sesion";
import * as T from "./textos";
import {
  MAX_FALLOS_PASO,
  TEMAS_NEGOCIO,
  auto,
  autoActual,
  decir,
  mostrarContacto,
  salirDelPaso,
  secretaria,
  tiene,
  variante,
  type Turno,
} from "./turno";

/**
 * Regla 4 del motor: captacion de nombre y telefono. Es secundaria (el cierre principal es el boton de
 * WhatsApp con la secretaria): solo arranca si el cliente pide que le avisen o acepta el aviso.
 */

// Mientras se pide nombre o telefono, estas intenciones son otra pregunta: se deja el paso y se responde.
const CAMBIAN_DE_TEMA = new Set<Intencion>([
  "humano", "identidad", "precio", "info", "disponibilidad", "catalogo", "ver_mas", ...TEMAS_NEGOCIO,
]);
const CANCELAR = new Set(["cancelar", "cancela", "cancelo", "cancelalo", "no", "nop", "nah", "dejalo", "deja", "dejala", "olvidalo", "olvidate", "nada"]);

/** Devuelve false si el cliente cambio de tema: el paso se abandona y el mensaje sigue su curso. */
export function pasoCaptacion(t: Turno, texto: string): boolean {
  const intenciones = detectarIntenciones(texto);
  const tokens = tokenizar(texto);
  if (CANCELAR.has(tokens[0] ?? "") || tiene(intenciones, "negacion")) {
    cerrarCaptacion(t);
    decir(t, variante(t, "cancelar", T.captacionCancelada));
    return true;
  }
  const ent = extraerEntidades(texto, t.e.catalogo);
  // "cuanto sale el vento?" no es un nombre aunque tenga 4 palabras: es otra pregunta.
  if (intenciones.some((i) => CAMBIAN_DE_TEMA.has(i)) || ent.vehiculoIds.length > 0) {
    cerrarCaptacion(t);
    return false;
  }

  if (t.s.paso === "pidiendo_nombre") {
    const nombre = nombreDe(texto);
    if (nombre === null) return falloEnPaso(t, T.nombreInvalido);
    t.s.lead = { ...t.s.lead, nombre };
    t.s.paso = "pidiendo_telefono";
    t.s.fallos = 0;
    decir(t, variante(t, "telefono", T.pedirTelefono(primeraPalabra(nombre))));
    return true;
  }

  const telefono = telefonoDe(texto);
  if (telefono === null) return falloEnPaso(t, T.telefonoInvalido);
  entregarLead(t, telefono);
  return true;
}

/** Repregunta una vez; a la segunda deja el paso y ofrece a la secretaria (no se traba el chat). */
function falloEnPaso(t: Turno, variantes: string[]): boolean {
  t.s.fallos += 1;
  if (t.s.fallos >= MAX_FALLOS_PASO) {
    cerrarCaptacion(t);
    decir(t, variante(t, "abandono", T.captacionAbandonada(secretaria(t))));
    mostrarContacto(t, autoActual(t));
    return true;
  }
  decir(t, variante(t, "repregunta", variantes));
  return true;
}

/** Sale del paso. Si el cliente ya habia dejado nombre y telefono antes, se conservan para la proxima. */
function cerrarCaptacion(t: Turno): void {
  salirDelPaso(t.s);
  t.s.lead = datosDeContacto(t.s.lead);
}

function datosDeContacto(lead: Sesion["lead"]): Sesion["lead"] {
  return lead.nombre && lead.telefono ? { nombre: lead.nombre, telefono: lead.telefono } : {};
}

function primeraPalabra(nombre: string): string {
  return nombre.split(/\s+/)[0] ?? nombre;
}

/** "Juan Pérez", "soy Juan", "me llamo Ana Paula" → el nombre; null si no parece un nombre (1-4 palabras, sin digitos). */
function nombreDe(texto: string): string | null {
  const limpio = texto
    .trim()
    .replace(/^(hola|buenas)\b[\s,!.]*/i, "")
    .replace(/^(soy|me llamo|mi nombre es)\s+/i, "")
    .replace(/[\s.!¡,;]+$/u, "")
    .trim();
  const palabras = limpio.split(/\s+/).filter((p) => p !== "");
  if (palabras.length < 1 || palabras.length > 4) return null;
  if (!palabras.every((p) => /^\p{L}[\p{L}'’.-]*$/u.test(p))) return null;
  // "hola", "dale", "gracias" son palabras sin digitos pero no son un nombre.
  return detectarIntenciones(limpio).every((i) => i === "desconocida") ? limpio : null;
}

/** Telefono con 8 a 13 digitos (con o sin espacios, guiones o +54). Se guarda tal cual lo escribio. */
function telefonoDe(texto: string): string | null {
  const encontrado = texto.match(/\+?\d[\d\s().-]*\d/);
  if (!encontrado) return null;
  const digitos = encontrado[0].replace(/\D/g, "").length;
  return digitos >= 8 && digitos <= 13 ? encontrado[0].trim() : null;
}

/** Con nombre y telefono el lead sale para guardarse; el handler no confirma si el guardado falla. */
function entregarLead(t: Turno, telefono: string): void {
  const { nombre = "", vehiculoInteres, motivo } = t.s.lead;
  t.lead = {
    nombre,
    telefono,
    ...(vehiculoInteres ? { vehiculo_interes: vehiculoInteres } : {}),
    ...(motivo ? { mensaje: motivo } : {}),
  };
  salirDelPaso(t.s);
  t.s.lead = { nombre, telefono };
  decir(t, variante(t, "lead", T.leadListo(primeraPalabra(nombre), secretaria(t))));
  mostrarContacto(t, null);
}

/** Empieza a pedir los datos; si ya los dejo antes en esta charla, no se los vuelve a pedir. */
export function iniciarCaptacion(t: Turno): void {
  if (t.s.lead.nombre && t.s.lead.telefono) return entregarLead(t, t.s.lead.telefono);
  t.s.paso = "pidiendo_nombre";
  t.s.fallos = 0;
  decir(t, variante(t, "nombre", T.pedirNombre));
}

/** Deja preparado el "si" del cliente: si acepta, se piden los datos con este motivo. */
export function ofrecerAviso(t: Turno, motivo: string, vehiculoInteres?: string): void {
  t.s.ofrecio = "aviso";
  t.s.lead = { ...datosDeContacto(t.s.lead), motivo, ...(vehiculoInteres ? { vehiculoInteres } : {}) };
}

/** "avisame cuando entre una hilux": se guarda lo pedido (el texto) como motivo del lead y se piden los datos. */
export function avisame(t: Turno, texto: string, ent: Entidades, oferta: Oferta | null): void {
  const { lead } = t.s;
  const nombrado = ent.vehiculoIds.length === 1 ? auto(t, ent.vehiculoIds[0]) : null;
  // "avisame" a secas despues de ofrecer el aviso: vale lo que ya se habia anotado (ej. "si se libera la XR").
  const sigueLaOferta =
    oferta === "aviso" && !!lead.motivo && !nombrado && Object.keys(filtrosDeEntidades(ent)).length === 0;
  const vehiculoInteres = nombrado ? `${nombrado.nombre} ${nombrado.anio}` : sigueLaOferta ? lead.vehiculoInteres : undefined;
  t.s.lead = {
    ...datosDeContacto(lead),
    motivo: sigueLaOferta && lead.motivo ? lead.motivo : texto,
    ...(vehiculoInteres ? { vehiculoInteres } : {}),
  };
  iniciarCaptacion(t);
}
