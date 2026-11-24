import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Vehiculo } from "@/lib/types";
import { PublicarSheet } from "./publicar-sheet";

function auto(over: Partial<Vehiculo> = {}): Vehiculo {
  return {
    id: "3f2b9c1e-aaaa-4bbb-8ccc-1234567890ab",
    slug: "volkswagen-vento-2015",
    nombre: "Volkswagen Vento 2.5 Advance 2015",
    marca: "Volkswagen",
    modelo: "Vento 2.5 Advance",
    anio: 2015,
    kilometraje: "130.000 km",
    combustible: "Nafta",
    transmision: "Automático",
    motor: "2.5",
    tipo: "Sedán",
    descripcion: null,
    precio_texto: "USD 14.500",
    cover_image_url: "https://x/portada.jpg",
    imagenes: ["https://x/portada.jpg", "https://x/lateral.jpg"],
    videos: [],
    estado: "disponible",
    badge: null,
    promocionado_reel: false,
    created_at: "2026-10-03T10:00:00Z",
    deleted_at: null,
    sold_at: null,
    sale_price: null,
    sale_notes: null,
    key_image_url: null,
    patente: null,
    ...over,
  };
}

const props = { onCerrar: () => {}, onToast: () => {} };
const botonDeFotos = (html: string) => /<button[^>]*data-accion="compartir-fotos"[^>]*>/.exec(html)?.[0] ?? "";

describe("PublicarSheet", () => {
  it("muestra las dos plataformas con su logo, el aviso armado y las fotos", () => {
    const html = renderToStaticMarkup(<PublicarSheet vehiculo={auto()} {...props} />);
    expect(html).toContain('data-logo="mercadolibre"');
    expect(html).toContain('data-logo="marketplace"');
    expect(html).toContain("Mercado Libre");
    expect(html).toContain("Marketplace");
    expect(html).toContain("Copiar todo");
    expect(html).toContain("Volkswagen Vento 2.5 Advance 2015 130.000 km");
    expect(html).toContain("Versión");
    expect(html).toContain("Compartir fotos");
    expect(botonDeFotos(html)).not.toContain('disabled=""');
  });

  it("sin fotos lo dice y deja el botón de compartir deshabilitado", () => {
    const html = renderToStaticMarkup(<PublicarSheet vehiculo={auto({ cover_image_url: null, imagenes: [] })} {...props} />);
    expect(html).toContain("Sin fotos");
    expect(botonDeFotos(html)).toContain('disabled=""');
  });

  it("el botón de abajo abre la plataforma elegida (arranca en Mercado Libre)", () => {
    const html = renderToStaticMarkup(<PublicarSheet vehiculo={auto()} {...props} />);
    expect(html).toContain("Abrir Mercado Libre para publicar");
    expect(html).toContain('href="https://www.mercadolibre.com.ar/l/publica-tu-vehiculo"');
  });
});
