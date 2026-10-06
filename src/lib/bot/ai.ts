import Anthropic from "@anthropic-ai/sdk";
import { buildSystemBlocks } from "./prompt";
import type { LeadInput, RespuestaIA, TurnoHistorial } from "./types";

const MODELO = "claude-haiku-4-5-20251001";
// Los DMs son cortos; limitar la salida tambien ahorra tokens.
const MAX_TOKENS = 500;

export const CONFIRMACION_LEAD =
  "¡Genial! Ya pasé tus datos, un vendedor te va a contactar a la brevedad 🙌";
export const RESPUESTA_VACIA = "Perdón, tuve un problema para responderte. ¿Me repetís la consulta?";

export const TOOL_GUARDAR_LEAD: Anthropic.Messages.Tool = {
  name: "guardar_lead",
  description:
    "Guarda los datos de contacto de un cliente interesado para que un vendedor lo contacte. Usala UNA sola vez, cuando el cliente ya te dio su nombre y un teléfono y mostró interés real en comprar.",
  input_schema: {
    type: "object",
    properties: {
      nombre: { type: "string", description: "Nombre del cliente" },
      telefono: { type: "string", description: "Teléfono de contacto del cliente" },
      vehiculo_interes: { type: "string", description: "Vehículo o tipo de vehículo que le interesa" },
      mensaje: { type: "string", description: "Resumen breve de lo que busca (máx. 200 caracteres)" },
    },
    required: ["nombre", "telefono"],
  },
};

type BloqueModelo = { type: string; text?: string; name?: string; input?: unknown };

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
 * Como el lead se guarda sin volver a llamar a Claude, el texto de confirmacion tiene
 * que venir en esta misma respuesta; si el modelo no lo escribio, usamos uno fijo.
 */
export function extraerRespuesta(content: BloqueModelo[]): RespuestaIA {
  const texto = content
    .filter((bloque) => bloque.type === "text" && typeof bloque.text === "string")
    .map((bloque) => (bloque.text as string).trim())
    .filter((fragmento) => fragmento !== "")
    .join("\n");

  const llamada = content.find((b) => b.type === "tool_use" && b.name === "guardar_lead");
  const lead = llamada ? validarLead(llamada.input) : null;

  return { texto: texto || (lead ? CONFIRMACION_LEAD : RESPUESTA_VACIA), lead };
}

let cliente: Anthropic | null = null;

// Se crea recien al primer uso para que importar el modulo no exija la API key.
function getCliente(): Anthropic {
  cliente ??= new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    // En serverless no podemos esperar los 10 minutos por defecto del SDK.
    timeout: 15_000,
    maxRetries: 1,
  });
  return cliente;
}

export async function responderIA(entrada: {
  stockTexto: string;
  historial: TurnoHistorial[];
}): Promise<RespuestaIA> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("Falta la variable de entorno ANTHROPIC_API_KEY");
  }

  const respuesta = await getCliente().messages.create({
    model: MODELO,
    max_tokens: MAX_TOKENS,
    system: buildSystemBlocks(entrada.stockTexto),
    tools: [TOOL_GUARDAR_LEAD],
    messages: entrada.historial,
  });

  return extraerRespuesta(respuesta.content);
}
