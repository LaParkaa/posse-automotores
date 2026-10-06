import { describe, expect, it } from "vitest";
import { extraerMensajes } from "./payload";

function webhook(messaging: unknown[]) {
  return {
    object: "instagram",
    entry: [{ id: "17841400000000000", time: 1700000000, messaging }],
  };
}

function evento(message: Record<string, unknown>, sender = "1234567890") {
  return {
    sender: { id: sender },
    recipient: { id: "17841400000000000" },
    timestamp: 1700000000000,
    message,
  };
}

describe("extraerMensajes", () => {
  it("extrae sender.id, mid y texto de un mensaje de texto", () => {
    const body = webhook([evento({ mid: "mid.abc", text: "Hola, ¿qué autos tienen?" })]);

    expect(extraerMensajes(body)).toEqual([
      { senderId: "1234567890", mid: "mid.abc", texto: "Hola, ¿qué autos tienen?" },
    ]);
  });

  it("recorta los espacios del texto", () => {
    const body = webhook([evento({ mid: "mid.abc", text: "  Hola  " })]);

    expect(extraerMensajes(body)[0].texto).toBe("Hola");
  });

  it("devuelve texto null cuando el mensaje solo trae un adjunto", () => {
    const body = webhook([
      evento({ mid: "mid.foto", attachments: [{ type: "image", payload: { url: "https://x" } }] }),
    ]);

    expect(extraerMensajes(body)).toEqual([
      { senderId: "1234567890", mid: "mid.foto", texto: null },
    ]);
  });

  it("ignora los ecos de mensajes enviados por la propia cuenta", () => {
    const body = webhook([evento({ mid: "mid.eco", text: "Respuesta del bot", is_echo: true })]);

    expect(extraerMensajes(body)).toEqual([]);
  });

  it("ignora mensajes borrados", () => {
    const body = webhook([evento({ mid: "mid.borrado", is_deleted: true })]);

    expect(extraerMensajes(body)).toEqual([]);
  });

  it("ignora eventos que no son mensajes (lecturas, reacciones, postbacks)", () => {
    const body = webhook([
      { sender: { id: "1" }, recipient: { id: "2" }, timestamp: 1, read: { mid: "mid.abc" } },
      { sender: { id: "1" }, recipient: { id: "2" }, timestamp: 1, postback: { payload: "x" } },
    ]);

    expect(extraerMensajes(body)).toEqual([]);
  });

  it("ignora payloads de otros objetos", () => {
    const body = { ...webhook([evento({ mid: "mid.abc", text: "Hola" })]), object: "page" };

    expect(extraerMensajes(body)).toEqual([]);
  });

  it("procesa varios eventos y varias entries en orden", () => {
    const body = {
      object: "instagram",
      entry: [
        {
          messaging: [
            evento({ mid: "mid.1", text: "uno" }, "111"),
            evento({ mid: "mid.2", text: "dos" }, "222"),
          ],
        },
        { messaging: [evento({ mid: "mid.3", text: "tres" }, "333")] },
      ],
    };

    expect(extraerMensajes(body).map((m) => m.mid)).toEqual(["mid.1", "mid.2", "mid.3"]);
  });

  it("descarta eventos sin sender.id o sin mid", () => {
    const body = webhook([
      { sender: {}, message: { mid: "mid.1", text: "sin id" } },
      evento({ text: "sin mid" }),
    ]);

    expect(extraerMensajes(body)).toEqual([]);
  });

  it("tolera basura sin lanzar", () => {
    const basura: unknown[] = [
      null,
      undefined,
      "texto",
      42,
      [],
      {},
      { object: "instagram" },
      { object: "instagram", entry: "x" },
      { object: "instagram", entry: [null, { messaging: "x" }, { messaging: [null, 7] }] },
    ];

    for (const body of basura) {
      expect(extraerMensajes(body)).toEqual([]);
    }
  });
});
