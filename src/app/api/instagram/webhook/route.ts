import { crearDeps } from "@/lib/bot/deps";
import { procesarMensajes } from "@/lib/bot/handler";
import { extraerMensajes } from "@/lib/instagram/payload";
import { verificarFirma } from "@/lib/instagram/signature";

export const runtime = "nodejs"; // usa node:crypto
export const dynamic = "force-dynamic";
// Es solo una sugerencia: que se respete depende de la plataforma de despliegue. El limite real
// en Netlify es el timeout de funciones configurado para el sitio (verificarlo en los ajustes de Netlify).
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
  const appSecret = process.env.IG_APP_SECRET;
  if (!appSecret) {
    console.error("[instagram] Falta la variable de entorno IG_APP_SECRET");
    return new Response("Server misconfigured", { status: 500 });
  }

  // La firma se calcula sobre el texto exacto: hay que leerlo crudo antes de parsear.
  const cuerpo = await request.text();
  if (!verificarFirma(cuerpo, request.headers.get("x-hub-signature-256"), appSecret)) {
    return new Response("Invalid signature", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(cuerpo);
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  try {
    await procesarMensajes(extraerMensajes(payload), crearDeps());
  } catch (err) {
    // crearDeps() puede lanzar si falta la config de Supabase. Se loguea y se responde 200 igual.
    console.error("[instagram] Error inesperado en el webhook:", err);
  }

  return new Response("EVENT_RECEIVED", { status: 200 });
}
