import { claveTipo } from "./nlu/vocabulario";
import type { CampoPostulacion } from "./sesion";
import type { VehiculoCatalogo } from "./types";

/**
 * Redaccion del bot. Aca esta solo el texto (el motor decide QUE decir, este archivo COMO decirlo).
 *
 * Reglas para editar: rioplatense como escribe el equipo, frases cortas, 1 a 3 emojis por mensaje,
 * maximo 5 lineas, sin markdown (nada de asteriscos ni almohadillas) y sin formulas corporativas.
 * Cada situacion tiene 2 a 4 variantes: el motor elige una con `elegir(variantes, mid)` para que el
 * bot no suene repetido. Ningun texto puede afirmar datos: precios, km o datos del negocio entran
 * siempre por parametro desde el catalogo o `negocio.ts`.
 */

// "la Amarok", "la Kangoo", "la XR", pero "el 206", "el Vento": en la calle el genero lo pone el tipo.
const TIPOS_FEMENINOS = new Set(["moto", "pickup", "utilitario", "suv", "camioneta"]);

const esFemenino = (v: VehiculoCatalogo) => TIPOS_FEMENINOS.has(claveTipo(v.tipo ?? ""));
/** "el Peugeot 206 1.6" / "la Renault Kangoo". */
const el = (v: VehiculoCatalogo) => `${esFemenino(v) ? "la" : "el"} ${v.nombre}`;
/** "El Peugeot 206 1.6" / "La Renault Kangoo" (comienzo de frase). */
const El = (v: VehiculoCatalogo) => `${esFemenino(v) ? "La" : "El"} ${v.nombre}`;
/** "del Peugeot 206 1.6" / "de la Renault Kangoo". */
const del = (v: VehiculoCatalogo) => `${esFemenino(v) ? "de la" : "del"} ${v.nombre}`;
const o = (v: VehiculoCatalogo) => (esFemenino(v) ? "a" : "o");

// ---------------------------------------------------------------------------------------------
// Charla

/** Primer saludo; `nombre` solo la primera vez (si el perfil trae uno que suene a nombre). */
export const saludo = (nombre: string | null) => {
  const n = nombre ? ` ${nombre}` : "";
  return [
    `¡Hola${n}! 👋 ¿En qué te puedo ayudar? Contame qué andás buscando`,
    `¡Hola${n}! 😊 Contame, ¿qué auto estás buscando?`,
    `¡Buenas${n}! 👋 ¿Buscás auto, camioneta o moto?`,
  ];
};

/** "¿como estas?" (con o sin hola). */
export const cortesia = (nombre: string | null) => {
  const n = nombre ? ` ${nombre}` : "";
  return [
    `¡Hola${n}! 👋 Todo bien por acá, ¿vos? Contame qué andás buscando`,
    `¡Todo bien${n}, gracias! 😊 ¿En qué te puedo ayudar?`,
    `¡Muy bien${n}! 🙌 ¿Vos todo bien? Contame qué estás buscando`,
  ];
};

/** Saludo corto que se antepone a otra respuesta ("hola, cuanto sale?"). Sin emoji: ya trae la respuesta. */
export const prefijoSaludo = (nombre: string | null) => `¡Hola${nombre ? ` ${nombre}` : ""}! `;

export const gracias = [
  "¡De nada! 😊 Cualquier cosa me escribís por acá",
  "¡Nada que agradecer! 🙌 Acá estoy para lo que necesites",
  "¡Un placer! 😊 Si te surge algo más, escribime",
];

export const despedida = [
  "¡Gracias a vos! 👋 Que andes bien, cualquier cosa acá estamos",
  "¡Abrazo, que andes bien! 👋",
  "¡Dale, gracias por escribir! 😊 Cualquier cosa me avisás",
];

export const sinProblema = [
  "Dale, sin problema 😊 Si necesitás algo más, acá estoy",
  "¡Tranqui! 👍 Cualquier cosa me escribís",
  "Dale 😊 Si después querés ver algo, me escribís por acá",
];

export const afirmacionSinOferta = [
  "¡Dale! 😊 Contame qué andás buscando: ¿auto, camioneta o moto?",
  "¡Genial! 🙌 ¿Qué auto estás buscando?",
];

export const noEntendidoPrimero = [
  'Perdón, no te entendí bien 😅 ¿Buscás auto, moto o utilitario?\nPodés escribirme algo como "una pickup diésel" o "qué autos tienen"',
  'Uy, no te seguí 🙈 ¿Qué estás buscando?\nPor ejemplo "un auto automático" o "qué tienen en stock"',
];

