import type { EventoEntrante } from "../instagram/payload";
import { conversar } from "./motor";
import { type Negocio, NEGOCIO } from "./negocio";
import { tarjetaContacto } from "./respuestas";
import { type Sesion, sesionNueva } from "./sesion";
import { contactoEnTexto } from "./textos";
import type { LeadInput, MensajeSalida, Perfil, Tarjeta, VehiculoCatalogo } from "./types";

// Textos fijos de emergencia: no pasan por el motor, asi que cumplen solos las reglas de tono
// (cortos, sin markdown, rioplatenses) y no afirman ser una persona. Siempre dan una salida: el WhatsApp.
export const MENSAJE_ERROR_TECNICO = `Uy, se me complicó algo de mi lado 😅 Probá de nuevo en un rato o escribile directo a Nati por WhatsApp al ${NEGOCIO.whatsappVisible}.`;
export const MENSAJE_LEAD_FALLIDO = `No pude dejar anotados tus datos 😕 Escribile directo a Nati por WhatsApp al ${NEGOCIO.whatsappVisible} y te atiende ella.`;

// Parametros de la demora de "escribiendo...": que se note humano sin hacer esperar de mas.
const ESPERA_ECO_MS = 3000;
// Segunda chance antes de pausar: si el guardado de los mid propios se demoro, el eco no es de una persona.
const ESPERA_ECO_REINTENTO_MS = 4000;
// Presupuesto del turno: Vercel corta a los 25 s y Meta deja de esperar el webhook a los ~20 s.
const PASADO_EL_PRESUPUESTO_MS = 12_000;
const ESPERA_MAXIMA_VISTO_MS = 1500;
const DEMORA_TARJETAS_MS = 900;
const DEMORA_MAXIMA_MENSAJE_MS = 1200;
const DEMORA_MAXIMA_TURNO_MS = 3000;

/** Todo lo que toca red o base de datos entra por aca, asi el flujo se testea sin ninguna de las dos. */
export type DepsBot = {
  reclamarMensaje(senderId: string, mid: string, contenido: string): Promise<boolean>;
  cargarChat(senderId: string): Promise<{ sesion: Sesion | null; pausaHasta: Date | null; perfil: Perfil | null }>;
  guardarSesion(senderId: string, sesion: Sesion): Promise<void>;
  catalogo(): Promise<VehiculoCatalogo[] | null>;
  vehiculoDeHistoria(storyId: string): Promise<string | null>;
  aprenderHistoria(storyId: string, vehiculoId: string): Promise<void>;
  olvidarHistoria(storyId: string): Promise<void>;
  obtenerPerfil(senderId: string): Promise<Perfil | null>; // mejor esfuerzo
  guardarPerfil(senderId: string, perfil: Perfil): Promise<void>;
  guardarLead(senderId: string, lead: LeadInput): Promise<void>;
  marcarVisto(senderId: string): Promise<void>; // mejor esfuerzo
  escribiendo(senderId: string): Promise<void>; // mejor esfuerzo
  enviarTexto(senderId: string, texto: string): Promise<string[]>; // lanza si falla; devuelve message_ids
  enviarTarjetas(senderId: string, tarjetas: Tarjeta[]): Promise<string[]>; // lanza si falla
  guardarSalida(senderId: string, partes: Array<{ texto: string; mid: string | null }>): Promise<void>;
  marcarNoEntendido(mid: string): Promise<void>;
  esMidPropio(mid: string): Promise<boolean>;
  pausar(senderId: string, hasta: Date): Promise<void>;
  esperar(ms: number): Promise<void>;
  ahora(): Date;
  siteUrl: string;
  negocio: Negocio;
};

type Parte = { texto: string; mid: string | null };

/**
 * Procesa un lote de eventos en orden y nunca lanza: un evento que falla no puede
 * frenar a los demas ni tumbar el webhook (Meta reintentaria el lote entero).
 */
