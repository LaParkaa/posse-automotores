import type { EventoEntrante } from "../instagram/payload";
import { conversar } from "./motor";
import { type Negocio, NEGOCIO } from "./negocio";
import { type Sesion, sesionNueva } from "./sesion";
import type { LeadInput, MensajeSalida, Perfil, Tarjeta, VehiculoCatalogo } from "./types";

// Textos fijos de emergencia: no pasan por el motor, asi que cumplen solos las reglas de tono
// (cortos, sin markdown, rioplatenses) y no afirman ser una persona. Siempre dan una salida: el WhatsApp.
export const MENSAJE_ERROR_TECNICO = `Uy, se me complicó algo de mi lado 😅 Probá de nuevo en un rato o escribile directo a Nati por WhatsApp al ${NEGOCIO.whatsappVisible}.`;
export const MENSAJE_LEAD_FALLIDO = `No pude dejar anotados tus datos 😕 Escribile directo a Nati por WhatsApp al ${NEGOCIO.whatsappVisible} y te atiende ella.`;

// Parametros de la demora de "escribiendo...": que se note humano sin hacer esperar de mas.
const ESPERA_ECO_MS = 3000;
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

  // Si la consulta falla, la excepcion sale sin pausar: ante la duda es mejor seguir atendiendo.
  if (await deps.esMidPropio(mid)) return;

  // El mid no es nuestro: escribio una persona desde la cuenta. El bot se calla para no pisarla.
  const horas = deps.negocio.pausaHumanoHoras;
  await deps.pausar(destinatarioId, new Date(deps.ahora().getTime() + horas * 60 * 60 * 1000));
}

type Mensaje = Extract<EventoEntrante, { tipo: "mensaje" }>;

async function procesarMensaje(evento: Mensaje, deps: DepsBot): Promise<void> {
  const { senderId, mid, texto, historiaId, adjuntos } = evento;

  if (!(await deps.reclamarMensaje(senderId, mid, texto ?? "[adjunto]"))) return;

  const chat = await deps.cargarChat(senderId);
  const ahora = deps.ahora();
  // Con la pausa vigente habla una persona: el mensaje queda registrado pero el bot no contesta.
  if (chat.pausaHasta && chat.pausaHasta.getTime() > ahora.getTime()) return;

  // Nada de esto debe retrasar ni romper la respuesta: se pide todo junto y solo el catalogo es imprescindible.
  const [, catalogoR, historiaR, perfilR] = await Promise.allSettled([
    deps.marcarVisto(senderId),
    deps.catalogo(),
    historiaId ? deps.vehiculoDeHistoria(historiaId) : Promise.resolve(null),
    chat.perfil ? Promise.resolve(null) : deps.obtenerPerfil(senderId),
  ]);

  const catalogo = catalogoR.status === "fulfilled" ? catalogoR.value : null;
  if (catalogoR.status === "rejected") console.error("[bot] No se pudo leer el catalogo:", catalogoR.reason);
  if (!catalogo) {
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

  const resultado = conversar({
    texto,
    adjuntos,
    historiaId,
    vehiculoDeHistoria,
    mid,
    sesion: chat.sesion ?? sesionNueva(ahora),
    catalogo,
    perfil: chat.perfil ?? perfilNuevo,
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
      await deps.guardarLead(senderId, resultado.lead);
    } catch (err) {
      console.error(`[bot] No se pudo guardar el lead de ${senderId}:`, err);
      // La respuesta del motor confirma que Nati va a llamar; si el lead no quedo guardado seria mentira.
      mensajes = [{ tipo: "texto", texto: MENSAJE_LEAD_FALLIDO }];
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

  await enviarMensajes(senderId, mensajes, deps);
}

/**
 * Envia de a un mensaje con su "escribiendo...". Los mid de lo enviado se guardan SIEMPRE (aunque
 * un envio posterior falle): son los que permiten reconocer el eco propio y no pausar el bot.
 */
async function enviarMensajes(senderId: string, mensajes: MensajeSalida[], deps: DepsBot): Promise<void> {
  const partes: Parte[] = [];
  let esperado = 0;

  try {
    for (const mensaje of mensajes) {
      const base = mensaje.tipo === "texto" ? 400 + 12 * mensaje.texto.length : DEMORA_TARJETAS_MS;
      // Tope por turno: tres mensajes largos no pueden hacer esperar al cliente casi 4 segundos.
      const demora = Math.min(DEMORA_MAXIMA_MENSAJE_MS, base, DEMORA_MAXIMA_TURNO_MS - esperado);
      await mejorEsfuerzo("mostrar 'escribiendo'", () => deps.escribiendo(senderId));
      if (demora > 0) {
        await deps.esperar(demora);
        esperado += demora;
      }

      if (mensaje.tipo === "texto") {
        partes.push(...aPartes(mensaje.texto, await deps.enviarTexto(senderId, mensaje.texto)));
        continue;
      }

      try {
        partes.push(...aPartes(mensaje.alternativaTexto, await deps.enviarTarjetas(senderId, mensaje.tarjetas)));
      } catch (err) {
        // Instagram rechaza tarjetas por detalles (imagen no accesible, formato...): se avisa en texto plano.
        console.error(`[bot] Instagram rechazo las tarjetas para ${senderId}: ${motivo(err)}`);
        if (mensaje.alternativaTexto.trim() === "") continue;
        partes.push(...aPartes(mensaje.alternativaTexto, await deps.enviarTexto(senderId, mensaje.alternativaTexto)));
      }
    }
  } finally {
    if (partes.length > 0) {
      await mejorEsfuerzo("guardar la salida", () => deps.guardarSalida(senderId, partes));
    }
  }
}

/** Una fila por message_id (un texto largo se parte en varios). Sin id igual se guarda el texto, con mid null. */
function aPartes(texto: string, mids: string[]): Parte[] {
  if (mids.length === 0) return [{ texto, mid: null }];
  return mids.map((mid, i) => ({ texto: i === 0 ? texto : "(continuación)", mid }));
}

/** Manda un texto fijo y lo registra como salida propia: sin eso, su eco pausaria el chat 6 horas. */
async function enviarTecnico(senderId: string, texto: string, deps: DepsBot): Promise<void> {
  const mids = await deps.enviarTexto(senderId, texto);
  await mejorEsfuerzo("guardar la salida", () => deps.guardarSalida(senderId, aPartes(texto, mids)));
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
