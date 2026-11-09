import { describe, expect, it } from "vitest";
import type { MensajeWebFila } from "./bot/web/estadisticas";
import { FILTROS, type ConversacionResumen } from "./conversaciones";
import {
  canalDeUrl,
  esIdVisitante,
  filtrarConversacionesWeb,
  filtroParaCanal,
  filtrosDelCanal,
  hrefConversaciones,
  hrefDetalle,
  mensajesWebComoIg,
  ultimoAutoConsultado,
} from "./conversaciones-canal";

const fila = (parcial: Partial<MensajeWebFila>): MensajeWebFila => ({
  visitante: "abc-12345678",
  role: "user",
  content: "hola",
  tipo: "texto",
  vehiculo_slug: null,
  nota: null,
  created_at: "2026-11-09T15:00:00.000Z",
  ...parcial,
});

describe("canalDeUrl", () => {
  it("solo ?canal=web es la página; lo demás es Instagram", () => {
    expect(canalDeUrl("web")).toBe("web");
    expect(canalDeUrl(undefined)).toBe("instagram");
    expect(canalDeUrl("instagram")).toBe("instagram");
    expect(canalDeUrl("cualquier-cosa")).toBe("instagram");
  });
});

describe("hrefConversaciones", () => {
  it("Instagram queda igual que antes (sin canal)", () => {
    expect(hrefConversaciones({ dias: 30, filtro: "todas" })).toBe("/admin/conversaciones?dias=30&filtro=todas");
    expect(hrefConversaciones({ dias: 7, filtro: "fallas", canal: "instagram" })).toBe("/admin/conversaciones?dias=7&filtro=fallas");
  });
  it("la página agrega canal=web y conserva dias y filtro", () => {
    expect(hrefConversaciones({ dias: 90, filtro: "fallas", canal: "web" })).toBe("/admin/conversaciones?dias=90&filtro=fallas&canal=web");
  });
});

describe("hrefDetalle", () => {
  it("Instagram sin canal, la página con ?canal=web", () => {
    expect(hrefDetalle("12345678")).toBe("/admin/conversaciones/12345678");
    expect(hrefDetalle("abc-12345678", "web")).toBe("/admin/conversaciones/abc-12345678?canal=web");
  });
});

describe("filtros por canal", () => {
  it("Instagram tiene todos; la página no tiene Postulaciones ni Dejaron sus datos", () => {
    expect(filtrosDelCanal("instagram")).toBe(FILTROS);
    expect(filtrosDelCanal("web").map((f) => f.valor)).toEqual(["todas", "fallas"]);
  });
  it("un filtro que la página no tiene vale como todas", () => {
    expect(filtroParaCanal("postulaciones", "web")).toBe("todas");
    expect(filtroParaCanal("datos", "web")).toBe("todas");
    expect(filtroParaCanal("fallas", "web")).toBe("fallas");
    expect(filtroParaCanal("postulaciones", "instagram")).toBe("postulaciones");
  });
  it("fallas deja solo las que tienen mensajes no entendidos", () => {
    const base = {
      nombre: "Visitante",
      usuario: null,
      mensajes: 1,
      primerMensaje: "",
      ultimoMensaje: "",
      ultimoTexto: "",
      ultimoEsDelCliente: true,
      postulo: false,
      dejoDatos: false,
    };
    const a: ConversacionResumen = { ...base, id: "a", noEntendidos: 0 };
    const b: ConversacionResumen = { ...base, id: "b", noEntendidos: 2 };
    expect(filtrarConversacionesWeb([a, b], "fallas").map((c) => c.id)).toEqual(["b"]);
    expect(filtrarConversacionesWeb([a, b], "todas").map((c) => c.id)).toEqual(["a", "b"]);
  });
});

describe("mensajesWebComoIg", () => {
  it("adapta las filas del chat web a la forma de ChatConversacion", () => {
    const r = mensajesWebComoIg([fila({ content: "bmw", nota: "no_entendido", tipo: "tarjetas", vehiculo_slug: "x" })]);
    expect(r).toEqual([{ ig_user_id: "abc-12345678", role: "user", content: "bmw", created_at: "2026-11-09T15:00:00.000Z", nota: "no_entendido" }]);
  });
});

describe("ultimoAutoConsultado", () => {
  it("devuelve el último vehiculo_slug de la charla, o null", () => {
    expect(ultimoAutoConsultado([fila({ vehiculo_slug: "a" }), fila({}), fila({ vehiculo_slug: "b" }), fila({})])).toBe("b");
    expect(ultimoAutoConsultado([fila({})])).toBeNull();
    expect(ultimoAutoConsultado([])).toBeNull();
  });
});

describe("esIdVisitante", () => {
  it("acepta letras, números y guiones de 8 a 64; rechaza el resto", () => {
    expect(esIdVisitante("3f2b9c1e-aaaa-4bbb-8ccc-1234567890ab")).toBe(true);
    expect(esIdVisitante("abcd1234")).toBe(true);
    expect(esIdVisitante("corto")).toBe(false);
    expect(esIdVisitante("a".repeat(65))).toBe(false);
    expect(esIdVisitante("con espacio 1234")).toBe(false);
    expect(esIdVisitante("../../etc/passwd")).toBe(false);
    expect(esIdVisitante("abc_12345678")).toBe(false);
  });
});
