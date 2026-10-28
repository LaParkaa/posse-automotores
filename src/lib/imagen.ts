// Las fotos del bucket de Supabase y las de /public se sirven achicadas por Next (la portada de un auto llegó a pesar
// 6,7 MB); cualquier otro origen se muestra tal cual para no romper la página.
const HOST_SUPABASE = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname;
  } catch {
    return "";
  }
})();

export function sePuedeOptimizar(src: string): boolean {
  if (src.startsWith("/")) return true;
  try {
    return HOST_SUPABASE !== "" && new URL(src).hostname === HOST_SUPABASE;
  } catch {
    return false;
  }
}
