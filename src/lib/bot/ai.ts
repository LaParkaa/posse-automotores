import { buildSystemPrompt } from "./prompt";
import type { LeadInput, RespuestaIA, TurnoHistorial } from "./types";

const BASE_URL_POR_DEFECTO = "https://api.groq.com/openai/v1";
// Los DMs son cortos; limitar la salida tambien ahorra cuota.
const MAX_TOKENS = 500;
// Una vez reclamado el mensaje, una funcion que el hosting corta se lo come para siempre
// (el reintento de Meta se descarta como duplicado): el peor caso (modelo + envio por Graph)
// tiene que terminar con la respuesta o con la disculpa dentro de la ventana de ~20 s de Meta.
const TIMEOUT_MS = 10_000;

export const CONFIRMACION_LEAD =
  "¡Genial! Ya pasé tus datos, un vendedor te va a contactar a la brevedad 🙌";
export const RESPUESTA_VACIA = "Perdón, tuve un problema para responderte. ¿Me repetís la consulta?";
// Los modelos chicos a veces arman mal los argumentos de la herramienta. Si el texto que
// escribieron dice "ya te anoto", el cliente creeria que quedo guardado: se descarta y se piden de nuevo.
export const LEAD_INCOMPLETO =
  "Perdón, no llegué a anotar bien tus datos. ¿Me pasás de nuevo tu nombre y un teléfono de contacto?";

export const TOOL_GUARDAR_LEAD = {
  type: "function",
  function: {
    name: "guardar_lead",
    description:
      "Guarda los datos de contacto de un cliente interesado para que un vendedor lo contacte. Usala UNA sola vez, cuando el cliente ya te dio su nombre y un teléfono y mostró interés real en comprar.",
    parameters: {
      type: "object",
      properties: {
        nombre: { type: "string", description: "Nombre del cliente" },
        telefono: { type: "string", description: "Teléfono de contacto del cliente" },
        vehiculo_interes: { type: "string", description: "Vehículo o tipo de vehículo que le interesa" },
        mensaje: { type: "string", description: "Resumen breve de lo que busca (máx. 200 caracteres)" },
      },
      required: ["nombre", "telefono"],
    },
  },
} as const;

type LlamadaHerramienta = { function?: { name?: string; arguments?: string } };

/** Mensaje del asistente tal como lo devuelve una API compatible con OpenAI. */
export type MensajeModelo = {
  content?: string | null;
  tool_calls?: LlamadaHerramienta[] | null;
};

function parsearArgumentos(json: string | undefined): unknown {
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function validarLead(input: unknown): LeadInput | null {
  if (typeof input !== "object" || input === null) return null;

  const { nombre, telefono, vehiculo_interes, mensaje } = input as Record<string, unknown>;
  if (typeof nombre !== "string" || nombre.trim() === "") return null;
  if (typeof telefono !== "string" || telefono.trim() === "") return null;

  return {
    nombre: nombre.trim(),
    telefono: telefono.trim(),
    vehiculo_interes: typeof vehiculo_interes === "string" ? vehiculo_interes.trim() : undefined,
    mensaje: typeof mensaje === "string" ? mensaje.trim() : undefined,
  };
}

/**
 * Convierte la respuesta del modelo en texto para el cliente y, si corresponde, un lead.
 * Como el lead se guarda sin volver a llamar al modelo, el texto de confirmacion tiene
 * que venir en esta misma respuesta; si el modelo no lo escribio, usamos uno fijo.
 */
export function extraerRespuesta(mensaje: MensajeModelo): RespuestaIA {
  const texto = (mensaje.content ?? "").trim();

  const llamada = (mensaje.tool_calls ?? []).find((c) => c.function?.name === "guardar_lead");
  if (!llamada) return { texto: texto || RESPUESTA_VACIA, lead: null };

  const lead = validarLead(parsearArgumentos(llamada.function?.arguments));
  if (!lead) return { texto: LEAD_INCOMPLETO, lead: null };

  return { texto: texto || CONFIRMACION_LEAD, lead };
}

export async function responderIA(entrada: {
  stockTexto: string;
  historial: TurnoHistorial[];
}): Promise<RespuestaIA> {
  const apiKey = process.env.LLM_API_KEY;
  const modelo = process.env.LLM_MODEL;
  if (!apiKey) throw new Error("Falta la variable de entorno LLM_API_KEY");
  if (!modelo) throw new Error("Falta la variable de entorno LLM_MODEL");

  const baseUrl = (process.env.LLM_BASE_URL?.trim() || BASE_URL_POR_DEFECTO).replace(/\/+$/, "");

  const respuesta = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelo,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "system", content: buildSystemPrompt(entrada.stockTexto) }, ...entrada.historial],
      tools: [TOOL_GUARDAR_LEAD],
      tool_choice: "auto",
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!respuesta.ok) {
    // Ej. 429 cuando se agota la cuota gratis: el handler lo convierte en una disculpa + WhatsApp.
    const detalle = await respuesta.text().catch(() => "");
    throw new Error(`LLM ${respuesta.status}: ${detalle.slice(0, 300)}`);
  }

  const datos = (await respuesta.json()) as { choices?: Array<{ message?: MensajeModelo }> };
  const mensaje = datos.choices?.[0]?.message;
  if (!mensaje) throw new Error("La respuesta del modelo no trae choices[0].message");

  return extraerRespuesta(mensaje);
}
