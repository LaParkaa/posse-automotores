import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-car-black px-5 text-center">
      <p className="font-condensed text-8xl font-black italic text-car-gold">404</p>
      <h1 className="mt-4 font-condensed text-3xl font-black italic text-car-white">
        Página no encontrada
      </h1>
      <p className="mt-3 text-car-muted">El vehículo o página que buscás no existe.</p>
      <Link
        href="/catalogo"
        className="mt-8 rounded bg-car-gold px-6 py-3 font-condensed font-bold uppercase tracking-wide text-car-black transition hover:bg-car-gold-dark"
      >
        Ver catálogo
      </Link>
    </div>
  );
}
