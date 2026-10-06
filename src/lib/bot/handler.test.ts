import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MensajeEntrante } from "../instagram/payload";
import { type DepsBot, MENSAJE_ADJUNTO, MENSAJE_ERROR_TECNICO, MENSAJE_LEAD_FALLIDO, procesarMensajes } from "./handler";
import { EMPRESA } from "./prompt";

function crearDeps(sobrescribir: Partial<DepsBot> = {}): DepsBot {
  return {
    reclamarMensaje: vi.fn(async () => true),
    obtenerHistorial: vi.fn(async () => [{ role: "user" as const, content: "Hola" }]),
    obtenerStockTexto: vi.fn(async () => "- Corolla | 2011"),
    responderIA: vi.fn(async () => ({ texto: "¡Hola! ¿Qué buscás?", lead: null })),
    guardarLead: vi.fn(async () => {}),
    guardarRespuesta: vi.fn(async () => {}),
    enviar: vi.fn(async () => {}),
    ...sobrescribir,
  };
}

const mensaje: MensajeEntrante = { senderId: "111", mid: "mid.1", texto: "Hola" };

describe("procesarMensajes", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("flujo normal: reclama, consulta a la IA con historial y stock, envia y guarda la respuesta", async () => {
    const deps = crearDeps();

    await procesarMensajes([mensaje], deps);

    expect(deps.reclamarMensaje).toHaveBeenCalledWith("111", "mid.1", "Hola");
    expect(deps.responderIA).toHaveBeenCalledWith({
      stockTexto: "- Corolla | 2011",
      historial: [{ role: "user", content: "Hola" }],
    });
    expect(deps.enviar).toHaveBeenCalledWith("111", "¡Hola! ¿Qué buscás?");
    expect(deps.guardarRespuesta).toHaveBeenCalledWith("111", "¡Hola! ¿Qué buscás?");
    expect(deps.guardarLead).not.toHaveBeenCalled();
  });

  it("ignora un mensaje duplicado (reintento de Meta)", async () => {
    const deps = crearDeps({ reclamarMensaje: vi.fn(async () => false) });

    await procesarMensajes([mensaje], deps);

    expect(deps.responderIA).not.toHaveBeenCalled();
    expect(deps.enviar).not.toHaveBeenCalled();
    expect(deps.obtenerHistorial).not.toHaveBeenCalled();
    expect(deps.obtenerStockTexto).not.toHaveBeenCalled();
  });

  it("responde un adjunto con un texto fijo y sin llamar a la IA", async () => {
    const deps = crearDeps();

    await procesarMensajes([{ senderId: "111", mid: "mid.foto", texto: null }], deps);

    expect(deps.reclamarMensaje).toHaveBeenCalledWith("111", "mid.foto", "[El cliente envió un adjunto]");
    expect(deps.responderIA).not.toHaveBeenCalled();
    expect(deps.obtenerHistorial).not.toHaveBeenCalled();
    expect(deps.obtenerStockTexto).not.toHaveBeenCalled();
    expect(deps.enviar).toHaveBeenCalledWith("111", MENSAJE_ADJUNTO);
    expect(deps.guardarRespuesta).toHaveBeenCalledWith("111", MENSAJE_ADJUNTO);
  });

  it("guarda el lead cuando la IA lo pide y igual envia la respuesta", async () => {
    const lead = { nombre: "Juan", telefono: "3537 123456" };
    const deps = crearDeps({
      responderIA: vi.fn(async () => ({ texto: "¡Listo, Juan!", lead })),
    });

    await procesarMensajes([mensaje], deps);

    expect(deps.guardarLead).toHaveBeenCalledWith("111", lead);
    expect(deps.enviar).toHaveBeenCalledWith("111", "¡Listo, Juan!");
  });

  it("si falla el guardado del lead, no le confirma al cliente y lo deriva al WhatsApp", async () => {
    const deps = crearDeps({
      responderIA: vi.fn(async () => ({
        texto: "¡Listo!",
        lead: { nombre: "Juan", telefono: "123" },
      })),
      guardarLead: vi.fn(async () => {
        throw new Error("base caida");
      }),
    });

    await procesarMensajes([mensaje], deps);

    expect(deps.enviar).toHaveBeenCalledOnce();
    expect(deps.enviar).toHaveBeenCalledWith("111", MENSAJE_LEAD_FALLIDO);
    expect(deps.enviar).not.toHaveBeenCalledWith("111", "¡Listo!");
    expect(deps.guardarRespuesta).toHaveBeenCalledWith("111", MENSAJE_LEAD_FALLIDO);
  });

  it("el mensaje de lead fallido incluye el WhatsApp del local", async () => {
    expect(MENSAJE_LEAD_FALLIDO).toContain(EMPRESA.whatsapp);
  });

  it("si falla la IA, le avisa al cliente del problema tecnico y no lanza", async () => {
    const deps = crearDeps({
      responderIA: vi.fn(async () => {
        throw new Error("Anthropic caido");
      }),
    });

    await expect(procesarMensajes([mensaje], deps)).resolves.toBeUndefined();

    expect(deps.enviar).toHaveBeenCalledWith("111", MENSAJE_ERROR_TECNICO);
  });

  it("un mensaje que falla no impide procesar el siguiente del lote", async () => {
    const responderIA = vi
      .fn<DepsBot["responderIA"]>()
      .mockRejectedValueOnce(new Error("fallo puntual"))
      .mockResolvedValueOnce({ texto: "Segunda respuesta", lead: null });
    const deps = crearDeps({ responderIA });

    await procesarMensajes(
      [mensaje, { senderId: "222", mid: "mid.2", texto: "Buenas" }],
      deps,
    );

    expect(deps.enviar).toHaveBeenCalledWith("111", MENSAJE_ERROR_TECNICO);
    expect(deps.enviar).toHaveBeenCalledWith("222", "Segunda respuesta");
  });

  it("no lanza aunque el envio falle siempre (token vencido, ventana de 24 h cerrada)", async () => {
    const deps = crearDeps({
      enviar: vi.fn(async () => {
        throw new Error("Graph API 400");
      }),
    });

    await expect(procesarMensajes([mensaje], deps)).resolves.toBeUndefined();
  });

  it("si falla guardar la respuesta ya enviada, no manda un segundo mensaje de error", async () => {
    const deps = crearDeps({
      guardarRespuesta: vi.fn(async () => {
        throw new Error("base caida");
      }),
    });

    await procesarMensajes([mensaje], deps);

    expect(deps.enviar).toHaveBeenCalledTimes(1);
  });

  it("procesa el lote en orden", async () => {
    const orden: string[] = [];
    const deps = crearDeps({
      enviar: vi.fn(async (senderId: string) => {
        orden.push(senderId);
      }),
    });

    await procesarMensajes(
      [
        { senderId: "A", mid: "mid.a", texto: "uno" },
        { senderId: "B", mid: "mid.b", texto: "dos" },
      ],
      deps,
    );

    expect(orden).toEqual(["A", "B"]);
  });
});