export const noEntendidoOtraVez = (secretaria: string) => [
  `Uy, se me complica entenderte por acá 🙈\nPodés pedirme el catálogo o el precio de un auto, o hablar con ${secretaria} por WhatsApp 👇`,
  `Perdón, no te estoy entendiendo 😅\nSi querés, pedime "qué autos tienen", o escribile a ${secretaria} por WhatsApp 👇`,
];

// ---------------------------------------------------------------------------------------------
// Mensajes sin texto

export const audio = [
  "¡Perdón! No puedo escuchar audios por acá 🙈 ¿Me lo escribís?",
  "Uy, los audios no los puedo escuchar por acá 😅 ¿Me lo escribís así te ayudo?",
];

export const foto = [
  "Uy, no puedo ver fotos ni imágenes por acá 🙈 ¿Me contás qué auto buscás o cuál es?",
  "La foto no la puedo ver por acá 😅 ¿Me escribís qué auto es o qué andás buscando?",
];

// ---------------------------------------------------------------------------------------------
// Derivacion e identidad

export const humano = (secretaria: string) => [
  `¡Dale! 😊 ${secretaria} te atiende por WhatsApp, tocá el botón y le escribís 👇`,
  `Sii, te paso con ${secretaria} 💬 Te atiende por WhatsApp, tocá acá abajo`,
  `¡Claro! Escribile a ${secretaria} por WhatsApp y te responde ella 😊👇`,
];

/** Honesto: nunca dice ser una persona. */
export const identidad = (negocio: string, secretaria: string) => [
  `Soy el asistente virtual de ${negocio} 🤖 Te ayudo con el catálogo y los precios.\nSi preferís hablar con una persona, ${secretaria} te atiende por WhatsApp 👇`,
  `¡Buena pregunta! Soy el asistente virtual de ${negocio} 😊\nSi querés hablar con una persona, ${secretaria} te atiende por WhatsApp 👇`,
];

export const aceptaContacto = (secretaria: string) => [
  `¡Dale! Tocá el botón y le escribís a ${secretaria} por WhatsApp 💬`,
  `¡Genial! ${secretaria} te atiende por WhatsApp, tocá acá abajo 👇`,
];

/** Respaldo en texto de la tarjeta de contacto (si Instagram la rechaza). */
export const contactoEnTexto = (secretaria: string, url: string) => `Escribile a ${secretaria} por WhatsApp 💬 ${url}`;

// ---------------------------------------------------------------------------------------------
// Un auto

/** Respuesta a "cuanto sale?" con el precio cargado: va en la primera linea. */
export const conPrecio = (v: VehiculoCatalogo, precio: string) => [
  `${El(v)} está ${precio} 😉`,
  `Dale, te cuento 😊 ${El(v)} está ${precio}`,
  `${El(v)} sale ${precio} 🚗`,
];

/** Respuesta a "cuanto sale?" sin precio cargado (o "Consultá"): lo pasa la secretaria. */
export const sinPrecio = (v: VehiculoCatalogo, secretaria: string) => [
  `El precio ${del(v)} te lo pasa ${secretaria} por WhatsApp 💬`,
  `${El(v)} está disponible 😊 El precio te lo pasa ${secretaria} por WhatsApp`,
];

/** Info o "tienen el X?": presenta el auto. */
export const disponible = (v: VehiculoCatalogo) => [
  `Sii, ${el(v)} está disponible 😊`,
  `Dale, te cuento ${del(v)} 😊`,
  `Sii, lo tenemos: ${el(v)} 🚗`,
];

export const lineaPrecio = (precio: string) => `Precio: ${precio}`;
export const lineaSinPrecio = (secretaria: string) => `El precio te lo pasa ${secretaria} por WhatsApp`;

export const cierreDisponible = (secretaria: string) => [
  `¿Querés que ${secretaria} te pase más info por WhatsApp? 💬`,
  `Si querés verlo o coordinar, ${secretaria} te atiende por WhatsApp 👇`,
  `¿Te paso con ${secretaria} por WhatsApp para coordinar? 💬`,
];

export const reservado = (v: VehiculoCatalogo) => [
  `Uy, ${el(v)} está reservad${o(v)} por ahora 😕`,
  `${El(v)} está reservad${o(v)} en este momento 😕`,
];

export const ofrecerAvisoSiSeLibera = ["¿Querés que te avise si se libera? 🙌", "Si querés, te aviso si se libera 🙌"];

export const parecidosAbajo = ["Mientras, mirá estos parecidos 👇", "Te dejo unos parecidos acá abajo 👇"];

