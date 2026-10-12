import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchConTope } from "./fetch-con-tope";

describe("fetchConTope", () => {
  afterEach(() => vi.restoreAllMocks());

  it("agrega una senal con tope de tiempo cuando el pedido no trae ninguna", async () => {
    const base = vi.fn<typeof fetch>(async () => new Response("{}"));
    const timeout = vi.spyOn(AbortSignal, "timeout");

    await fetchConTope(6000, base)("https://db.example/rest", { method: "GET" });

    expect(timeout).toHaveBeenCalledWith(6000);
    const init = base.mock.calls[0][1] as RequestInit;
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.method).toBe("GET");
  });

  it("conserva la senal existente: si el llamador aborta, el pedido se aborta", async () => {
    const base = vi.fn<typeof fetch>(async () => new Response("{}"));
    const llamador = new AbortController();

    await fetchConTope(6000, base)("https://db.example/rest", { signal: llamador.signal });

    const senal = (base.mock.calls[0][1] as RequestInit).signal as AbortSignal;
    expect(senal.aborted).toBe(false);
    llamador.abort();
    expect(senal.aborted).toBe(true);
  });

  it("aborta cuando se cumple el tope aunque el pedido nunca responda", async () => {
    vi.useFakeTimers();
    try {
      const base = vi.fn((_url: unknown, init?: RequestInit) =>
        new Promise<Response>((_ok, fallar) => init?.signal?.addEventListener("abort", () => fallar(new Error("abortado")))),
      );
      // AbortSignal.timeout usa un timer interno que no se simula: se reemplaza por uno controlable.
      vi.spyOn(AbortSignal, "timeout").mockImplementation((ms) => {
        const c = new AbortController();
        setTimeout(() => c.abort(), ms);
        return c.signal;
      });

      const pedido = fetchConTope(6000, base)("https://db.example/rest");
      const resultado = expect(pedido).rejects.toThrow("abortado");
      await vi.advanceTimersByTimeAsync(6000);
      await resultado;
    } finally {
      vi.useRealTimers();
    }
  });
});
