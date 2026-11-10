import { describe, expect, it } from "vitest";
import { CATALOGO } from "../__fixtures__/catalogo";
import { NEGOCIO } from "../negocio";
import type { VehiculoCatalogo } from "../types";
import { avanzarGuion, guionNuevo, preguntaPendiente, type ContextoGuion } from "./guiones";

const auto = CATALOGO.find((v) => v.slug === "vw-vento-2-5-advance-2015")!;
const ctxCon = (vehiculo: VehiculoCatalogo | null, extra?: string): ContextoGuion => ({
  vehiculo,
  extra,
  negocio: NEGOCIO,
  siteUrl: "https://posse.example",
});
const ctx = ctxCon(auto);
const textos = (r: ReturnType<typeof avanzarGuion>) =>
  r.mensajes.flatMap((m) => (m.tipo === "texto" || m.tipo === "cierre" ? [m.texto] : []));
const ultimo = (r: ReturnType<typeof avanzarGuion>) => r.mensajes[r.mensajes.length - 1];

describe("avanzarGuion: financiar", () => {
  it("pregunta el anticipo, después las cuotas, y cierra con el mensaje para Marcos", () => {
    const r1 = avanzarGuion(guionNuevo(), { opcion: "financiar" }, ctx);
    expect(r1.guion.flujo).toBe("financiar");
    expect(r1.guion.paso).toBe("anticipo");
    expect(r1.mensajes).toEqual([{ tipo: "texto", texto: "Dale. ¿Con cuánto pensás entregar?" }]);
    expect(r1.sugerencias).toEqual(["anticipo_sin", "anticipo_hasta_3", "anticipo_mas_3"]);

    const r2 = avanzarGuion(r1.guion, { opcion: "anticipo_hasta_3" }, ctx);
    expect(r2.guion.paso).toBe("cuotas");
    expect(r2.guion.datos.anticipo).toBe("hasta 3 millones");
    expect(r2.sugerencias).toEqual(["cuotas_12", "cuotas_24", "cuotas_36", "cuotas_48"]);

    const r3 = avanzarGuion(r2.guion, { opcion: "cuotas_24" }, ctx);
    const cierre = ultimo(r3);
    expect(cierre.tipo).toBe("cierre");
    if (cierre.tipo !== "cierre") throw new Error("no es cierre");
    expect(cierre.texto).toContain("Anticipo: hasta 3 millones.");
    expect(cierre.texto).toContain("Cuotas: 24.");
    expect(cierre.texto).toContain("Volkswagen Vento 2.5 Advance 2015");
    expect(cierre.url).toContain("https://wa.me/");
    expect(cierre.vehiculoSlug).toBe(auto.slug);
    expect(r3.guion).toEqual(guionNuevo());
    expect(r3.sugerencias).toEqual(["seguir", "marcos"]);
  });

  it("con un usado ya dicho, ofrece 'solo el usado' primero y el cierre incluye el extra", () => {
    const c = ctxCon(auto, "Tengo para entregar: bmw 2016.");
    const r1 = avanzarGuion(guionNuevo(), { opcion: "financiar" }, c);
    expect(textos(r1)).toEqual(["Dale, tomamos tu usado como parte de pago. ¿Entregás algo más en efectivo?"]);
    expect(r1.sugerencias[0]).toBe("anticipo_solo_usado");
    const r2 = avanzarGuion(r1.guion, { opcion: "anticipo_solo_usado" }, c);
    const r3 = avanzarGuion(r2.guion, { opcion: "cuotas_36" }, c);
    const cierre = ultimo(r3);
    if (cierre.tipo !== "cierre") throw new Error("no es cierre");
    expect(cierre.texto).toContain("Tengo para entregar: bmw 2016.");
    expect(cierre.texto).toContain("Anticipo: solo el usado.");
  });

  it("el texto libre en el paso del anticipo se toma tal cual", () => {
    const r1 = avanzarGuion(guionNuevo(), { opcion: "financiar" }, ctx);
    const r2 = avanzarGuion(r1.guion, { texto: "tengo 2 palos" }, ctx);
    expect(r2.guion.paso).toBe("cuotas");
    expect(r2.guion.datos.anticipo).toBe("tengo 2 palos");
    const r3 = avanzarGuion(r2.guion, { opcion: "cuotas_12" }, ctx);
    const cierre = ultimo(r3);
    if (cierre.tipo !== "cierre") throw new Error("no es cierre");
    expect(cierre.texto).toContain("Anticipo: tengo 2 palos.");
  });

  it("un caracter astral justo en el tope de largo no rompe el link", () => {
    const r1 = avanzarGuion(guionNuevo(), { opcion: "financiar" }, ctx);
    const r2 = avanzarGuion(r1.guion, { texto: "a".repeat(199) + "\u{1D7D9}" + "x" }, ctx);
    expect(Array.from(r2.guion.datos.anticipo ?? "")).toHaveLength(200);
    const r3 = avanzarGuion(r2.guion, { opcion: "cuotas_12" }, ctx);
    const cierre = ultimo(r3);
    if (cierre.tipo !== "cierre") throw new Error("no es cierre");
    expect(cierre.url.startsWith("https://wa.me/")).toBe(true);
    expect(decodeURIComponent(cierre.url.split("text=")[1])).toBe(cierre.texto);
  });

  it("un suplente suelto que llega por JSON no tira error", () => {
    const r1 = avanzarGuion(guionNuevo(), { opcion: "usado" }, ctx);
    const r2 = avanzarGuion(r1.guion, { texto: "\ud800 hola" }, ctx);
    const cierre = ultimo(r2);
    if (cierre.tipo !== "cierre") throw new Error("no es cierre");
    expect(cierre.texto).toContain("Tengo para entregar: hola.");
    expect(decodeURIComponent(cierre.url.split("text=")[1])).toBe(cierre.texto);
  });

  it("las sugerencias no comparten arrays entre llamadas", () => {
    const a = avanzarGuion(guionNuevo(), { opcion: "marcos" }, ctx).sugerencias;
    a.push("buscar");
    expect(avanzarGuion(guionNuevo(), { opcion: "marcos" }, ctx).sugerencias).toEqual(["seguir", "marcos"]);
  });

  it("no muta el guion que recibe", () => {
    const g = avanzarGuion(guionNuevo(), { opcion: "financiar" }, ctx).guion;
    const copia = JSON.parse(JSON.stringify(g));
    avanzarGuion(g, { opcion: "anticipo_sin" }, ctx);
    expect(g).toEqual(copia);
  });

  it("el guion es JSON plano", () => {
    const g = avanzarGuion(guionNuevo(), { opcion: "anticipo_sin" }, ctx).guion;
    expect(JSON.parse(JSON.stringify(g))).toEqual(g);
  });
});

