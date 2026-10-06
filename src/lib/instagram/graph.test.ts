import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enviarMensajeInstagram, MAX_BYTES_MENSAJE, partirTexto } from "./graph";

const bytes = (texto: string) => new TextEncoder().encode(texto).length;

describe("partirTexto", () => {
  it("devuelve un solo mensaje si entra en el limite", () => {
    expect(partirTexto("Hola!")).toEqual(["Hola!"]);
  });

  it("devuelve lista vacia para texto vacio o solo espacios", () => {
    expect(partirTexto("")).toEqual([]);
    expect(partirTexto("   \n ")).toEqual([]);
  });

  it("parte sin pasar el limite de bytes y sin cortar palabras", () => {
    const texto = Array.from({ length: 400 }, (_, i) => `palabra${i}`).join(" ");

    const partes = partirTexto(texto);

    expect(partes.length).toBeGreaterThan(1);
    for (const parte of partes) {
      expect(bytes(parte)).toBeLessThanOrEqual(MAX_BYTES_MENSAJE);
    }
    expect(partes.join(" ").split(/\s+/)).toEqual(texto.split(/\s+/));
  });

  it("cuenta bytes y no caracteres (un emoji pesa 4 bytes)", () => {
    const texto = "🚗".repeat(300); // 1200 bytes

    const partes = partirTexto(texto);

    expect(partes).toHaveLength(2);
    for (const parte of partes) {
      expect(bytes(parte)).toBeLessThanOrEqual(MAX_BYTES_MENSAJE);
    }
    expect(partes.join("")).toBe(texto);
  });

  it("corta por caracteres una palabra mas larga que el limite", () => {
    const partes = partirTexto("a".repeat(2500));

    expect(partes.map((p) => p.length)).toEqual([1000, 1000, 500]);
  });

  it("conserva los saltos de linea dentro de una parte", () => {
    expect(partirTexto("Linea 1\nLinea 2")).toEqual(["Linea 1\nLinea 2"]);
  });
});

describe("enviarMensajeInstagram", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubEnv("PAGE_ACCESS_TOKEN", "token-de-prueba");
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("hace POST a la Graph API con el token en el header", async () => {
    await enviarMensajeInstagram("1234567890", "Hola!");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://graph.facebook.com/v21.0/me/messages");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer token-de-prueba");
    expect(JSON.parse(init.body)).toEqual({
      recipient: { id: "1234567890" },
      message: { text: "Hola!" },
    });
  });

  it("manda un request por cada parte, en orden", async () => {
    const texto = Array.from({ length: 400 }, (_, i) => `palabra${i}`).join(" ");

    await enviarMensajeInstagram("1", texto);

    const enviados = fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body).message.text);
    expect(enviados.length).toBeGreaterThan(1);
    expect(enviados.join(" ").split(/\s+/)).toEqual(texto.split(/\s+/));
  });

  it("lanza si la Graph API responde con error", async () => {
    fetchMock.mockImplementation(
      async () => new Response('{"error":{"message":"token vencido"}}', { status: 400 }),
    );

    await expect(enviarMensajeInstagram("1", "Hola")).rejects.toThrow(/Graph API 400/);
  });

  it("lanza si falta PAGE_ACCESS_TOKEN y no llama a la red", async () => {
    vi.stubEnv("PAGE_ACCESS_TOKEN", "");

    await expect(enviarMensajeInstagram("1", "Hola")).rejects.toThrow(/PAGE_ACCESS_TOKEN/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("no manda nada si el texto esta vacio", async () => {
    await enviarMensajeInstagram("1", "   ");

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
