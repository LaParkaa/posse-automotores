import { describe, expect, it } from "vitest";
import { postulacionIntro, postulacionListo } from "./bot/textos";
import {
  armarConversaciones, esCierrePostulacion, fechaHora, filtroDeUrl, nombreDeConversacion, resumirBot,
  type LeadIg, type MensajeIg,
} from "./conversaciones";

// 27/10/2026 15:00 en Argentina (UTC-3) = 18:00 UTC.
const AHORA = "2026-10-27T18:00:00Z";

const msg = (id: string, role: "user" | "assistant", content: string, created_at: string, nota: string | null = null): MensajeIg => ({
  ig_user_id: id, role, content, created_at, nota,
});

describe("esCierrePostulacion", () => {
  it("reconoce todas las variantes del cierre que manda el bot (si cambia el texto, este test avisa)", () => {
    for (const texto of postulacionListo("Rebeca", "Marcos")) expect(esCierrePostulacion(texto), texto).toBe(true);
  });

  it("no toma la introduccion de la postulacion por un cierre", () => {
    for (const texto of postulacionIntro("Rebeca")) expect(esCierrePostulacion(texto), texto).toBe(false);
    expect(esCierrePostulacion("Escribile a Marcos por WhatsApp al +54 9 3537 66-2444 y mandale tu CV")).toBe(false);
  });
});

describe("resumirBot", () => {
  it("sin mensajes devuelve ceros y un lugar por dia", () => {
    const r = resumirBot([], [], 7, AHORA);

    expect([r.personas, r.mensajesRecibidos, r.respuestasDelBot, r.dejaronDatos, r.postulaciones]).toEqual([0, 0, 0, 0, 0]);
    expect(r.porcentajeEntendido).toBeNull();
    expect(r.porDia).toHaveLength(7);
    expect(r.porDia[6]).toMatchObject({ dia: "2026-10-27", etiqueta: "27 oct", personas: 0 });
  });

  it("cuenta personas distintas, mensajes y respuestas", () => {
    const r = resumirBot(
      [
        msg("a", "user", "Precio?", "2026-10-27T15:00:00Z"), msg("a", "assistant", "Hola", "2026-10-27T15:00:05Z"),
        msg("a", "user", "Gracias", "2026-10-27T15:01:00Z"), msg("b", "user", "Hola", "2026-10-26T12:00:00Z"),
      ],
      [], 7, AHORA,
    );

    expect(r.personas).toBe(2);
    expect(r.mensajesRecibidos).toBe(3);
    expect(r.respuestasDelBot).toBe(1);
  });

  it("calcula el porcentaje de mensajes que el bot entendio", () => {
    const r = resumirBot(
      [
        msg("a", "user", "1", "2026-10-27T15:00:00Z"), msg("a", "user", "2", "2026-10-27T15:00:00Z"),
        msg("a", "user", "3", "2026-10-27T15:00:00Z"), msg("a", "user", "???", "2026-10-27T15:00:00Z", "no_entendido"),
      ],
      [], 7, AHORA,
    );

    expect(r.noEntendidos).toBe(1);
    expect(r.porcentajeEntendido).toBe(75);
  });

  it("cuenta las postulaciones terminadas una sola vez por persona", () => {
    const [cierre] = postulacionListo("Rebeca", "Marcos");
    const r = resumirBot(
      [msg("a", "assistant", cierre, "2026-10-27T15:00:00Z"), msg("a", "assistant", cierre, "2026-10-27T16:00:00Z"), msg("b", "assistant", "Hola", "2026-10-27T15:00:00Z")],
      [], 7, AHORA,
    );

    expect(r.postulaciones).toBe(1);
  });

  it("cuenta los que dejaron datos (leads de Instagram dentro del periodo)", () => {
    const leads: LeadIg[] = [
      { instagram_id: "a", created_at: "2026-10-27T15:00:00Z" }, { instagram_id: "a", created_at: "2026-10-26T15:00:00Z" },
      { instagram_id: null, created_at: "2026-10-27T15:00:00Z" }, { instagram_id: "c", created_at: "2026-09-01T15:00:00Z" },
    ];

    expect(resumirBot([], leads, 7, AHORA).dejaronDatos).toBe(1);
  });

  it("las personas que volvieron escribieron en dos dias distintos", () => {
    const r = resumirBot(
      [msg("a", "user", "x", "2026-10-26T15:00:00Z"), msg("a", "user", "y", "2026-10-27T15:00:00Z"), msg("b", "user", "z", "2026-10-27T15:00:00Z"), msg("b", "user", "w", "2026-10-27T16:00:00Z")],
      [], 7, AHORA,
    );

    expect(r.volvieron).toBe(1);
  });

  it("agrupa por dia argentino y deja afuera lo que cae fuera del periodo", () => {
    const r = resumirBot(
      [msg("a", "user", "x", "2026-10-28T02:00:00Z"), msg("b", "user", "y", "2026-10-01T12:00:00Z")],
      [], 7, AHORA,
    );

    expect(r.porDia.find((d) => d.dia === "2026-10-27")?.personas).toBe(1);
    expect(r.personas).toBe(1);
  });
});