export const vendidoConParecidos = (v: VehiculoCatalogo) => [
  `Uh, ${el(v)} ya se vendió 😕 pero mirá estos que tengo parecidos 👇`,
  `${El(v)} ya se vendió 😕 Te muestro lo más parecido que tengo 👇`,
];

export const vendidoSinParecidos = (v: VehiculoCatalogo) => [
  `Uh, ${el(v)} ya se vendió 😕\n¿Querés que te avise cuando entre algo parecido? 🙌`,
  `${El(v)} ya se vendió 😕\nSi querés, te aviso cuando entre uno parecido 🙌`,
];

/** Motivo que queda en el lead si el cliente acepta el aviso. */
export const motivoSiSeLibera = (v: VehiculoCatalogo) => `Avisar si se libera: ${v.nombre} ${v.anio}`;
export const motivoParecido = (v: VehiculoCatalogo) => `Avisar cuando entre algo parecido a: ${v.nombre} ${v.anio}`;

/** "cuanto sale?" sin ningun auto en contexto. */
export const cualAuto = [
  "¿De qué auto me hablás? 😊 Decime el modelo, o si querés te muestro lo que tengo",
  "¿Me decís cuál auto te interesa? 🚗 Pasame el modelo, o te muestro lo que hay",
];

/** Varios autos posibles: se pregunta cual, con la lista en una sola linea. */
export const cualDeEstos = (lista: string) => [`¿De cuál me preguntás? 😊\n${lista}`, `¿Me decís cuál? 🤔\n${lista}`];

export const variosNombrados = ["Te muestro los que me nombraste 👇", "Dale, mirá 👇"];

export const noDisponibleEnLista = (v: VehiculoCatalogo) =>
  v.estado === "vendido" ? `${El(v)} ya se vendió 😕` : `${El(v)} está reservad${o(v)} 😕`;

// ---------------------------------------------------------------------------------------------
// Listas y busquedas

export const listaExacta = ["Mirá lo que tengo 👇", "Te muestro lo que hay 😊👇", "Dale, mirá estos 👇"];

export const listaRelajada = [
  "No tengo exactamente eso ahora 😕 pero mirá lo más parecido 👇",
  "Uh, con eso justo no hay ahora 😕 Te muestro lo más cercano 👇",
  "Eso exacto no tengo por ahora 😕 pero mirá estas opciones 👇",
];

export const hayMas = 'Si querés ver más, decime "ver más" 😉';

export const listaVacia = [
  "Uh, eso no lo tengo ahora 😕 ¿Querés que te avise cuando entre? 🙌",
  "Por ahora no tengo nada así 😕 ¿Te aviso cuando entre algo? 🙌",
];

export const verMasEncabezado = ["Acá van más 👇", "Dale, mirá estos otros 👇"];

export const verMasAgotado = (secretaria: string) => [
  `Eso es todo lo que tengo con eso por ahora 😅\nSi querés, escribile a ${secretaria} por WhatsApp y te cuenta si va a entrar algo 👇`,
  `Ya te mostré todo lo que hay por ahora 🙌\nEscribile a ${secretaria} por WhatsApp y te cuenta si va a entrar algo 👇`,
];

// ---------------------------------------------------------------------------------------------
// Historias

export const cualDeLaHistoria = [
  '¿Por cuál auto de la historia me escribís? 👇\nDecime el número o el nombre (o "otro" si no está)',
  '¿Me contás por cuál auto de la historia me escribís? 😊👇\nPasame el número o el nombre (o "otro" si no está)',
];

export const corregirHistoria = [
  '¡Uy, perdón! 🙈 ¿Por cuál auto de la historia era entonces? 👇\nDecime el número o el nombre (o "otro" si no está)',
  'Perdón, me confundí 😅 ¿Cuál era el de la historia? 👇\nPasame el número o el nombre (o "otro" si no está)',
];

export const historiaNoEntendida = (cantidad: number) => [
  `Perdón, no me quedó claro cuál 😅 Decime el número (del 1 al ${cantidad}) o el nombre del auto`,
  `Mmm, no lo encontré 🤔 ¿Me pasás el número (del 1 al ${cantidad}) o el modelo?`,
];

export const historiaNinguno = [
  "Dale 😊 Mirá lo que tengo ahora 👇 Si no está, contame cuál era",
  "¡Sin problema! Te muestro lo que hay 👇 Si no lo ves, decime el modelo 😊",
];

// ---------------------------------------------------------------------------------------------
// Datos del negocio

/** Introduce los datos del negocio cuando hay alguno cargado. */
export const introNegocio = ["Dale, te cuento 😊", "Mirá, te cuento 😊", "Te cuento 😊"];