describe("avanzarGuion: usado", () => {
  it("pide el auto, sin chips, y cierra con lo que escribió", () => {
    const r1 = avanzarGuion(guionNuevo(), { opcion: "usado" }, ctx);
    expect(r1.guion.flujo).toBe("usado");
    expect(r1.guion.paso).toBe("usado");
    expect(r1.sugerencias).toEqual([]);
    const r2 = avanzarGuion(r1.guion, { texto: "Hilux 2015" }, ctx);
    const cierre = ultimo(r2);
    if (cierre.tipo !== "cierre") throw new Error("no es cierre");
    expect(cierre.texto).toContain("Tengo para entregar: Hilux 2015.");
    expect(r2.guion).toEqual(guionNuevo());
  });

  it("tocar 'usado' dentro del paso de cuotas reemplaza el guion", () => {
    const g = avanzarGuion(avanzarGuion(guionNuevo(), { opcion: "financiar" }, ctx).guion, { opcion: "anticipo_sin" }, ctx).guion;
    expect(g.paso).toBe("cuotas");
    const r = avanzarGuion(g, { opcion: "usado" }, ctx);
    expect(r.guion.flujo).toBe("usado");
    expect(r.guion.paso).toBe("usado");
    expect(r.guion.datos).toEqual({});
  });
});