describe("armarConversaciones", () => {
  const [cierre] = postulacionListo("Rebeca", "Marcos");
  const mensajes = [
    msg("a", "user", "Precio?", "2026-10-26T10:00:00Z"), msg("a", "assistant", "¿Qué vehículo buscás?", "2026-10-26T10:00:05Z"),
    msg("b", "user", "Cv", "2026-10-27T10:00:00Z"), msg("b", "assistant", cierre, "2026-10-27T10:05:00Z"),
    msg("c", "user", "asdf", "2026-10-25T10:00:00Z", "no_entendido"),
  ];
  const perfiles = [
    { ig_user_id: "a", nombre: "Ana Pérez", usuario: "anap" }, { ig_user_id: "b", nombre: null, usuario: "rebe" },
  ];

  it("una fila por persona, la mas reciente primero", () => {
    const filas = armarConversaciones(mensajes, perfiles, new Set());

    expect(filas.map((f) => f.id)).toEqual(["b", "a", "c"]);
    expect(filas[1]).toMatchObject({ nombre: "Ana Pérez", mensajes: 2, ultimoTexto: "¿Qué vehículo buscás?", ultimoEsDelCliente: false });
  });

  it("usa el @usuario o los ultimos numeros del id cuando no hay nombre", () => {
    expect(nombreDeConversacion("123456", { ig_user_id: "123456", nombre: null, usuario: "rebe" })).toBe("@rebe");
    expect(nombreDeConversacion("123456", undefined)).toBe("Persona …3456");
  });

  it("marca fallas, postulaciones y datos dejados", () => {
    const filas = armarConversaciones(mensajes, perfiles, new Set(["a"]));
    const por = (id: string) => filas.find((f) => f.id === id)!;

    expect(por("c").noEntendidos).toBe(1);
    expect(por("b").postulo).toBe(true);
    expect(por("a").dejoDatos).toBe(true);
    expect(por("a").postulo).toBe(false);
  });

  it("los filtros dejan solo lo que corresponde", () => {
    const ids = (f: Parameters<typeof armarConversaciones>[3]) => armarConversaciones(mensajes, perfiles, new Set(["a"]), f).map((x) => x.id);

    expect(ids("fallas")).toEqual(["c"]);
    expect(ids("postulaciones")).toEqual(["b"]);
    expect(ids("datos")).toEqual(["a"]);
    expect(ids("todas")).toHaveLength(3);
  });

  it("corta la vista previa de un mensaje largo", () => {
    const [fila] = armarConversaciones([msg("a", "user", "x".repeat(300), "2026-10-26T10:00:00Z")], [], new Set());

    expect(Array.from(fila.ultimoTexto).length).toBe(90);
    expect(fila.ultimoTexto.endsWith("…")).toBe(true);
  });
});

describe("fechaHora y filtroDeUrl", () => {
  it("muestra la hora argentina", () => {
    expect(fechaHora("2026-10-27T18:04:00Z")).toBe("27 oct, 15:04");
    expect(fechaHora("2026-10-28T02:30:00Z")).toBe("27 oct, 23:30");
  });

  it("solo acepta filtros conocidos", () => {
    expect(filtroDeUrl("fallas")).toBe("fallas");
    expect(filtroDeUrl("cualquier cosa")).toBe("todas");
    expect(filtroDeUrl(undefined)).toBe("todas");
  });
});
