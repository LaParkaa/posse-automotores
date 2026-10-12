import { createServerClient as createSSRServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { fetchConTope } from "./bot/fetch-con-tope";

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export async function createServerClient() {
  const cookieStore = await cookies();
  return createSSRServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Server Component — writes handled by middleware
        }
      },
    },
  });
}

export function createAdminSupabaseClient() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

// Tope por consulta del bot: deja margen dentro de los ~20 s de Meta para el resto del turno.
const TOPE_CONSULTA_BOT_MS = 6000;

/** Cliente de servicio del webhook de Instagram: igual al admin, pero cada consulta tiene tope de tiempo. */
export function createBotSupabaseClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    global: { fetch: fetchConTope(TOPE_CONSULTA_BOT_MS) },
  });
}
