import { describe, expect, it } from "vitest";
import { extraerEventos } from "./payload";

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

  it("lee los textos de un adjunto (titulo, telefono): un telefono que Instagram convierte en contacto llega ahi", () => {
    const body = webhook([
      evento({
        mid: "m6",
        attachments: [{ type: "fallback", title: "Juan", payload: { title: "Juan 3537 123456", url: "tel:+5493537123456" } }],
      }),
    ]);
    const [e] = extraerEventos(body);

    expect(e).toMatchObject({ tipo: "mensaje", texto: null, adjuntos: ["fallback"] });
    expect(e).toHaveProperty("adjuntosTexto");
    expect((e as { adjuntosTexto: string[] }).adjuntosTexto).toEqual(
      expect.arrayContaining(["Juan", "Juan 3537 123456", "tel:+5493537123456"]),
    );
  });

  it("ignora los links de los adjuntos: los de fotos traen numeros largos que no son un telefono", () => {
    const body = webhook([
      evento({ mid: "m7", attachments: [{ type: "image", payload: { url: "https://cdn.example/x?asset_id=123456789012345" } }] }),
    ]);

    expect(extraerEventos(body)[0]).not.toHaveProperty("adjuntosTexto");
  });

  it("acota la cantidad y el largo de los textos del adjunto", () => {
    const muchos = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`k${i}`, "x".repeat(1000)]));
    const [e] = extraerEventos(webhook([evento({ mid: "m8", attachments: [{ type: "fallback", payload: muchos }] })]));
    const textos = (e as { adjuntosTexto: string[] }).adjuntosTexto;

    expect(textos.length).toBeLessThanOrEqual(8);
    for (const t of textos) expect(t.length).toBeLessThanOrEqual(200);
  });

  it("conserva los ecos: el destinatario es el cliente", () => {
    const body = webhook([evento({ mid: "m5", text: "Hola, te cuento...", is_echo: true }, "999", "111")]);

    expect(extraerEventos(body)).toEqual([
      { tipo: "eco", destinatarioId: "111", mid: "m5", texto: "Hola, te cuento..." },
    ]);
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
