import type { Plataforma } from "./aviso";

/** Cómo se muestra cada plataforma y adónde lleva "Abrir para publicar". Los colores son los de cada marca. */
export const PLATAFORMAS: Record<Plataforma, { nombre: string; urlPublicar: string; fondo: string; texto: string }> = {
  mercadolibre: {
    nombre: "Mercado Libre",
    urlPublicar: "https://www.mercadolibre.com.ar/l/publica-tu-vehiculo",
    fondo: "#FFE600",
    texto: "#2D3277",
  },
  marketplace: {
    nombre: "Marketplace",
    urlPublicar: "https://www.facebook.com/marketplace/create/vehicle",
    fondo: "#1877F2",
    texto: "#FFFFFF",
  },
};
