import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { procesarChat, RESPUESTA_FALLA } from "@/lib/bot/web/chat";
import { LIMITES } from "@/lib/bot/web/limites";
import { NEGOCIO } from "@/lib/bot/negocio";
import { createBotSupabaseClient } from "@/lib/supabase";
import { POST, dynamic, maxDuration, runtime } from "./route";

vi.mock("@/lib/supabase", () => ({ createBotSupabaseClient: vi.fn(() => ({ centinela: true })) }));
vi.mock("@/lib/bot/catalogo", () => ({ obtenerCatalogo: vi.fn(async () => []) }));
vi.mock("@/lib/bot/web/chat", async (original) => {
  const real = await original<typeof import("@/lib/bot/web/chat")>();
  return { ...real, procesarChat: vi.fn() };
});

const URL_CHAT = "http://localhost:3000/api/chat";
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";
const valido = { visitante: "visitante-12345678", pagina: "catalogo", slug: null, texto: "hola" };

function post(cuerpo: string, ua: string | null = UA) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (ua) headers["user-agent"] = ua;
  return POST(new Request(URL_CHAT, { method: "POST", headers, body: cuerpo }));
}

beforeEach(() => {
  vi.mocked(procesarChat).mockReset();
  vi.mocked(procesarChat).mockResolvedValue({ mensajes: [{ tipo: "texto", texto: "Hola!" }], sugerencias: ["marcos"] });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/chat", () => {
  it("declara runtime nodejs, dynamic force-dynamic y maxDuration 10", () => {
    expect(runtime).toBe("nodejs");
    expect(dynamic).toBe("force-dynamic");
    expect(maxDuration).toBe(10);
  });

  it("400 si el cuerpo no es JSON", async () => {
    const r = await post("esto no es json");
    expect(r.status).toBe(400);
    expect(procesarChat).not.toHaveBeenCalled();
  });

  it("400 si el pedido no valida", async () => {
    const r = await post(JSON.stringify({ ...valido, visitante: "x" }));
    expect(r.status).toBe(400);
    expect(procesarChat).not.toHaveBeenCalled();
  });

  it("400 si el cuerpo pasa los bytes maximos (cuenta bytes, no caracteres)", async () => {
    const r = await post(JSON.stringify({ ...valido, texto: "ñ".repeat(LIMITES.maxBytes) }));
    expect(r.status).toBe(400);
    expect(procesarChat).not.toHaveBeenCalled();
  });

  it("204 sin cuerpo si es un robot", async () => {
    const r = await post(JSON.stringify(valido), "Googlebot/2.1");
    expect(r.status).toBe(204);
    expect(await r.text()).toBe("");
    expect(procesarChat).not.toHaveBeenCalled();
  });

  it("204 si no hay user-agent", async () => {
    const r = await post(JSON.stringify(valido), null);
    expect(r.status).toBe(204);
  });

  it("200 con la RespuestaChat en JSON y Cache-Control no-store", async () => {
    const r = await post(JSON.stringify(valido));
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(r.headers.get("content-type")).toContain("application/json");
    expect(await r.json()).toEqual({ mensajes: [{ tipo: "texto", texto: "Hola!" }], sugerencias: ["marcos"] });

    const [pedido, deps] = vi.mocked(procesarChat).mock.calls[0];
    expect(pedido).toEqual({ visitante: valido.visitante, pagina: "catalogo", slug: null, texto: "hola" });
    expect(deps.siteUrl).toBe("http://localhost:3000");
    expect(deps.negocio).toBe(NEGOCIO);
  });

  it("el cliente de Supabase del chat usa un tope por consulta de 2000 ms", async () => {
    await post(JSON.stringify(valido));
    expect(createBotSupabaseClient).toHaveBeenCalledWith(2000);
  });

  it("usa SITE_URL si esta definida y un mid distinto en cada pedido", async () => {
    vi.stubEnv("SITE_URL", "https://posse.example");
    await post(JSON.stringify(valido));
    await post(JSON.stringify(valido));
    const [, d1] = vi.mocked(procesarChat).mock.calls[0];
    const [, d2] = vi.mocked(procesarChat).mock.calls[1];
    expect(d1.siteUrl).toBe("https://posse.example");
    expect(d1.mid()).not.toBe(d2.mid());
    vi.unstubAllEnvs();
  });

  it("si procesarChat lanzara igual contesta 200 con la respuesta de falla (sin detalles)", async () => {
    vi.mocked(procesarChat).mockRejectedValue(new Error("SECRETO"));
    const r = await post(JSON.stringify(valido));
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    const texto = await r.text();
    expect(texto).not.toContain("SECRETO");
    expect(JSON.parse(texto)).toEqual(RESPUESTA_FALLA(NEGOCIO));
  });
});
