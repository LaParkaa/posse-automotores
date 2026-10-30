import { describe, expect, it } from "vitest";
import { rutaEnBucket, sobrantesDeVendido } from "./media-vendidos";

const url = (nombre: string) => `https://x.supabase.co/storage/v1/object/public/vehiculos-posse/${nombre}`;

describe("rutaEnBucket", () => {
  it("saca la ruta de una URL del bucket", () => {
    expect(rutaEnBucket(url("a.jpg"))).toBe("a.jpg");
  });
  it("ignora fotos de otro origen", () => {
    expect(rutaEnBucket("/img/auto.jpg")).toBeNull();
    expect(rutaEnBucket(null)).toBeNull();
  });
});

describe("sobrantesDeVendido", () => {
  it("conserva solo la portada y borra el resto de fotos y los videos", () => {
    const r = sobrantesDeVendido({
      cover_image_url: url("p.jpg"),
      imagenes: [url("p.jpg"), url("b.jpg"), url("c.jpg")],
      videos: [url("v.mp4")],
    });
    expect(r.rutas).toEqual(["b.jpg", "c.jpg", "v.mp4"]);
    expect(r.imagenes).toEqual([url("p.jpg")]);
    expect(r.videos).toEqual([]);
  });

  it("sin cover usa la primera foto como portada", () => {
    const r = sobrantesDeVendido({ cover_image_url: null, imagenes: [url("a.jpg"), url("b.jpg")], videos: null });
    expect(r.imagenes).toEqual([url("a.jpg")]);
    expect(r.rutas).toEqual(["b.jpg"]);
  });

  it("no borra archivos que no están en el bucket", () => {
    const r = sobrantesDeVendido({ cover_image_url: "/img/a.jpg", imagenes: ["/img/a.jpg", "/img/b.jpg"], videos: [] });
    expect(r.rutas).toEqual([]);
    expect(r.imagenes).toEqual(["/img/a.jpg"]);
  });
});