describe("avanzarGuion: disponible", () => {
  const conEstado = (estado: VehiculoCatalogo["estado"]) => ctxCon({ ...auto, estado });

  it("vendido: avisa y ofrece buscar otro o hablar con Marcos", () => {
    const r = avanzarGuion(guionNuevo(), { opcion: "disponible" }, conEstado("vendido"));
    expect(textos(r).join(" ")).toContain("se vendió");
    expect(r.sugerencias).toEqual(["buscar", "marcos"]);
    expect(r.guion).toEqual(guionNuevo());
  });

  it("vendido o reservado: Hablar con Marcos no pregunta si sigue disponible", () => {
    for (const estado of ["vendido", "reservado"] as const) {
      const r = avanzarGuion(guionNuevo(), { opcion: "marcos" }, conEstado(estado));
      const cierre = ultimo(r);
      if (cierre.tipo !== "cierre") throw new Error("no es cierre");
      expect(cierre.texto).toContain("Me interesa el Volkswagen Vento");
      expect(cierre.texto).not.toContain("¿Sigue disponible?");
    }
    const r = avanzarGuion(guionNuevo(), { opcion: "marcos" }, conEstado("disponible"));
    const cierre = ultimo(r);
    if (cierre.tipo !== "cierre") throw new Error("no es cierre");
    expect(cierre.texto).toContain("¿Sigue disponible?");
  });

  it("reservado: lo dice", () => {
    const r = avanzarGuion(guionNuevo(), { opcion: "disponible" }, conEstado("reservado"));
    expect(textos(r).join(" ")).toContain("reservado");
  });

  it("disponible: ofrece que Marcos confirme; sí cierra y ver financiación arranca ese flujo", () => {
    const c = conEstado("disponible");
    const r1 = avanzarGuion(guionNuevo(), { opcion: "disponible" }, c);
    expect(textos(r1).join(" ")).toContain("Marcos");
    expect(r1.sugerencias).toEqual(["confirmar_si", "ver_financiacion"]);

    const r2 = avanzarGuion(r1.guion, { opcion: "confirmar_si" }, c);
    const cierre = ultimo(r2);
    if (cierre.tipo !== "cierre") throw new Error("no es cierre");
    expect(cierre.texto).toContain("Quiero que me confirmen si sigue disponible y que me manden fotos y video.");

    const r3 = avanzarGuion(r1.guion, { opcion: "ver_financiacion" }, c);
    expect(r3.guion.flujo).toBe("financiar");
    expect(r3.guion.paso).toBe("anticipo");
  });

  it("sin auto en pantalla no inventa disponibilidad", () => {
    const r = avanzarGuion(guionNuevo(), { opcion: "disponible" }, ctxCon(null));
    expect(r.guion).toEqual(guionNuevo());
    expect(r.sugerencias).toEqual(["buscar", "marcos"]);
  });
});

describe("avanzarGuion: marcos", () => {
  it("cierra directo", () => {
    const r = avanzarGuion(guionNuevo(), { opcion: "marcos" }, ctx);
    const cierre = ultimo(r);
    if (cierre.tipo !== "cierre") throw new Error("no es cierre");
    expect(cierre.texto).toContain("Quiero hablar con alguien del equipo.");
    expect(r.sugerencias).toEqual(["seguir", "marcos"]);
  });

  it("sin auto el mensaje igual sale", () => {
    const r = avanzarGuion(guionNuevo(), { opcion: "marcos" }, ctxCon(null));
    const cierre = ultimo(r);
    if (cierre.tipo !== "cierre") throw new Error("no es cierre");
    expect(cierre.vehiculoSlug).toBeNull();
    expect(cierre.texto).toContain("Quiero consultar por un vehículo.");
  });
});

describe("preguntaPendiente", () => {
  it("devuelve la pregunta del paso en curso", () => {
    const g = avanzarGuion(guionNuevo(), { opcion: "financiar" }, ctx).guion;
    expect(preguntaPendiente(g, ctx)).toEqual({ tipo: "texto", texto: "Dale. ¿Con cuánto pensás entregar?" });
  });

  it("sin guion en curso devuelve null", () => {
    expect(preguntaPendiente(guionNuevo(), ctx)).toBeNull();
  });
});
