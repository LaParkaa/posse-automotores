import { createBrowserClient } from "@supabase/ssr";

type BrowserClient = ReturnType<typeof createBrowserClient>;

let cliente: BrowserClient | null = null;

/**
 * Cliente anon para el navegador, compartido por todas las suscripciones.
 * Devuelve null si el entorno no tiene configurado Supabase, para que las
 * vistas sigan mostrando los datos que renderizó el servidor.
 */
export function getBrowserSupabase(): BrowserClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  if (!cliente) cliente = createBrowserClient(url, anonKey);
  return cliente;
}