export async function procesarEventos(eventos: EventoEntrante[], deps: DepsBot): Promise<void> {
  for (const evento of eventos) {
    try {
      if (evento.tipo === "eco") await procesarEco(evento.destinatarioId, evento.mid, deps);
      else await procesarMensaje(evento, deps);
    } catch (err) {
      console.error(`[bot] Error procesando el evento ${evento.mid}:`, err);
      // Un eco no tiene a quien avisar: el destinatario es el cliente y no escribio nada.
      if (evento.tipo === "mensaje") await avisarError(evento.senderId, deps);
    }
  }
}

async function procesarEco(destinatarioId: string, mid: string, deps: DepsBot): Promise<void> {
  // Meta puede entregar el eco antes de que el bot haya guardado los mid de lo que acaba de enviar:
  // sin esta espera se confundiria un mensaje propio con una persona y se pausaria el bot de mas.
  await deps.esperar(ESPERA_ECO_MS);

  try {
    if (await deps.esMidPropio(mid)) return;
    // Pausar silencia el chat horas: antes de hacerlo se vuelve a mirar, por si el guardado llego tarde.
    await deps.esperar(ESPERA_ECO_REINTENTO_MS);
    if (await deps.esMidPropio(mid)) return;
  } catch (err) {
    // Sin poder consultar no se sabe si fue una persona: ante la duda es mejor seguir atendiendo.
    console.error(`[bot] No se pudo decidir si el eco ${mid} es propio, no se pausa:`, err);
    return;
  }

  // El mid no es nuestro: escribio una persona desde la cuenta. El bot se calla para no pisarla.
  // Se loguea solo un id enmascarado y el mid: nunca el texto del cliente.
  console.info("[bot] Pausa por mensaje humano", { chat: `${destinatarioId.slice(0, 3)}…`, mid });
  const horas = deps.negocio.pausaHumanoHoras;
  await deps.pausar(destinatarioId, new Date(deps.ahora().getTime() + horas * 60 * 60 * 1000));
}

type Mensaje = Extract<EventoEntrante, { tipo: "mensaje" }>;

async function procesarMensaje(evento: Mensaje, deps: DepsBot): Promise<void> {
  const { senderId, mid, texto, historiaId, adjuntos } = evento;
  const inicio = deps.ahora().getTime();

  if (!(await deps.reclamarMensaje(senderId, mid, texto ?? "[adjunto]"))) return;

  const chat = await deps.cargarChat(senderId);
  const ahora = deps.ahora();
  // Con la pausa vigente habla una persona: el mensaje queda registrado pero el bot no contesta.
  if (chat.pausaHasta && chat.pausaHasta.getTime() > ahora.getTime()) return;

  // Nada de esto debe retrasar ni romper la respuesta: se pide todo junto y solo el catalogo es imprescindible.
  // "Visto" arranca ya pero no entra en el allSettled: no debe demorar la lectura del catalogo ni al motor.
  const visto = marcarVistoAcotado(senderId, deps);
  const [catalogoR, historiaR, perfilR] = await Promise.allSettled([
    deps.catalogo(),
    historiaId ? deps.vehiculoDeHistoria(historiaId) : Promise.resolve(null),
    chat.perfil ? Promise.resolve(null) : deps.obtenerPerfil(senderId),
  ]);

  const catalogo = catalogoR.status === "fulfilled" ? catalogoR.value : null;
  if (catalogoR.status === "rejected") console.error("[bot] No se pudo leer el catalogo:", catalogoR.reason);
  if (!catalogo) {
    await visto;
    await enviarTecnico(senderId, MENSAJE_ERROR_TECNICO, deps);
    return;
  }

  // Sin vinculo conocido el motor le pregunta al cliente de que auto era la historia.
  const vehiculoDeHistoria = historiaR.status === "fulfilled" ? historiaR.value : null;
  const perfilNuevo = perfilR.status === "fulfilled" ? perfilR.value : null;
  if (perfilNuevo) {
    try {
      await deps.guardarPerfil(senderId, perfilNuevo);
    } catch (err) {
      console.error(`[bot] No se pudo guardar el perfil de ${senderId}:`, err);
    }
  }

  const perfil = chat.perfil ?? perfilNuevo;
  const resultado = conversar({
    texto,
    adjuntos,
    historiaId,
    vehiculoDeHistoria,
    mid,
    sesion: chat.sesion ?? sesionNueva(ahora),
    catalogo,
    perfil,
    ahora,
    siteUrl: deps.siteUrl,
    negocio: deps.negocio,
  });

  if (!resultado.responder) {
    await guardarSesionSegura(senderId, resultado.sesion, deps);
    return;
  }

  let mensajes = resultado.mensajes;

  if (resultado.lead) {
    try {
      await deps.guardarLead(senderId, conUsuario(resultado.lead, perfil));
    } catch (err) {
      console.error(`[bot] No se pudo guardar el lead de ${senderId}:`, err);
      // La respuesta del motor confirma que Nati va a llamar; si el lead no quedo guardado seria mentira.
      // Se agrega el boton de Nati porque es la unica salida que le queda al cliente.
      const tarjeta = tarjetaContacto(null, { negocio: deps.negocio, siteUrl: deps.siteUrl });
      mensajes = [
        { tipo: "texto", texto: MENSAJE_LEAD_FALLIDO },
        {
          tipo: "tarjetas",
          tarjetas: [tarjeta],
          alternativaTexto: contactoEnTexto(deps.negocio.secretaria, tarjeta.botones[0].url),
        },
      ];
    }
  }

  // El vinculo historia -> auto es una mejora para la proxima vez: si falla, la respuesta sale igual.
  if (resultado.aprenderHistoria) {
    const { storyId, vehiculoId } = resultado.aprenderHistoria;
    await mejorEsfuerzo("aprender la historia", () => deps.aprenderHistoria(storyId, vehiculoId));
  }
  if (resultado.olvidarHistoria) {
    const storyId = resultado.olvidarHistoria;
    await mejorEsfuerzo("olvidar la historia", () => deps.olvidarHistoria(storyId));
  }

  await guardarSesionSegura(senderId, resultado.sesion, deps);
  if (resultado.noEntendido) await mejorEsfuerzo("marcar el mensaje como no entendido", () => deps.marcarNoEntendido(mid));

  await visto;
  await enviarMensajes(senderId, mensajes, inicio, deps);
}