/** Un dato pendiente (null en negocio.ts) dentro de una respuesta con otros datos. */
export const temaPendiente = (tema: string, secretaria: string) => `Lo de ${tema} te lo confirma ${secretaria}`;

/** Todos los datos pedidos estan pendientes: no se inventa nada, se deriva. */
export const todoPendiente = (temas: string, secretaria: string) => [
  `Lo de ${temas} te lo confirma ${secretaria} por WhatsApp 💬 Tocá el botón y le escribís`,
  `Eso te lo confirma ${secretaria} 😊 Escribile por WhatsApp desde acá abajo 👇`,
];

export const cierreNegocio = (secretaria: string) => [
  `Si querés, ${secretaria} te pasa los detalles por WhatsApp 👇`,
  `Para los detalles, escribile a ${secretaria} por WhatsApp 👇`,
];

export const ubicacionConDireccion = (direccion: string, ciudad: string) => `Estamos en ${direccion}, ${ciudad} 📍`;
export const ubicacionSoloCiudad = (ciudad: string, secretaria: string) =>
  `Estamos en ${ciudad} 📍 la dirección exacta te la pasa ${secretaria}`;

// ---------------------------------------------------------------------------------------------
// Captacion de datos (secundaria)

export const pedirNombre = [
  "¡Dale, te aviso! 🙌 ¿Me pasás tu nombre?",
  "¡Buenísimo! 😊 ¿Cómo es tu nombre así te agendo?",
];

export const nombreInvalido = [
  'Perdón, ¿me pasás solo tu nombre? 😊 (o "cancelar" si preferís dejarlo)',
  '¿Cómo es tu nombre? 🙂 Si preferís dejarlo, decime "cancelar"',
];

export const pedirTelefono = (nombre: string) => [
  `Gracias ${nombre} 😊 ¿Y un teléfono para avisarte?`,
  `¡Genial, ${nombre}! 🙌 ¿Me pasás un número de teléfono?`,
];

export const telefonoInvalido = [
  "Mmm, ese número no me cierra 🤔 ¿Me lo pasás con la característica? Por ejemplo 3537 123456",
  '¿Me pasás el teléfono con característica? 🙂 (o "cancelar" si preferís dejarlo)',
];

export const leadListo = (nombre: string, secretaria: string) => [
  `¡Listo ${nombre}! 🙌 Le paso tus datos a ${secretaria} y te avisamos`,
  `¡Anotado, ${nombre}! 😊 ${secretaria} te escribe apenas haya novedades`,
];

export const captacionCancelada = [
  "Dale, sin problema 😊 Cualquier cosa me escribís por acá",
  "¡Listo, lo dejamos ahí! 👍 Si necesitás algo, acá estoy",
];

export const captacionAbandonada = (secretaria: string) => [
  `No pasa nada 😊 Si preferís, escribile directo a ${secretaria} por WhatsApp 👇`,
  `Dejemos así 🙂 Si querés, ${secretaria} te atiende por WhatsApp acá abajo 👇`,
];

// ---------------------------------------------------------------------------------------------
// Postulacion de vendedor (la deriva a Marcos, no a Nati)

export const postulacionIntro = (nombre: string | null) => {
  const n = nombre ? ` ${nombre}` : "";
  return [
    `¡Hola${n}! 🙌 Qué bueno que quieras sumarte al equipo. Te hago unas preguntas cortas y te dejo armado el mensaje para Marcos`,
    `¡Buenísimo${n}! 😊 Gracias por querer sumarte al equipo. Te hago unas preguntas rápidas y te dejo listo el mensaje para Marcos`,
  ];
};

export const postulacionRetoma = [
  "¡Dale, seguimos con tu postulación! 🙌",
  "¡Perfecto, retomamos tu postulación! 😊",
];

