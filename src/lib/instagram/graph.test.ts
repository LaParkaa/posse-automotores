import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enviarAccion, enviarMensajeInstagram, enviarTarjetas, MAX_BYTES_MENSAJE, obtenerPerfil, partirTexto } from "./graph";

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

describe("enviarMensajeInstagram devuelve los ids", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubEnv("PAGE_ACCESS_TOKEN", "token-de-prueba");
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("devuelve el message_id de cada parte enviada", async () => {
    let n = 0;
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ recipient_id: "1", message_id: `m${++n}` }), { status: 200 }));
    const texto = Array.from({ length: 400 }, (_, i) => `palabra${i}`).join(" ");

    const ids = await enviarMensajeInstagram("1", texto);

    expect(ids.length).toBeGreaterThan(1);
    expect(ids[0]).toBe("m1");
    expect(ids).toHaveLength(fetchMock.mock.calls.length);
  });

  it("si la respuesta no trae message_id no inventa uno", async () => {
    fetchMock.mockImplementation(async () => new Response("{}", { status: 200 }));

    expect(await enviarMensajeInstagram("1", "Hola")).toEqual([]);
  });
});

describe("enviarTarjetas", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubEnv("PAGE_ACCESS_TOKEN", "token-de-prueba");
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ message_id: "t1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  const tarjeta = (n: number) => ({
    titulo: `Auto ${n}`,
    subtitulo: "180.000 km · Nafta",
    imagenUrl: `https://img.example/${n}.jpg`,
    botones: [
      { titulo: "Ver en la web", url: "https://posse.example/vehiculos/a" },
      { titulo: "Hablar con Nati", url: "https://wa.me/5493537558947?text=hola" },
    ],
  });

  it("manda una plantilla generica con imagen, titulo, subtitulo y botones de enlace", async () => {
    const ids = await enviarTarjetas("111", [tarjeta(1)]);

    expect(ids).toEqual(["t1"]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://graph.facebook.com/v21.0/me/messages");
    expect(init.headers.Authorization).toBe("Bearer token-de-prueba");
    expect(JSON.parse(init.body)).toEqual({
      recipient: { id: "111" },
      message: {
        attachment: {
          type: "template",
          payload: {
            template_type: "generic",
            elements: [
              {
                title: "Auto 1",
                subtitle: "180.000 km · Nafta",
                image_url: "https://img.example/1.jpg",
                buttons: [
                  { type: "web_url", url: "https://posse.example/vehiculos/a", title: "Ver en la web" },
                  { type: "web_url", url: "https://wa.me/5493537558947?text=hola", title: "Hablar con Nati" },
                ],
              },
            ],
          },
        },
      },
    });
  });

  it("omite image_url cuando no hay imagen", async () => {
    await enviarTarjetas("111", [{ ...tarjeta(1), imagenUrl: null }]);

    const elemento = JSON.parse(fetchMock.mock.calls[0][1].body).message.attachment.payload.elements[0];
    expect(elemento).not.toHaveProperty("image_url");
  });

  it("respeta los limites de Instagram: 10 elementos, 3 botones, textos recortados", async () => {
    const larga = { ...tarjeta(1), titulo: "T".repeat(120), subtitulo: "S".repeat(120), botones: Array.from({ length: 5 }, (_, i) => ({ titulo: "B".repeat(40), url: `https://x/${i}` })) };

    await enviarTarjetas("111", [larga, ...Array.from({ length: 14 }, (_, i) => tarjeta(i + 2))]);

    const elementos = JSON.parse(fetchMock.mock.calls[0][1].body).message.attachment.payload.elements;
    expect(elementos).toHaveLength(10);
    expect(elementos[0].title.length).toBeLessThanOrEqual(80);
    expect(elementos[0].subtitle.length).toBeLessThanOrEqual(80);
    expect(elementos[0].buttons).toHaveLength(3);
    expect(elementos[0].buttons[0].title.length).toBeLessThanOrEqual(20);
  });

  it("no manda nada si no hay tarjetas", async () => {
    expect(await enviarTarjetas("111", [])).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lanza si la Graph API rechaza la tarjeta (el handler cae al texto)", async () => {
    fetchMock.mockImplementation(async () => new Response('{"error":{"message":"bad image"}}', { status: 400 }));

    await expect(enviarTarjetas("111", [tarjeta(1)])).rejects.toThrow(/Graph API 400/);
  });
});

describe("enviarAccion", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubEnv("PAGE_ACCESS_TOKEN", "token-de-prueba");
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("manda sender_action y devuelve true", async () => {
    fetchMock.mockImplementation(async () => new Response("{}", { status: 200 }));

    expect(await enviarAccion("111", "typing_on")).toBe(true);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ recipient: { id: "111" }, sender_action: "typing_on" });
  });

  it("nunca lanza: devuelve false si falla (son un adorno)", async () => {
    fetchMock.mockImplementation(async () => new Response("no", { status: 500 }));
    expect(await enviarAccion("111", "mark_seen")).toBe(false);

    fetchMock.mockImplementation(async () => {
      throw new Error("red caida");
    });
    expect(await enviarAccion("111", "mark_seen")).toBe(false);
  });
});

describe("obtenerPerfil", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubEnv("PAGE_ACCESS_TOKEN", "token-de-prueba");
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("pide name y username con el token en el header y devuelve el perfil", async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ name: " Juan Perez ", username: "juancenturion94" }), { status: 200 }));

    expect(await obtenerPerfil("111")).toEqual({ nombre: "Juan Perez", usuario: "juancenturion94" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://graph.facebook.com/v21.0/111?fields=name,username");
    expect(init.headers.Authorization).toBe("Bearer token-de-prueba");
  });

  it("devuelve null si falla o no trae nada util (el bot sigue sin nombre)", async () => {
    fetchMock.mockImplementation(async () => new Response("{}", { status: 200 }));
    expect(await obtenerPerfil("111")).toBeNull();

    fetchMock.mockImplementation(async () => new Response("no", { status: 403 }));
    expect(await obtenerPerfil("111")).toBeNull();

    fetchMock.mockImplementation(async () => {
      throw new Error("timeout");
    });
    expect(await obtenerPerfil("111")).toBeNull();
  });

  it("devuelve null sin token y no llama a la red", async () => {
    vi.stubEnv("PAGE_ACCESS_TOKEN", "");

    expect(await obtenerPerfil("111")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
