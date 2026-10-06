import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { procesarMensajes } from "@/lib/bot/handler";
import { GET, POST } from "./route";

vi.mock("@/lib/bot/handler", () => ({ procesarMensajes: vi.fn(async () => {}) }));
vi.mock("@/lib/bot/deps", () => ({ crearDeps: vi.fn(() => ({})) }));

const URL_WEBHOOK = "http://localhost:3000/api/instagram/webhook";
const APP_SECRET = "secret-de-prueba";
const VERIFY_TOKEN = "token-de-verificacion";

const payload = {
  object: "instagram",
  entry: [
    {
      id: "1",
      time: 1,
      messaging: [
        {
          sender: { id: "1234567890" },
          recipient: { id: "1" },
          timestamp: 1,
          message: { mid: "mid.abc", text: "Hola" },
        },
      ],
    },
  ],
};

function firmar(cuerpo: string) {
  return `sha256=${createHmac("sha256", APP_SECRET).update(cuerpo, "utf8").digest("hex")}`;
}

function postFirmado(cuerpo: string, firma = firmar(cuerpo)) {
  return new Request(URL_WEBHOOK, {
    method: "POST",
    headers: { "content-type": "application/json", "x-hub-signature-256": firma },
    body: cuerpo,
  });
}

beforeEach(() => {
  vi.stubEnv("IG_VERIFY_TOKEN", VERIFY_TOKEN);
  vi.stubEnv("IG_APP_SECRET", APP_SECRET);
  vi.mocked(procesarMensajes).mockClear();
  vi.mocked(procesarMensajes).mockResolvedValue(undefined);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("GET /api/instagram/webhook (verificacion de Meta)", () => {
  const verificar = (query: string) => GET(new Request(`${URL_WEBHOOK}?${query}`));

  it("devuelve el hub.challenge como texto plano cuando el token coincide", async () => {
    const respuesta = await verificar(
      `hub.mode=subscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=1158201444`,
    );

    expect(respuesta.status).toBe(200);
    expect(await respuesta.text()).toBe("1158201444");
  });

  it("responde 403 con un token incorrecto", async () => {
    const respuesta = await verificar("hub.mode=subscribe&hub.verify_token=otro&hub.challenge=1");

    expect(respuesta.status).toBe(403);
  });

  it("responde 403 si el modo no es subscribe", async () => {
    const respuesta = await verificar(`hub.mode=unsubscribe&hub.verify_token=${VERIFY_TOKEN}&hub.challenge=1`);

    expect(respuesta.status).toBe(403);
  });

  it("responde 403 si IG_VERIFY_TOKEN no esta configurado, aunque el pedido no traiga token", async () => {
    vi.stubEnv("IG_VERIFY_TOKEN", "");

    const respuesta = await verificar("hub.mode=subscribe&hub.challenge=1");

    expect(respuesta.status).toBe(403);
  });
});

describe("POST /api/instagram/webhook", () => {
  it("responde 401 y no procesa nada si la firma es invalida", async () => {
    const cuerpo = JSON.stringify(payload);

    const respuesta = await POST(postFirmado(cuerpo, "sha256=deadbeef"));

    expect(respuesta.status).toBe(401);
    expect(procesarMensajes).not.toHaveBeenCalled();
  });

  it("responde 401 si falta la firma", async () => {
    const respuesta = await POST(
      new Request(URL_WEBHOOK, { method: "POST", body: JSON.stringify(payload) }),
    );

    expect(respuesta.status).toBe(401);
  });

  it("responde 500 si IG_APP_SECRET no esta configurado", async () => {
    vi.stubEnv("IG_APP_SECRET", "");

    const respuesta = await POST(postFirmado(JSON.stringify(payload)));

    expect(respuesta.status).toBe(500);
    expect(procesarMensajes).not.toHaveBeenCalled();
  });

  it("responde 400 si el cuerpo firmado no es JSON", async () => {
    const respuesta = await POST(postFirmado("esto no es json"));

    expect(respuesta.status).toBe(400);
  });

  it("extrae los mensajes y los procesa cuando la firma es valida", async () => {
    const respuesta = await POST(postFirmado(JSON.stringify(payload)));

    expect(respuesta.status).toBe(200);
    expect(procesarMensajes).toHaveBeenCalledTimes(1);
    expect(vi.mocked(procesarMensajes).mock.calls[0][0]).toEqual([
      { senderId: "1234567890", mid: "mid.abc", texto: "Hola" },
    ]);
  });

  it("responde 200 aunque el procesamiento falle (para que Meta no reintente en bucle)", async () => {
    vi.mocked(procesarMensajes).mockRejectedValue(new Error("explotó todo"));

    const respuesta = await POST(postFirmado(JSON.stringify(payload)));

    expect(respuesta.status).toBe(200);
  });

  it("responde 200 a eventos sin mensajes (lecturas, reacciones)", async () => {
    const lectura = { object: "instagram", entry: [{ messaging: [{ sender: { id: "1" }, read: { mid: "m" } }] }] };

    const respuesta = await POST(postFirmado(JSON.stringify(lectura)));

    expect(respuesta.status).toBe(200);
    expect(vi.mocked(procesarMensajes).mock.calls[0][0]).toEqual([]);
  });
});
