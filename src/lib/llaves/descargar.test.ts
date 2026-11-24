import { describe, expect, it, vi } from "vitest";
import { descargarImagen, ErrorDescarga, MAX_BYTES_LLAVE, tipoPorFirma } from "./descargar";

const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
const WEBP = new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50, 0x56]);

const IP_PUBLICA = ["93.184.216.34"];
const resolverPublico = vi.fn(async () => IP_PUBLICA);

const ok = (bytes: Uint8Array, headers: Record<string, string> = {}) =>
  new Response(bytes as unknown as BodyInit, { status: 200, headers });
const redireccion = (destino: string) => new Response(null, { status: 302, headers: { location: destino } });

function deps(fetchFn: (url: string) => Promise<Response>, resolver = resolverPublico) {
  return { fetch: vi.fn(fetchFn) as unknown as typeof fetch, resolver };
}

describe("tipoPorFirma", () => {
  it("reconoce JPG, PNG y WebP por el contenido", () => {
    expect(tipoPorFirma(JPG)).toEqual({ contentType: "image/jpeg", ext: "jpg" });
    expect(tipoPorFirma(PNG)).toEqual({ contentType: "image/png", ext: "png" });
    expect(tipoPorFirma(WEBP)).toEqual({ contentType: "image/webp", ext: "webp" });
  });

  it("no reconoce HTML, SVG ni bytes sueltos", () => {
    expect(tipoPorFirma(new TextEncoder().encode("<html><body>hola</body></html>"))).toBeNull();
    expect(tipoPorFirma(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeNull();
    expect(tipoPorFirma(new Uint8Array([1, 2, 3]))).toBeNull();
    expect(tipoPorFirma(new Uint8Array([]))).toBeNull();
  });
});

describe("descargarImagen", () => {
  it("baja una imagen válida", async () => {
    const d = deps(async () => ok(JPG));
    const imagen = await descargarImagen("https://cdn.example.com/llave.jpg", d);
    expect(imagen.ext).toBe("jpg");
    expect(Array.from(imagen.bytes)).toEqual(Array.from(JPG));
  });

  it("no confía en el Content-Type: un HTML que dice ser image/jpeg se rechaza", async () => {
    const d = deps(async () => ok(new TextEncoder().encode("<html>no soy imagen</html>"), { "content-type": "image/jpeg" }));
    await expect(descargarImagen("https://example.com/a.jpg", d)).rejects.toBeInstanceOf(ErrorDescarga);
  });

  it("rechaza lo que pesa más del tope, sin leerlo entero", async () => {
    const grande = new Uint8Array(MAX_BYTES_LLAVE + 10);
    grande.set(JPG);
    const d = deps(async () => ok(grande));
    await expect(descargarImagen("https://example.com/a.jpg", d)).rejects.toThrow(/pesada/);
  });

  it("rechaza si el servidor declara un peso mayor al tope", async () => {
    const d = deps(async () => ok(JPG, { "content-length": String(MAX_BYTES_LLAVE + 1) }));
    await expect(descargarImagen("https://example.com/a.jpg", d)).rejects.toThrow(/pesada/);
  });

  it("rechaza respuestas de error", async () => {
    const d = deps(async () => new Response("no", { status: 404 }));
    await expect(descargarImagen("https://example.com/a.jpg", d)).rejects.toThrow(/404/);
  });

  it.each(["http://127.0.0.1/a.jpg", "http://localhost/a.jpg", "http://169.254.169.254/latest", "file:///etc/passwd", "no es url"])(
    "no hace ninguna consulta a %s",
    async (url) => {
      const d = deps(async () => ok(JPG));
      await expect(descargarImagen(url, d)).rejects.toBeInstanceOf(ErrorDescarga);
      expect(d.fetch).not.toHaveBeenCalled();
    },
  );

  it("rechaza un dominio público que resuelve a una dirección interna", async () => {
    const d = deps(async () => ok(JPG), vi.fn(async () => ["10.0.0.5"]));
    await expect(descargarImagen("https://trampa.example.com/a.jpg", d)).rejects.toThrow(/no permitida/);
    expect(d.fetch).not.toHaveBeenCalled();
  });

  it("rechaza si el nombre no se puede resolver", async () => {
    const d = deps(async () => ok(JPG), vi.fn(async () => Promise.reject(new Error("ENOTFOUND"))));
    await expect(descargarImagen("https://no-existe.example.com/a.jpg", d)).rejects.toBeInstanceOf(ErrorDescarga);
  });

  it("sigue una redirección a otro sitio público", async () => {
    const d = deps(async (url) => (url.includes("corto") ? redireccion("https://cdn.example.com/real.png") : ok(PNG)));
    const imagen = await descargarImagen("https://corto.example.com/x", d);
    expect(imagen.ext).toBe("png");
    expect(d.fetch).toHaveBeenCalledTimes(2);
  });

  it("una redirección a la red interna se corta", async () => {
    const d = deps(async () => redireccion("http://10.0.0.1/secreto"));
    await expect(descargarImagen("https://example.com/x", d)).rejects.toBeInstanceOf(ErrorDescarga);
    expect(d.fetch).toHaveBeenCalledTimes(1);
  });

  it("corta una cadena infinita de redirecciones", async () => {
    const d = deps(async () => redireccion("https://example.com/otra"));
    await expect(descargarImagen("https://example.com/x", d)).rejects.toThrow(/redirecciones/);
  });

  it("una falla de red se informa como ErrorDescarga", async () => {
    const d = deps(async () => Promise.reject(new Error("ECONNRESET")));
    await expect(descargarImagen("https://example.com/a.jpg", d)).rejects.toBeInstanceOf(ErrorDescarga);
  });
});
