import { describe, expect, it } from "vitest";
import { extraerMensajes, extraerEventos } from "./payload";

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

describe("extraerEventos", () => {
  const evento = (message: Record<string, unknown>, sender = "111", recipient = "999") => ({
    sender: { id: sender },
    recipient: { id: recipient },
    timestamp: 1700000000000,
    message,
  });
  const webhook = (messaging: unknown[]) => ({ object: "instagram", entry: [{ id: "999", time: 1, messaging }] });

  it("extrae un mensaje de texto", () => {
    expect(extraerEventos(webhook([evento({ mid: "m1", text: "  Hola  " })]))).toEqual([
      { tipo: "mensaje", senderId: "111", mid: "m1", texto: "Hola", historiaId: null, adjuntos: [] },
    ]);
  });

  it("extrae el id de la historia cuando responde a una historia", () => {
    const body = webhook([
      evento({ mid: "m2", text: "me decis el precio?", reply_to: { story: { id: "st-1", url: "https://cdn/x" } } }),
    ]);

    expect(extraerEventos(body)[0]).toMatchObject({ tipo: "mensaje", texto: "me decis el precio?", historiaId: "st-1" });
  });

  it("devuelve los tipos de adjunto y texto null si solo hay adjunto", () => {
    const body = webhook([
      evento({ mid: "m3", attachments: [{ type: "audio", payload: { url: "https://cdn/a" } }] }),
      evento({ mid: "m4", attachments: [{ type: "image", payload: { url: "https://cdn/i" } }, { type: "ig_reel", payload: {} }] }),
    ]);

    expect(extraerEventos(body)).toEqual([
      { tipo: "mensaje", senderId: "111", mid: "m3", texto: null, historiaId: null, adjuntos: ["audio"] },
      { tipo: "mensaje", senderId: "111", mid: "m4", texto: null, historiaId: null, adjuntos: ["image", "ig_reel"] },
    ]);
  });

  it("conserva los ecos: el destinatario es el cliente", () => {
    const body = webhook([evento({ mid: "m5", text: "Hola, te cuento...", is_echo: true }, "999", "111")]);

    expect(extraerEventos(body)).toEqual([{ tipo: "eco", destinatarioId: "111", mid: "m5" }]);
  });

  it("ignora mensajes borrados, eventos sin mensaje y objetos que no son de Instagram", () => {
    expect(extraerEventos(webhook([evento({ mid: "m6", is_deleted: true })]))).toEqual([]);
    expect(extraerEventos(webhook([{ sender: { id: "1" }, read: { mid: "m" } }]))).toEqual([]);
    expect(extraerEventos({ object: "page", entry: [] })).toEqual([]);
  });

  it("descarta mensajes sin sender.id o sin mid, y tolera basura", () => {
    expect(extraerEventos(webhook([{ sender: {}, message: { mid: "m7", text: "x" } }]))).toEqual([]);
    expect(extraerEventos(webhook([evento({ text: "sin mid" })]))).toEqual([]);
    for (const basura of [null, undefined, "x", 3, [], {}, { object: "instagram" }, { object: "instagram", entry: [null, { messaging: "x" }] }]) {
      expect(extraerEventos(basura)).toEqual([]);
    }
  });

  it("descarta un eco sin destinatario", () => {
    const body = webhook([{ sender: { id: "999" }, message: { mid: "m8", is_echo: true, text: "x" } }]);

    expect(extraerEventos(body)).toEqual([]);
  });
});
