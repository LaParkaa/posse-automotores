import { describe, expect, it, vi } from "vitest";
import { ErrorBusqueda } from "./buscadores";
import { ErrorDescarga, type ImagenDescargada } from "./descargar";
import { buscarYGuardarLlave, type DepsSincronizar } from "./sincronizar";

const IMAGEN: ImagenDescargada = { contentType: "image/jpeg", ext: "jpg", bytes: new Uint8Array([0xff, 0xd8, 0xff]) };
const AUTO = { marca: "Chevrolet", modelo: "Cruze", anio: 2018 };

function deps(parcial: Partial<DepsSincronizar> = {}): DepsSincronizar {
  return {
    buscar: vi.fn(async () => ["https://a.com/1.jpg", "https://b.com/2.jpg"]),
    descargar: vi.fn(async () => IMAGEN),
    guardar: vi.fn(async () => "https://storage/llaves/auto.jpg"),
    ahora: () => 0,
    ...parcial,
  };
}

describe("buscarYGuardarLlave", () => {
  it("busca con la consulta del auto y guarda la primera imagen que sirve", async () => {
    const d = deps();
    const r = await buscarYGuardarLlave(AUTO, d);

    expect(r).toEqual({ ok: true, url: "https://storage/llaves/auto.jpg" });
    expect(d.buscar).toHaveBeenCalledWith("llave Chevrolet Cruze 2018 original");
    expect(d.descargar).toHaveBeenCalledTimes(1);
    expect(d.guardar).toHaveBeenCalledWith(IMAGEN);
  });

  it("salta las candidatas que no se pueden bajar", async () => {
    const descargar = vi
      .fn()
      .mockRejectedValueOnce(new ErrorDescarga("404"))
      .mockResolvedValueOnce(IMAGEN);
    const d = deps({ descargar });

    const r = await buscarYGuardarLlave(AUTO, d);
    expect(r.ok).toBe(true);
    expect(descargar).toHaveBeenNthCalledWith(2, "https://b.com/2.jpg");
  });

  it("si ninguna sirve devuelve sin_resultados", async () => {
    const d = deps({ descargar: vi.fn(async () => Promise.reject(new ErrorDescarga("no es imagen"))) });
    const r = await buscarYGuardarLlave(AUTO, d);
    expect(r).toMatchObject({ ok: false, codigo: "sin_resultados" });
    expect(d.guardar).not.toHaveBeenCalled();
  });

  it("si el buscador no trae nada devuelve sin_resultados", async () => {
    const r = await buscarYGuardarLlave(AUTO, deps({ buscar: vi.fn(async () => []) }));
    expect(r).toMatchObject({ ok: false, codigo: "sin_resultados" });
  });

  it("sin proveedor configurado lo informa para poder explicarlo", async () => {
    const buscar = vi.fn(async () => Promise.reject(new ErrorBusqueda("sin_proveedor", "Falta configurar")));
    const r = await buscarYGuardarLlave(AUTO, deps({ buscar }));
    expect(r).toEqual({ ok: false, codigo: "sin_proveedor", error: "Falta configurar" });
  });

  it("si el proveedor falla devuelve fallo con su mensaje", async () => {
    const buscar = vi.fn(async () => Promise.reject(new ErrorBusqueda("proveedor", "Serper respondió 429")));
    const r = await buscarYGuardarLlave(AUTO, deps({ buscar }));
    expect(r).toEqual({ ok: false, codigo: "fallo", error: "Serper respondió 429" });
  });

  it("si falla el guardado corta: no prueba otras imágenes", async () => {
    const d = deps({ guardar: vi.fn(async () => Promise.reject(new Error("cuota llena"))) });
    const r = await buscarYGuardarLlave(AUTO, d);
    expect(r).toEqual({ ok: false, codigo: "fallo", error: "cuota llena" });
    expect(d.descargar).toHaveBeenCalledTimes(1);
  });

  it("un error inesperado al bajar corta con fallo", async () => {
    const d = deps({ descargar: vi.fn(async () => Promise.reject(new TypeError("boom"))) });
    const r = await buscarYGuardarLlave(AUTO, d);
    expect(r).toEqual({ ok: false, codigo: "fallo", error: "boom" });
  });

  it("respeta el presupuesto de tiempo: no sigue probando candidatas", async () => {
    let reloj = 0;
    const descargar = vi.fn(async () => {
      reloj += 15_000;
      throw new ErrorDescarga("lenta");
    });
    const cuatro = vi.fn(async () => ["https://a.com/1.jpg", "https://a.com/2.jpg", "https://a.com/3.jpg", "https://a.com/4.jpg"]);
    const d = deps({ descargar, buscar: cuatro, ahora: () => reloj, presupuestoMs: 20_000 });

    const r = await buscarYGuardarLlave(AUTO, d);
    expect(r).toMatchObject({ ok: false, codigo: "sin_resultados" });
    expect(descargar).toHaveBeenCalledTimes(2); // la tercera ya está fuera del presupuesto
  });
});
