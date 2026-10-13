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
// "avisame" tambien: es pedir un aviso nuevo y reinicia la captacion con el motivo nuevo.
const CAMBIAN_DE_TEMA = new Set<Intencion>([
  "empleo", "humano", "identidad", "avisame", "precio", "info", "disponibilidad", "catalogo", "ver_mas", ...TEMAS_NEGOCIO,
]);
// Un nombre no puede ser una de estas: son saludos, "si", "gracias" o pedidos concretos. Los temas de
// negocio (horarios, garantia...) NO estan: por tolerancia a typos "Horacio" se lee como "horarios".
const NO_ES_UN_NOMBRE = new Set<Intencion>([
  "empleo", "humano", "identidad", "avisame", "negacion", "precio", "info", "disponibilidad", "ver_mas", "catalogo",
  "afirmacion", "gracias", "despedida", "cortesia", "saludo",
]);
// Un telefono con etiqueta ("mi cel es 3537 123456") dispara "humano"; ese tema no impide leer el numero
// (cualquier otro, como un precio o un auto nombrado, si: ahi el numero es parte de otra pregunta).
const NO_IMPIDEN_EL_TELEFONO = new Set<Intencion>(["humano", "avisame"]);
const CANCELAR = new Set(["cancelar", "cancela", "cancelo", "cancelalo", "no", "nop", "nah", "dejalo", "deja", "dejala", "olvidalo", "olvidate", "nada"]);

/** Devuelve false si el cliente cambio de tema: el paso se abandona y el mensaje sigue su curso. */
export function pasoCaptacion(t: Turno, texto: string): boolean {
  const intenciones = detectarIntenciones(texto);
  const ent = extraerEntidades(texto, t.e.catalogo);
  const nombraUnAuto = ent.vehiculoIds.length > 0;

  // El numero se lee ANTES de evaluar cambios de tema: "mi cel es 3537 123456" dispara la intencion de
  // contacto, y abandonar el paso por eso perderia un lead que el cliente acaba de dejar.
  const telefono = telefonoEn(texto);
  const esOtraPregunta = nombraUnAuto || intenciones.some((i) => CAMBIAN_DE_TEMA.has(i));
  const impideElTelefono = nombraUnAuto || intenciones.some((i) => CAMBIAN_DE_TEMA.has(i) && !NO_IMPIDEN_EL_TELEFONO.has(i));
  if (telefono !== null && !impideElTelefono) {
    if (t.s.paso === "pidiendo_telefono") {
      entregarLead(t, telefono.numero);
      return true;
    }
    // "Juan 3537123456": nombre y telefono en el mismo mensaje.
    const nombre = nombreDe(telefono.resto);
    if (nombre !== null) {
      t.s.lead = { ...t.s.lead, nombre };
      entregarLead(t, telefono.numero);
      return true;
    }
  }

  const tokens = tokenizar(texto);
  if (CANCELAR.has(tokens[0] ?? "") || tiene(intenciones, "negacion")) {
    cerrarCaptacion(t);
    decir(t, variante(t, "cancelar", T.captacionCancelada));
    return true;
  }

  if (t.s.paso === "pidiendo_nombre") {
    // Antes del cambio de tema: un nombre como "Horacio" parece la intencion "horarios", pero es lo que se pidio.
    // "cuanto sale el vento?" no es un nombre aunque tenga 4 palabras: es otra pregunta.
    const nombre = nombraUnAuto ? null : nombreDe(texto);
    if (nombre !== null) {
      t.s.lead = { ...t.s.lead, nombre };
      t.s.paso = "pidiendo_telefono";
      t.s.fallos = 0;
      decir(t, variante(t, "telefono", T.pedirTelefono(primeraPalabra(nombre))));
      return true;
    }
  }

  if (esOtraPregunta) {
    cerrarCaptacion(t);
    return false;
  }
  if (t.s.paso === "pidiendo_nombre") return falloEnPaso(t, T.nombreInvalido);
  return falloEnPaso(t, T.telefonoInvalido);
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

/**
 * "Juan Pérez", "soy Juan", "me llamo Ana Paula" → el nombre; null si no parece un nombre (1-4 palabras,
 * solo letras, sin signo de pregunta). "hola", "dale" o "gracias" son palabras sin digitos pero no son un nombre.
 */
export function nombreDe(texto: string): string | null {
  if (texto.includes("?")) return null;
  const limpio = texto
    .trim()
    .replace(/^(hola|buenas)\b[\s,!.]*/i, "")
    .replace(/^(soy|me llamo|mi nombre es)\s+/i, "")
    .replace(/[\s.!¡,;]+$/u, "")
    .trim();
  const palabras = limpio.split(/\s+/).filter((p) => p !== "");
  if (palabras.length < 1 || palabras.length > 4) return null;
  if (!palabras.every((p) => /^\p{L}[\p{L}'’.-]*$/u.test(p))) return null;
  return detectarIntenciones(limpio).some((i) => NO_ES_UN_NOMBRE.has(i)) ? null : limpio;
}

/**
 * Primer telefono del texto (8 a 13 digitos, con o sin espacios, guiones o +54), tal cual lo escribio y sin
 * las palabras de la etiqueta ("mi cel es", "whatsapp:"). `resto` es el texto sin el numero.
 */
export function telefonoEn(texto: string): { numero: string; resto: string } | null {
  for (const encontrado of texto.matchAll(/\+?\d[\d\s().-]*\d/g)) {
    const digitos = encontrado[0].replace(/\D/g, "").length;
    if (digitos < 8 || digitos > 13) continue;
    const resto = (texto.slice(0, encontrado.index) + " " + texto.slice(encontrado.index + encontrado[0].length)).trim();
    return { numero: encontrado[0].trim(), resto };
  }
  return null;
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