/** Una pregunta por dato, en el mismo orden en que las pide el motor. */
export const preguntaPostulacion: Record<CampoPostulacion, string[]> = {
  nombre: ["Para empezar, ¿cómo te llamás? 😊 (nombre y apellido)", "¿Me pasás tu nombre y apellido? 🙂"],
  edad: ["¿Qué edad tenés? 🙂", "¿Cuántos años tenés? 😊"],
  localidad: ["¿En qué localidad vivís? 📍", "¿De dónde sos? ¿En qué localidad vivís? 🙂"],
  telefono: [
    "¿Con qué número de WhatsApp te podemos contactar? 📱",
    "¿Me dejás un teléfono de contacto? 📱 Con característica, por ejemplo 3537 123456",
  ],
  experiencia_ventas: [
    "Contame tu experiencia en ventas 💼 ¿Dónde trabajaste y cuántos años?",
    "¿Tenés experiencia en ventas? 💼 Contame dónde y por cuánto tiempo",
  ],
  experiencia_rubro: [
    "¿Y en el rubro automotor? 🚗 Agencias, gestoría, lo que hayas hecho",
    "¿Trabajaste antes con autos o motos? 🚗 Agencias, gestoría, trámites…",
  ],
  financiaciones: [
    "¿Tenés conocimientos de financiaciones? 💳 Contame qué sabés (prendarios, bancos, etc.)",
    "¿Manejás algo de financiaciones? 💳 Créditos, prendarios, lo que sepas",
  ],
  disponibilidad: [
    "Última: ¿qué disponibilidad horaria tenés? 🕒",
    "Y para terminar, ¿qué horarios tenés disponibles? 🕒 ¿Jornada completa?",
  ],
};

/** Cuando una respuesta no sirve: el nombre y el telefono reusan los de la captacion de clientes. */
export const repreguntaPostulacion: Partial<Record<CampoPostulacion, string[]>> = {
  nombre: nombreInvalido,
  edad: [
    "Mmm, esa edad no me cierra 🤔 ¿Me la pasás con números? Por ejemplo 28",
    "¿Qué edad tenés? 🙂 Escribila con números, por ejemplo 28",
  ],
  localidad: [
    "¿En qué localidad vivís? 🙂 Con el nombre alcanza, por ejemplo Justiniano Posse",
    "No te entendí bien 😅 ¿De qué localidad sos?",
  ],
  telefono: telefonoInvalido,
};

/** La experiencia en ventas se conto sin decir cuanto tiempo: Marcos lo necesita. */
export const preguntaDuracion = [
  "¿Y cuánto tiempo fue? 🕒 Decime los años o meses",
  "¿Cuánto tiempo estuviste? ⏳ Años o meses, como te acuerdes",
];

/** Sueldo, comision, horario de trabajo: no lo define el bot. */
export const postulacionCondiciones = (reclutador: string) => [
  `Eso lo charlás directo con ${reclutador} 😉 Sigamos con tu postulación:`,
  `De eso se encarga ${reclutador} 🙂 Sigamos:`,
];

export const postulacionCancelada = [
  'Dale, sin problema 😊 Si querés retomar tu postulación, escribime "CV"',
  'Listo, lo dejamos acá 👍 Cuando quieras seguir, escribime "CV"',
];

/** Ya contesto todo y el mensaje esta armado: se le vuelve a mostrar el boton. */
export const postulacionYaArmada = (reclutador: string) => [
  `Ya tengo armado tu mensaje para ${reclutador} 😊 Tocá el botón y enviáselo por WhatsApp 👇`,
  `¡Tu mensaje para ${reclutador} ya está listo! 🙌 Tocá el botón y mandáselo por WhatsApp 👇`,
];

export const postulacionListo = (nombre: string, reclutador: string) => [
  `¡Listo ${nombre}! 🙌 Armé tu mensaje para ${reclutador} con todos tus datos. Tocá el botón, adjuntá tu CV y enviáselo por WhatsApp 👇`,
  `¡Anotado, ${nombre}! 😊 Ya dejé listo tu mensaje para ${reclutador}. Tocá el botón de abajo, adjuntá tu CV y mandáselo por WhatsApp 👇`,
];

export const postulacionSinNombre = (reclutador: string) => [
  `No pude armar tu postulación sin tu nombre 😕 Escribile directo a ${reclutador} por WhatsApp y mandale tu CV 👇`,
  `Sin tu nombre no puedo armar el mensaje 😅 Pero podés escribirle directo a ${reclutador} por WhatsApp y mandarle tu CV 👇`,
];

/** El CV en archivo no entra por Instagram: se manda a Marcos por WhatsApp. */
export const postulacionAdjunto = (reclutador: string) => [
  `Por acá no puedo recibir archivos ni fotos 😅 Mandale tu CV a ${reclutador} por WhatsApp 👇 y seguimos con tus datos cuando quieras`,
  `Los archivos no me llegan bien por acá 🙂 Mandale tu CV a ${reclutador} por WhatsApp 👇 y después seguimos con tu postulación`,
];

/** Respaldo si Instagram rechaza la tarjeta: el link con todo el mensaje es muy largo para ir en un texto. */
export const contactoReclutadorEnTexto = (reclutador: string, numeroVisible: string) =>
  `Escribile a ${reclutador} por WhatsApp al ${numeroVisible} y mandale tu CV 💬`;
