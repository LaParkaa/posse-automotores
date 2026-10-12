import { crearDeps } from "@/lib/bot/deps";
import { procesarEventos } from "@/lib/bot/handler";
import { extraerEventos } from "@/lib/instagram/payload";
import { verificarFirmaConAlgunSecret } from "@/lib/instagram/signature";

export const runtime = "nodejs"; // usa node:crypto
export const dynamic = "force-dynamic";
// Tope de duracion de la funcion en Vercel. El maximo permitido depende del plan del proyecto
// (verificarlo en los ajustes de Vercel): si el plan permite menos de 25 s, rige el del plan.
export const maxDuration = 25;

/**
 * Verificacion del webhook: al configurarlo en Meta, hace un GET con un desafio
 * (hub.challenge) y espera que se lo devolvamos si el token coincide.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const tokenEsperado = process.env.IG_VERIFY_TOKEN;

  const valido =
    Boolean(tokenEsperado) &&
    params.get("hub.mode") === "subscribe" &&
    params.get("hub.verify_token") === tokenEsperado;

  if (!valido) return new Response("Forbidden", { status: 403 });

  return new Response(params.get("hub.challenge") ?? "", { status: 200 });
}

/** Recibe los mensajes de Instagram. Con firma valida siempre devuelve 200 para que Meta no reintente. */
export async function POST(request: Request) {
  // Puede traer varios secrets separados por comas; una lista sin ninguno cuenta como no configurada.
  const appSecret = process.env.IG_APP_SECRET;
  if (!appSecret || appSecret.split(",").every((s) => s.trim() === "")) {
    console.error("[instagram] Falta la variable de entorno IG_APP_SECRET");
    return new Response("Server misconfigured", { status: 500 });
  }

  // La firma se calcula sobre el texto exacto: hay que leerlo crudo antes de parsear.
  const cuerpo = await request.text();
  if (!verificarFirmaConAlgunSecret(cuerpo, request.headers.get("x-hub-signature-256"), appSecret)) {
    return new Response("Invalid signature", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(cuerpo);
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  try {
    await procesarEventos(extraerEventos(payload), crearDeps());
  } catch (err) {
    // crearDeps() puede lanzar si falta la config de Supabase. Se loguea y se responde 200 igual.
    console.error("[instagram] Error inesperado en el webhook:", err);
  }

  return new Response("EVENT_RECEIVED", { status: 200 });
}
