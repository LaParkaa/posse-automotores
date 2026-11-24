import type { Plataforma } from "@/lib/publicar/aviso";

/**
 * Marcas dibujadas a mano, simples, con los colores de cada plataforma: Mercado Libre (óvalo amarillo con un apretón
 * de manos azul) y Marketplace (círculo azul con la "f" blanca de Facebook).
 */
export function LogoPlataforma({ plataforma, tamano = 24 }: { plataforma: Plataforma; tamano?: number }) {
  if (plataforma === "mercadolibre") {
    return (
      <svg
        data-logo="mercadolibre"
        aria-hidden
        viewBox="0 0 48 32"
        width={tamano * 1.5}
        height={tamano}
        className="shrink-0"
      >
        <ellipse cx="24" cy="16" rx="22" ry="14" fill="#FFE600" stroke="#2D3277" strokeWidth="2.5" />
        <path
          d="M9 16.5l6-5 5 1.6 4-1.8 4 1.8 5-1.6 6 5-5.5 5.5-3.6-1.2-2.6 2.2-3.3-2-3.3 2-2.6-2.2-3.6 1.2z"
          fill="#2D3277"
        />
        <path d="M17 17.5l4 3M31 17.5l-4 3" stroke="#FFE600" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg data-logo="marketplace" aria-hidden viewBox="0 0 24 24" width={tamano} height={tamano} className="shrink-0">
      <circle cx="12" cy="12" r="12" fill="#1877F2" />
      <path
        d="M13.4 19.5v-6.1h2.1l.4-2.6h-2.5V9.2c0-.8.3-1.3 1.4-1.3h1.2V5.6c-.2 0-1-.1-1.9-.1-1.9 0-3.2 1.2-3.2 3.3v2H8.3v2.6h2.2v6.1z"
        fill="#FFFFFF"
      />
    </svg>
  );
}
