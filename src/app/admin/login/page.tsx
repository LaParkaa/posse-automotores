"use client";
import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";

/**
 * Destino al que volver despues de entrar. Se lee del parametro "next" que
 * pone el middleware. Solo se aceptan rutas internas: un valor como
 * "//otro-sitio.com" seria un redirect abierto.
 */
function destinoSeguro(): string {
  const next = new URLSearchParams(window.location.search).get("next");
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/admin";
}

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("Credenciales incorrectas");
      setLoading(false);
    } else {
      router.push(destinoSeguro());
      router.refresh();
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-car-black px-5">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <img
            src="/logo-posse.png"
            alt="Posse Automotores"
            className="mx-auto h-16 w-auto"
          />
          <p className="mt-2 font-condensed text-sm font-black italic uppercase tracking-[4px] text-car-gold">
            Admin
          </p>
        </div>
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-lg border border-car-gold/20 bg-car-gray p-8"
        >
          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-wide text-car-muted">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded border border-white/15 bg-car-gray2 px-4 py-3 text-sm text-car-white outline-none focus:border-car-gold"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-wide text-car-muted">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded border border-white/15 bg-car-gray2 px-4 py-3 text-sm text-car-white outline-none focus:border-car-gold"
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-car-gold py-3 font-condensed font-bold uppercase tracking-wide text-car-black transition hover:bg-car-gold-dark disabled:opacity-50"
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}