/** El @usuario va en el mensaje del lead para que quien atienda pueda encontrar a la persona en Instagram. */
function conUsuario(lead: LeadInput, perfil: Perfil | null): LeadInput {
  const usuario = perfil?.usuario?.trim();
  if (!usuario) return lead;
  return { ...lead, mensaje: lead.mensaje ? `${lead.mensaje} (@${usuario})` : `@${usuario}` };
}

/**
 * Pide el "visto" sin lanzar y sin esperar mas de 1,5 s: el llamador lo espera justo antes de
 * enviar (para que el visto llegue primero) pero un Meta lento no puede comerse el turno.
 */
function marcarVistoAcotado(senderId: string, deps: DepsBot): Promise<void> {
  const pedido = mejorEsfuerzo("marcar el chat como visto", () => deps.marcarVisto(senderId));
  return new Promise((resolver) => {
    const timer = setTimeout(resolver, ESPERA_MAXIMA_VISTO_MS);
    void pedido.then(() => {
      clearTimeout(timer);
      resolver();
    });
  });
}

/**
 * Envia de a un mensaje con su "escribiendo...". Los mid de CADA envio se guardan apenas sale (antes
 * de la demora del siguiente): Meta devuelve el eco enseguida y, si el mid no esta guardado cuando se
 * lo consulta, se tomaria un mensaje propio por una persona y se silenciaria el chat.
 */
