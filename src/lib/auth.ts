import { redirect } from "next/navigation";
import { createServerClient, isSupabaseConfigured } from "./supabase";

export async function requireAdminSession() {
  if (!isSupabaseConfigured()) redirect("/admin/login");
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/admin/login");
}
