import { createServerClient } from "@/lib/supabase";
import { redirect } from "next/navigation";

export async function POST() {
  const supabase = await createServerClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