async function enviarMensajes(senderId: string, mensajes: MensajeSalida[], inicio: number, deps: DepsBot): Promise<void> {
  let esperado = 0;

  for (const mensaje of mensajes) {
    // Pasado el presupuesto del turno ya no se hace esperar al cliente: los mensajes salen sin adorno.
    if (deps.ahora().getTime() - inicio <= PASADO_EL_PRESUPUESTO_MS) {
      const base = mensaje.tipo === "texto" ? 400 + 12 * mensaje.texto.length : DEMORA_TARJETAS_MS;
      // Tope por turno: tres mensajes largos no pueden hacer esperar al cliente casi 4 segundos.
      const demora = Math.min(DEMORA_MAXIMA_MENSAJE_MS, base, DEMORA_MAXIMA_TURNO_MS - esperado);
      if (demora > 0) {
        await mostrarEscribiendo(senderId, demora, deps);
        esperado += demora;
      }
    }

    if (mensaje.tipo === "texto") {
      await enviarTextoRegistrado(senderId, mensaje.texto, deps);
      continue;
    }

    try {
      const mids = await deps.enviarTarjetas(senderId, mensaje.tarjetas);
      await registrarSalida(senderId, mensaje.alternativaTexto, mids, deps);
    } catch (err) {
      // Instagram rechaza tarjetas por detalles (imagen no accesible, formato...): se avisa en texto plano.
      console.error(`[bot] Instagram rechazo las tarjetas para ${senderId}: ${motivo(err)}`);
      if (mensaje.alternativaTexto.trim() === "") continue;
      await enviarTextoRegistrado(senderId, mensaje.alternativaTexto, deps);
    }
  }
}

/** "Escribiendo..." mientras corre la demora, no antes: y nunca dura mas que ella aunque Meta no conteste. */
async function mostrarEscribiendo(senderId: string, demora: number, deps: DepsBot): Promise<void> {
  const espera = deps.esperar(demora);
  const escribiendo = mejorEsfuerzo("mostrar 'escribiendo'", () => deps.escribiendo(senderId));
  await Promise.all([espera, Promise.race([escribiendo, espera])]);
}

/** Envia un texto y lo registra enseguida; si salio a medias, registra igual lo que si se entrego. */
async function enviarTextoRegistrado(senderId: string, texto: string, deps: DepsBot): Promise<void> {
  let mids: string[];
  try {
    mids = await deps.enviarTexto(senderId, texto);
  } catch (err) {
    const parciales = idsEntregados(err);
    if (parciales.length > 0) await registrarSalida(senderId, texto, parciales, deps);
    throw err;
  }
  await registrarSalida(senderId, texto, mids, deps);
}

async function registrarSalida(senderId: string, texto: string, mids: string[], deps: DepsBot): Promise<void> {
  await mejorEsfuerzo("guardar la salida", () => deps.guardarSalida(senderId, aPartes(texto, mids)));
}

/** Ids de las partes ya entregadas cuando un texto largo fallo a mitad de camino (ver ErrorEnvioParcial). */
function idsEntregados(err: unknown): string[] {
  const ids = (err as { ids?: unknown } | null)?.ids;
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
}

/** Una fila por message_id (un texto largo se parte en varios). Sin id igual se guarda el texto, con mid null. */
function aPartes(texto: string, mids: string[]): Parte[] {
  if (mids.length === 0) return [{ texto, mid: null }];
  return mids.map((mid, i) => ({ texto: i === 0 ? texto : "(continuación)", mid }));
}

/** Manda un texto fijo y lo registra como salida propia: sin eso, su eco pausaria el chat 6 horas. */
async function enviarTecnico(senderId: string, texto: string, deps: DepsBot): Promise<void> {
  await enviarTextoRegistrado(senderId, texto, deps);
}

async function avisarError(senderId: string, deps: DepsBot): Promise<void> {
  try {
    await enviarTecnico(senderId, MENSAJE_ERROR_TECNICO, deps);
  } catch (err) {
    console.error(`[bot] No se pudo avisar el error a ${senderId}:`, err);
  }
}

async function guardarSesionSegura(senderId: string, sesion: Sesion, deps: DepsBot): Promise<void> {
  await mejorEsfuerzo("guardar la sesion", () => deps.guardarSesion(senderId, sesion));
}

/** Para lo que no puede romper la respuesta al cliente: se registra el fallo y se sigue. */
async function mejorEsfuerzo(que: string, accion: () => Promise<unknown>): Promise<void> {
  try {
    await accion();
  } catch (err) {
    console.error(`[bot] No se pudo ${que}:`, err);
  }
}

/** Razon de un fallo de envio sin tokens ni URLs: el mensaje de Graph puede traer ambos. */
function motivo(err: unknown): string {
  const texto = err instanceof Error ? err.message : String(err);
  return texto.replace(/Bearer\s+\S+/gi, "[token]").replace(/https?:\/\/\S+/gi, "[url]").slice(0, 200);
}
