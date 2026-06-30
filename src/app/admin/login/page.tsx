"use client";
import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("Credenciales incorrectas");
      setLoading(false);
    } else {
      router.push("/admin");
      router.refresh();
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-car-black px-5">
      <div className="w-full max-w-sm">
        <p className="mb-8 text-center font-condensed text-2xl font-black italic text-car-white">
          <span className="text-car-gold">POSSE</span> ADMIN
        </p>
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
