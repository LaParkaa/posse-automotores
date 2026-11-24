import { describe, expect, it, vi } from "vitest";
import { buscarImagenes, configDesdeEnv, ErrorBusqueda, hayProveedor, parsearGoogle, parsearSerper } from "./buscadores";

const respuesta = (json: unknown, status = 200) =>
  new Response(JSON.stringify(json), { status, headers: { "content-type": "application/json" } });

describe("configDesdeEnv", () => {
  it("lee las variables y ignora las vacías", () => {
    expect(configDesdeEnv({ SERPER_API_KEY: " abc ", GOOGLE_CSE_API_KEY: "", GOOGLE_CSE_ID: undefined })).toEqual({
      serperKey: "abc",
      googleKey: undefined,
      googleCx: undefined,
    });
  });

  it("hay proveedor con Serper, o con las dos claves de Google", () => {
    expect(hayProveedor({ serperKey: "x" })).toBe(true);
    expect(hayProveedor({ googleKey: "k", googleCx: "c" })).toBe(true);
    expect(hayProveedor({ googleKey: "k" })).toBe(false);
    expect(hayProveedor({})).toBe(false);
  });
});

describe("parsearSerper", () => {
  it("saca las direcciones de imageUrl", () => {
    expect(parsearSerper({ images: [{ imageUrl: "https://a.com/1.jpg" }, { imageUrl: "https://b.com/2.png" }] })).toEqual([
      "https://a.com/1.jpg",
      "https://b.com/2.png",
    ]);
  });

  it("descarta svg, gif, repetidos y lo que no es http", () => {
    const urls = parsearSerper({
      images: [
        { imageUrl: "https://a.com/1.svg" },
        { imageUrl: "https://a.com/2.gif?x=1" },
        { imageUrl: "https://a.com/3.jpg" },
        { imageUrl: "https://a.com/3.jpg" },
        { imageUrl: "ftp://a.com/4.jpg" },
        { imageUrl: 5 },
        null,
      ],
    });
    expect(urls).toEqual(["https://a.com/3.jpg"]);
  });

  it("devuelve como máximo 8", () => {
    const images = Array.from({ length: 20 }, (_, i) => ({ imageUrl: `https://a.com/${i}.jpg` }));
    expect(parsearSerper({ images })).toHaveLength(8);
  });

  it("una respuesta rara no rompe", () => {
    expect(parsearSerper(null)).toEqual([]);
    expect(parsearSerper({ images: "x" })).toEqual([]);
    expect(parsearSerper([])).toEqual([]);
  });
});

describe("parsearGoogle", () => {
  it("saca las direcciones de link", () => {
    expect(parsearGoogle({ items: [{ link: "https://a.com/1.jpg" }, { title: "sin link" }] })).toEqual(["https://a.com/1.jpg"]);
  });

  it("una respuesta rara no rompe", () => {
    expect(parsearGoogle({})).toEqual([]);
    expect(parsearGoogle(undefined)).toEqual([]);
  });
});

describe("buscarImagenes", () => {
  it("con Serper hace un POST con la clave y la consulta", async () => {
    const fetchFn = vi.fn(async () => respuesta({ images: [{ imageUrl: "https://a.com/1.jpg" }] }));
    const urls = await buscarImagenes("llave Ford Ranger 2016 original", { serperKey: "CLAVE" }, fetchFn as unknown as typeof fetch);

    expect(urls).toEqual(["https://a.com/1.jpg"]);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://google.serper.dev/images");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["X-API-KEY"]).toBe("CLAVE");
    expect(JSON.parse(init.body as string).q).toBe("llave Ford Ranger 2016 original");
  });

  it("con Google hace un GET de imágenes", async () => {
    const fetchFn = vi.fn(async () => respuesta({ items: [{ link: "https://a.com/1.jpg" }] }));
    const urls = await buscarImagenes("llave", { googleKey: "K", googleCx: "CX" }, fetchFn as unknown as typeof fetch);

    expect(urls).toEqual(["https://a.com/1.jpg"]);
    const [url] = fetchFn.mock.calls[0] as unknown as [string];
    expect(url).toContain("https://www.googleapis.com/customsearch/v1?");
    expect(url).toContain("searchType=image");
    expect(url).toContain("cx=CX");
  });

  it("sin proveedor configurado lanza sin_proveedor y no consulta nada", async () => {
    const fetchFn = vi.fn();
    await expect(buscarImagenes("x", {}, fetchFn as unknown as typeof fetch)).rejects.toMatchObject({ motivo: "sin_proveedor" });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("si el proveedor responde error lanza proveedor sin copiar la clave ni la respuesta", async () => {
    const fetchFn = vi.fn(async () => respuesta({ error: "CLAVE secreta inválida" }, 403));
    const error = await buscarImagenes("x", { serperKey: "CLAVE" }, fetchFn as unknown as typeof fetch).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorBusqueda);
    expect(error.motivo).toBe("proveedor");
    expect(error.message).toBe("Serper respondió 403");
    expect(error.message).not.toContain("CLAVE");
  });

  it("si se corta la red lanza proveedor", async () => {
    const fetchFn = vi.fn(async () => {
      throw new Error("ECONNRESET con https://google.serper.dev?key=CLAVE");
    });
    const error = await buscarImagenes("x", { serperKey: "CLAVE" }, fetchFn as unknown as typeof fetch).catch((e) => e);
    expect(error.motivo).toBe("proveedor");
    expect(error.message).not.toContain("CLAVE");
  });
});
