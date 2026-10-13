import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EventoEntrante } from "../instagram/payload";
import { CATALOGO } from "./__fixtures__/catalogo";
import { violacionesDeTono } from "./__fixtures__/tono";
import { ErrorEnvioParcial } from "../instagram/graph";
import { type DepsBot, MENSAJE_ERROR_TECNICO, MENSAJE_LEAD_FALLIDO, procesarEventos } from "./handler";
import { conversar, type ResultadoMotor } from "./motor";
import { NEGOCIO } from "./negocio";
import { sesionNueva } from "./sesion";
import { tarjetaContacto } from "./respuestas";
import type { Tarjeta } from "./types";

// El motor ya tiene sus propios tests: aca se controla lo que devuelve para probar solo el flujo del handler.
vi.mock("./motor", () => ({ conversar: vi.fn() }));

const AHORA = new Date("2026-10-11T15:00:00Z");
const SESION = { ...sesionNueva(AHORA), saludado: true };

const TARJETA: Tarjeta = {
  titulo: "Peugeot 206 1.6",
  subtitulo: "2011 · $9.500.000",
  imagenUrl: "https://img.example/206.jpg",
  botones: [{ titulo: "Ver ficha", url: "https://sitio.example/vehiculos/peugeot-206-1-6-2011" }],
};

function resultado(parcial: Partial<ResultadoMotor> = {}): ResultadoMotor {
  return {
    mensajes: [{ tipo: "texto", texto: "¡Hola! ¿Qué andás buscando?" }],
    sesion: SESION,
    lead: null,
    aprenderHistoria: null,
    olvidarHistoria: null,
    noEntendido: false,
    responder: true,
    ...parcial,
  };
}

function crearDeps(sobrescribir: Partial<DepsBot> = {}): DepsBot {
  let n = 0;
  return {
    reclamarMensaje: vi.fn(async () => true),
    cargarChat: vi.fn(async () => ({ sesion: SESION, pausaHasta: null, perfil: { nombre: "Juan" } })),
    guardarSesion: vi.fn(async () => {}),
    catalogo: vi.fn(async () => CATALOGO),
    vehiculoDeHistoria: vi.fn(async () => null),
    aprenderHistoria: vi.fn(async () => {}),
    olvidarHistoria: vi.fn(async () => {}),
    obtenerPerfil: vi.fn(async () => null),
    guardarPerfil: vi.fn(async () => {}),
    guardarLead: vi.fn(async () => {}),
    marcarVisto: vi.fn(async () => {}),
    escribiendo: vi.fn(async () => {}),
    enviarTexto: vi.fn(async () => [`mid.out.${++n}`]),
    enviarTarjetas: vi.fn(async () => [`mid.out.${++n}`]),
    guardarSalida: vi.fn(async () => {}),
    marcarNoEntendido: vi.fn(async () => {}),
    esMidPropio: vi.fn(async () => true),
    pausar: vi.fn(async () => {}),
    esperar: vi.fn(async () => {}),
    ahora: () => AHORA,
    siteUrl: "https://sitio.example",
    negocio: NEGOCIO,
    ...sobrescribir,
  };
}

const mensaje = (parcial: Partial<Extract<EventoEntrante, { tipo: "mensaje" }>> = {}): EventoEntrante => ({
  tipo: "mensaje",
  senderId: "111",
  mid: "mid.1",
  texto: "Hola",
  historiaId: null,
  adjuntos: [],
  ...parcial,
});

const eco: EventoEntrante = { tipo: "eco", destinatarioId: "111", mid: "mid.eco", texto: "Hola, soy Nati" };

const enviado = (deps: DepsBot) => vi.mocked(deps.enviarTexto).mock.calls.map((c) => c[1]);

describe("procesarEventos: mensajes", () => {
  beforeEach(() => {
    vi.mocked(conversar).mockReset();
    vi.mocked(conversar).mockReturnValue(resultado());
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("flujo normal: reclama, carga el chat y el catalogo, contesta, guarda la sesion y la salida con los mid", async () => {
    const deps = crearDeps();
    vi.mocked(conversar).mockReturnValue(
      resultado({
        mensajes: [
          { tipo: "texto", texto: "Mirá lo que tenemos" },
          { tipo: "tarjetas", tarjetas: [TARJETA], alternativaTexto: "Peugeot 206 1.6 · $9.500.000" },
        ],
      }),
    );

    await procesarEventos([mensaje()], deps);

    expect(deps.reclamarMensaje).toHaveBeenCalledWith("111", "mid.1", "Hola");
    expect(deps.cargarChat).toHaveBeenCalledWith("111");
    expect(deps.catalogo).toHaveBeenCalledTimes(1);
    expect(vi.mocked(conversar).mock.calls[0][0]).toMatchObject({
      texto: "Hola", mid: "mid.1", sesion: SESION, catalogo: CATALOGO, ahora: AHORA,
      siteUrl: "https://sitio.example", negocio: NEGOCIO, perfil: { nombre: "Juan" },
    });
    expect(deps.enviarTexto).toHaveBeenCalledWith("111", "Mirá lo que tenemos");
    expect(deps.enviarTarjetas).toHaveBeenCalledWith("111", [TARJETA]);
    expect(deps.guardarSesion).toHaveBeenCalledWith("111", SESION);
    // Cada envio se registra apenas sale (ver "ids propios"), no todos juntos al final.
    expect(deps.guardarSalida).toHaveBeenNthCalledWith(1, "111", [{ texto: "Mirá lo que tenemos", mid: "mid.out.1" }]);
    expect(deps.guardarSalida).toHaveBeenNthCalledWith(2, "111", [{ texto: "Peugeot 206 1.6 · $9.500.000", mid: "mid.out.2" }]);
  });

  it("un adjunto sin texto se reclama como [adjunto]", async () => {
    const deps = crearDeps();

    await procesarEventos([mensaje({ texto: null, adjuntos: ["audio"] })], deps);

    expect(deps.reclamarMensaje).toHaveBeenCalledWith("111", "mid.1", "[adjunto]");
    expect(vi.mocked(conversar).mock.calls[0][0]).toMatchObject({ texto: null, adjuntos: ["audio"] });
  });

  it("un mensaje duplicado no hace nada mas", async () => {
    const deps = crearDeps({ reclamarMensaje: vi.fn(async () => false) });

    await procesarEventos([mensaje()], deps);

    expect(deps.cargarChat).not.toHaveBeenCalled();
    expect(deps.catalogo).not.toHaveBeenCalled();
    expect(conversar).not.toHaveBeenCalled();
    expect(deps.enviarTexto).not.toHaveBeenCalled();
  });

  it("con el chat pausado (pausa futura) no contesta, no mira el catalogo ni llama al motor", async () => {
    const deps = crearDeps({
      cargarChat: vi.fn(async () => ({ sesion: SESION, pausaHasta: new Date(AHORA.getTime() + 60_000), perfil: null })),
    });

    await procesarEventos([mensaje()], deps);

    expect(deps.reclamarMensaje).toHaveBeenCalled(); // el mensaje queda registrado
    expect(deps.catalogo).not.toHaveBeenCalled();
    expect(deps.marcarVisto).not.toHaveBeenCalled();
    expect(conversar).not.toHaveBeenCalled();
    expect(deps.enviarTexto).not.toHaveBeenCalled();
    expect(deps.enviarTarjetas).not.toHaveBeenCalled();
  });

  it("con la pausa vencida contesta normal", async () => {
    const deps = crearDeps({
      cargarChat: vi.fn(async () => ({ sesion: SESION, pausaHasta: new Date(AHORA.getTime() - 60_000), perfil: null })),
    });

    await procesarEventos([mensaje()], deps);

    expect(deps.enviarTexto).toHaveBeenCalledWith("111", "¡Hola! ¿Qué andás buscando?");
  });

  it("sin sesion guardada el motor arranca con una sesion nueva", async () => {
    const deps = crearDeps({ cargarChat: vi.fn(async () => ({ sesion: null, pausaHasta: null, perfil: null })) });

    await procesarEventos([mensaje()], deps);

    expect(vi.mocked(conversar).mock.calls[0][0].sesion).toEqual(sesionNueva(AHORA));
  });

  it("una tarjeta que Instagram rechaza se reemplaza por su alternativa en texto", async () => {
    const deps = crearDeps({ enviarTarjetas: vi.fn(async () => { throw new Error("formato de imagen"); }) });
    vi.mocked(conversar).mockReturnValue(
      resultado({ mensajes: [{ tipo: "tarjetas", tarjetas: [TARJETA], alternativaTexto: "Peugeot 206 1.6 · $9.500.000" }] }),
    );

    await procesarEventos([mensaje()], deps);

    expect(enviado(deps)).toEqual(["Peugeot 206 1.6 · $9.500.000"]);
    expect(deps.guardarSalida).toHaveBeenCalledWith("111", [{ texto: "Peugeot 206 1.6 · $9.500.000", mid: "mid.out.1" }]);
    expect(console.error).toHaveBeenCalled();
  });

  it("si la tarjeta falla y no hay alternativa en texto, no manda nada para ese mensaje", async () => {
    const deps = crearDeps({ enviarTarjetas: vi.fn(async () => { throw new Error("rechazada"); }) });
    vi.mocked(conversar).mockReturnValue(
      resultado({ mensajes: [{ tipo: "tarjetas", tarjetas: [TARJETA], alternativaTexto: "" }] }),
    );

    await procesarEventos([mensaje()], deps);

    expect(deps.enviarTexto).not.toHaveBeenCalled();
    expect(deps.guardarSalida).not.toHaveBeenCalled();
  });

  it("el error de una tarjeta no se loguea con tokens ni con el payload completo", async () => {
    const deps = crearDeps({
      enviarTarjetas: vi.fn(async () => { throw new Error("Bearer EAAB-secreto https://sitio.example/imagen.jpg"); }),
    });
    vi.mocked(conversar).mockReturnValue(
      resultado({ mensajes: [{ tipo: "tarjetas", tarjetas: [TARJETA], alternativaTexto: "Un auto" }] }),
    );

    await procesarEventos([mensaje()], deps);

    const logueado = JSON.stringify(vi.mocked(console.error).mock.calls.map((c) => c.map(String)));
    expect(logueado).not.toContain("EAAB-secreto");
    expect(logueado).not.toContain("imagen.jpg");
  });

  it("lead: lo guarda y manda la confirmacion del motor", async () => {
    const lead = { nombre: "Juan", telefono: "3537 123456" };
    const deps = crearDeps();
    vi.mocked(conversar).mockReturnValue(
      resultado({ lead, mensajes: [{ tipo: "texto", texto: "Listo Juan, te escribe Nati." }] }),
    );

    await procesarEventos([mensaje()], deps);

    expect(deps.guardarLead).toHaveBeenCalledWith("111", lead);
    expect(enviado(deps)).toEqual(["Listo Juan, te escribe Nati."]);
  });

  it("lead que no se pudo guardar: manda MENSAJE_LEAD_FALLIDO y NO la confirmacion", async () => {
    const deps = crearDeps({ guardarLead: vi.fn(async () => { throw new Error("db caida"); }) });
    vi.mocked(conversar).mockReturnValue(
      resultado({
        lead: { nombre: "Juan", telefono: "3537 123456" },
        mensajes: [{ tipo: "texto", texto: "Listo Juan, te escribe Nati." }],
      }),
    );

    await procesarEventos([mensaje()], deps);

    expect(enviado(deps)).toEqual([MENSAJE_LEAD_FALLIDO]);
    expect(console.error).toHaveBeenCalled();
  });

  it("historia: aprende y olvida con lo que devuelve el motor", async () => {
    const deps = crearDeps({ vehiculoDeHistoria: vi.fn(async () => "v-206") });
    vi.mocked(conversar).mockReturnValue(
      resultado({ aprenderHistoria: { storyId: "h1", vehiculoId: "v-206" }, olvidarHistoria: "h2" }),
    );

    await procesarEventos([mensaje({ historiaId: "h1" })], deps);

    expect(deps.vehiculoDeHistoria).toHaveBeenCalledWith("h1");
    expect(vi.mocked(conversar).mock.calls[0][0]).toMatchObject({ historiaId: "h1", vehiculoDeHistoria: "v-206" });
    expect(deps.aprenderHistoria).toHaveBeenCalledWith("h1", "v-206");
    expect(deps.olvidarHistoria).toHaveBeenCalledWith("h2");
  });

  it("si aprender u olvidar la historia fallan, la respuesta igual sale", async () => {
    const deps = crearDeps({
      aprenderHistoria: vi.fn(async () => { throw new Error("db"); }),
      olvidarHistoria: vi.fn(async () => { throw new Error("db"); }),
    });
    vi.mocked(conversar).mockReturnValue(
      resultado({ aprenderHistoria: { storyId: "h1", vehiculoId: "v-206" }, olvidarHistoria: "h2" }),
    );

    await procesarEventos([mensaje({ historiaId: "h1" })], deps);

    expect(enviado(deps)).toEqual(["¡Hola! ¿Qué andás buscando?"]);
    expect(deps.guardarSesion).toHaveBeenCalled();
  });

  it("sin historia no consulta el vinculo de historia", async () => {
    const deps = crearDeps();

    await procesarEventos([mensaje()], deps);

    expect(deps.vehiculoDeHistoria).not.toHaveBeenCalled();
  });

  it("catalogo null: manda MENSAJE_ERROR_TECNICO y no llama al motor", async () => {
    const deps = crearDeps({ catalogo: vi.fn(async () => null) });

    await procesarEventos([mensaje()], deps);

    expect(enviado(deps)).toEqual([MENSAJE_ERROR_TECNICO]);
    expect(conversar).not.toHaveBeenCalled();
  });

  it("catalogo que lanza se trata igual que null", async () => {
    const deps = crearDeps({ catalogo: vi.fn(async () => { throw new Error("db"); }) });

    await procesarEventos([mensaje()], deps);

    expect(enviado(deps)).toEqual([MENSAJE_ERROR_TECNICO]);
    expect(conversar).not.toHaveBeenCalled();
  });

  it("el mensaje de error tecnico queda registrado como salida propia (si no, su eco pausaria el chat)", async () => {
    const deps = crearDeps({ catalogo: vi.fn(async () => null) });

    await procesarEventos([mensaje()], deps);

    expect(deps.guardarSalida).toHaveBeenCalledWith("111", [{ texto: MENSAJE_ERROR_TECNICO, mid: "mid.out.1" }]);
  });

  it("responder:false no envia nada pero igual guarda la sesion", async () => {
    const deps = crearDeps();
    vi.mocked(conversar).mockReturnValue(resultado({ responder: false, mensajes: [] }));

    await procesarEventos([mensaje()], deps);

    expect(deps.enviarTexto).not.toHaveBeenCalled();
    expect(deps.enviarTarjetas).not.toHaveBeenCalled();
    expect(deps.escribiendo).not.toHaveBeenCalled();
    expect(deps.guardarSesion).toHaveBeenCalledWith("111", SESION);
  });

  it("noEntendido marca el mensaje del cliente", async () => {
    const deps = crearDeps();
    vi.mocked(conversar).mockReturnValue(resultado({ noEntendido: true }));

    await procesarEventos([mensaje()], deps);

    expect(deps.marcarNoEntendido).toHaveBeenCalledWith("mid.1");
  });

  it("sin noEntendido no marca nada", async () => {
    const deps = crearDeps();

    await procesarEventos([mensaje()], deps);

    expect(deps.marcarNoEntendido).not.toHaveBeenCalled();
  });

  it("los fallos de mejor esfuerzo no impiden que la respuesta salga", async () => {
    const falla = () => vi.fn(async () => { throw new Error("falla"); });
    const deps = crearDeps({
      cargarChat: vi.fn(async () => ({ sesion: SESION, pausaHasta: null, perfil: null })),
      marcarVisto: falla(),
      escribiendo: falla(),
      obtenerPerfil: falla(),
      guardarSesion: falla(),
      guardarSalida: falla(),
      marcarNoEntendido: falla(),
    });
    vi.mocked(conversar).mockReturnValue(resultado({ noEntendido: true }));

    await procesarEventos([mensaje()], deps);

    expect(enviado(deps)).toEqual(["¡Hola! ¿Qué andás buscando?"]);
    expect(deps.enviarTexto).toHaveBeenCalledTimes(1); // y no se manda ademas un mensaje de error
  });

  it("'visto', el perfil y el catalogo arrancan en paralelo", async () => {
    const orden: string[] = [];
    const deps = crearDeps({
      cargarChat: vi.fn(async () => ({ sesion: SESION, pausaHasta: null, perfil: null })),
      marcarVisto: vi.fn(async () => { orden.push("visto:inicio"); await Promise.resolve(); orden.push("visto:fin"); }),
      obtenerPerfil: vi.fn(async () => { orden.push("perfil:inicio"); await Promise.resolve(); return null; }),
      catalogo: vi.fn(async () => { orden.push("catalogo:inicio"); await Promise.resolve(); orden.push("catalogo:fin"); return CATALOGO; }),
    });

    await procesarEventos([mensaje()], deps);

    // Todos arrancan antes de que alguno termine.
    const primerFin = orden.findIndex((o) => o.endsWith(":fin"));
    expect(orden.slice(0, primerFin)).toEqual(expect.arrayContaining(["visto:inicio", "perfil:inicio", "catalogo:inicio"]));
  });

  it("perfil nuevo: si no habia y se obtiene, se guarda y el motor lo recibe", async () => {
    const perfil = { nombre: "Maria", usuario: "maria_p" };
    const deps = crearDeps({
      cargarChat: vi.fn(async () => ({ sesion: SESION, pausaHasta: null, perfil: null })),
      obtenerPerfil: vi.fn(async () => perfil),
    });

    await procesarEventos([mensaje()], deps);

    expect(deps.guardarPerfil).toHaveBeenCalledWith("111", perfil);
    expect(vi.mocked(conversar).mock.calls[0][0].perfil).toEqual(perfil);
  });

  it("si ya hay perfil no lo vuelve a pedir", async () => {
    const deps = crearDeps();

    await procesarEventos([mensaje()], deps);

    expect(deps.obtenerPerfil).not.toHaveBeenCalled();
    expect(deps.guardarPerfil).not.toHaveBeenCalled();
  });

  it("si guardar el perfil falla, igual contesta", async () => {
    const deps = crearDeps({
      cargarChat: vi.fn(async () => ({ sesion: SESION, pausaHasta: null, perfil: null })),
      obtenerPerfil: vi.fn(async () => ({ nombre: "Maria" })),
      guardarPerfil: vi.fn(async () => { throw new Error("db"); }),
    });

    await procesarEventos([mensaje()], deps);

    expect(enviado(deps)).toEqual(["¡Hola! ¿Qué andás buscando?"]);
  });

  it("escribe y espera antes de cada mensaje", async () => {
    const deps = crearDeps();
    vi.mocked(conversar).mockReturnValue(
      resultado({
        mensajes: [
          { tipo: "texto", texto: "x".repeat(10) },
          { tipo: "tarjetas", tarjetas: [TARJETA], alternativaTexto: "alt" },
        ],
      }),
    );

    await procesarEventos([mensaje()], deps);

    expect(deps.escribiendo).toHaveBeenCalledTimes(2);
    expect(vi.mocked(deps.esperar).mock.calls.map((c) => c[0])).toEqual([400 + 12 * 10, 900]);
  });

  it("la demora total por turno no pasa de 3000 ms aunque haya 3 mensajes largos", async () => {
    const deps = crearDeps();
    const largo = "x".repeat(300);
    vi.mocked(conversar).mockReturnValue(
      resultado({
        mensajes: [
          { tipo: "texto", texto: largo },
          { tipo: "texto", texto: largo },
          { tipo: "texto", texto: largo },
        ],
      }),
    );

    await procesarEventos([mensaje()], deps);

    const total = vi.mocked(deps.esperar).mock.calls.reduce((suma, c) => suma + c[0], 0);
    expect(total).toBeLessThanOrEqual(3000);
    expect(deps.enviarTexto).toHaveBeenCalledTimes(3);
  });

  it("un evento que falla no frena a los siguientes del lote", async () => {
    const deps = crearDeps({
      reclamarMensaje: vi.fn(async (_s: string, mid: string) => {
        if (mid === "mid.malo") throw new Error("db caida");
        return true;
      }),
    });

    await procesarEventos([mensaje({ mid: "mid.malo" }), mensaje({ mid: "mid.bueno" })], deps);

    // El fallido recibe el aviso tecnico y el siguiente se contesta normal.
    expect(enviado(deps)).toEqual([MENSAJE_ERROR_TECNICO, "¡Hola! ¿Qué andás buscando?"]);
  });

  it("si el motor lanza, se avisa el error tecnico una sola vez", async () => {
    const deps = crearDeps();
    vi.mocked(conversar).mockImplementation(() => { throw new Error("bug"); });

    await procesarEventos([mensaje()], deps);

    expect(enviado(deps)).toEqual([MENSAJE_ERROR_TECNICO]);
  });

  it("nunca lanza, ni aunque enviarTexto falle siempre", async () => {
    const deps = crearDeps({ enviarTexto: vi.fn(async () => { throw new Error("Instagram caido"); }) });

    await expect(procesarEventos([mensaje(), mensaje({ mid: "mid.2" }), eco], deps)).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });
});

describe("procesarEventos: ecos", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("eco propio (esMidPropio true): espera 3 s y no pausa", async () => {
    const deps = crearDeps({ esMidPropio: vi.fn(async () => true) });

    await procesarEventos([eco], deps);

    expect(deps.esperar).toHaveBeenCalledWith(3000);
    expect(deps.esMidPropio).toHaveBeenCalledWith("mid.eco");
    expect(deps.pausar).not.toHaveBeenCalled();
  });

  it("eco ajeno (lo escribio una persona): espera 3 s y pausa al destinatario 6 horas", async () => {
    const deps = crearDeps({ esMidPropio: vi.fn(async () => false) });

    await procesarEventos([eco], deps);

    expect(deps.esperar).toHaveBeenCalledWith(3000);
    expect(deps.pausar).toHaveBeenCalledWith("111", new Date(AHORA.getTime() + 6 * 60 * 60 * 1000));
  });

  it("eco de la respuesta automatica de Instagram: no pausa aunque el mid no sea propio", async () => {
    const deps = crearDeps({ esMidPropio: vi.fn(async () => false) });
    const automatico: EventoEntrante = {
      tipo: "eco",
      destinatarioId: "111",
      mid: "mid.auto",
      texto: "¡Hola! Posse Automotores recibio tu mensaje. En este momentos los horarios de atención no se encuentran disponibles.",
    };

    await procesarEventos([automatico], deps);

    expect(deps.pausar).not.toHaveBeenCalled();
    expect(deps.esMidPropio).not.toHaveBeenCalled();
  });

  it("el texto automatico se reconoce sin importar tildes ni mayusculas", async () => {
    const deps = crearDeps({ esMidPropio: vi.fn(async () => false) });

    await procesarEventos([{ ...eco, texto: "RECIBIÓ TU MENSAJE, gracias" } as EventoEntrante], deps);

    expect(deps.pausar).not.toHaveBeenCalled();
  });

  it("un eco sin texto o con otro texto sigue siendo una persona", async () => {
    const deps = crearDeps({ esMidPropio: vi.fn(async () => false) });

    await procesarEventos([{ ...eco, texto: null } as EventoEntrante, { ...eco, texto: "Pasate por el local" } as EventoEntrante], deps);

    expect(deps.pausar).toHaveBeenCalledTimes(2);
  });

  it("espera antes de consultar el mid (el eco puede llegar antes de que se registre)", async () => {
    const orden: string[] = [];
    const deps = crearDeps({
      esperar: vi.fn(async () => { orden.push("esperar"); }),
      esMidPropio: vi.fn(async () => { orden.push("esMidPropio"); return true; }),
    });

    await procesarEventos([eco], deps);

    expect(orden).toEqual(["esperar", "esMidPropio"]);
  });

  it("si la base falla al decidir, no pausa y no lanza", async () => {
    const deps = crearDeps({ esMidPropio: vi.fn(async () => { throw new Error("db caida"); }) });

    await expect(procesarEventos([eco], deps)).resolves.toBeUndefined();

    expect(deps.pausar).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
  });

  it("el primer chequeo dice 'no es nuestro' y el segundo 'si': no pausa (el mid se registro tarde)", async () => {
    const esMidPropio = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const deps = crearDeps({ esMidPropio });

    await procesarEventos([eco], deps);

    expect(esMidPropio).toHaveBeenCalledTimes(2);
    expect(vi.mocked(deps.esperar).mock.calls.map((c) => c[0])).toEqual([3000, 4000]);
    expect(deps.pausar).not.toHaveBeenCalled();
  });

  it("dos chequeos que dicen 'no es nuestro': pausa y deja una linea sin texto del cliente", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const deps = crearDeps({ esMidPropio: vi.fn(async () => false) });

    await procesarEventos([eco], deps);

    expect(deps.esMidPropio).toHaveBeenCalledTimes(2);
    expect(deps.pausar).toHaveBeenCalledWith("111", new Date(AHORA.getTime() + 6 * 60 * 60 * 1000));
    expect(info).toHaveBeenCalledWith("[bot] Pausa por mensaje humano", { chat: "111…", mid: "mid.eco" });
  });

  it("si el segundo chequeo lanza, no pausa y no lanza", async () => {
    const esMidPropio = vi.fn().mockResolvedValueOnce(false).mockRejectedValueOnce(new Error("db caida"));
    const deps = crearDeps({ esMidPropio });

    await expect(procesarEventos([eco], deps)).resolves.toBeUndefined();

    expect(deps.pausar).not.toHaveBeenCalled();
  });

  it("si pausar falla, no lanza", async () => {
    const deps = crearDeps({
      esMidPropio: vi.fn(async () => false),
      pausar: vi.fn(async () => { throw new Error("db caida"); }),
    });

    await expect(procesarEventos([eco], deps)).resolves.toBeUndefined();
  });

  it("un eco nunca le manda nada al cliente", async () => {
    const deps = crearDeps({ esMidPropio: vi.fn(async () => { throw new Error("db"); }) });

    await procesarEventos([eco], deps);

    expect(deps.enviarTexto).not.toHaveBeenCalled();
  });
});

describe("procesarEventos: ids propios, tiempos y datos del lead", () => {
  beforeEach(() => {
    vi.mocked(conversar).mockReset();
    vi.mocked(conversar).mockReturnValue(resultado());
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const tres = resultado({
    mensajes: [
      { tipo: "texto", texto: "Hola Juan" },
      { tipo: "texto", texto: "Tenemos varios" },
      { tipo: "tarjetas", tarjetas: [TARJETA], alternativaTexto: "alt" },
    ],
  });

  it("registra los ids de cada envio ANTES del siguiente (si no, su eco se tomaria por una persona)", async () => {
    const log: string[] = [];
    let n = 0;
    const deps = crearDeps({
      enviarTexto: vi.fn(async (_s: string, t: string) => { log.push(`texto:${t}`); return [`mid.${++n}`]; }),
      enviarTarjetas: vi.fn(async () => { log.push("tarjetas"); return [`mid.${++n}`]; }),
      guardarSalida: vi.fn(async (_s: string, partes: Array<{ texto: string; mid: string | null }>) => { log.push(`guardar:${partes.map((p) => p.mid).join(",")}`); }),
      escribiendo: vi.fn(async () => { log.push("escribiendo"); }),
    });
    vi.mocked(conversar).mockReturnValue(tres);

    await procesarEventos([mensaje()], deps);

    expect(log.filter((l) => l !== "escribiendo")).toEqual([
      "texto:Hola Juan", "guardar:mid.1", "texto:Tenemos varios", "guardar:mid.2", "tarjetas", "guardar:mid.3",
    ]);
    // Entre el guardado de uno y el envio del siguiente va el "escribiendo".
    expect(log.slice(log.indexOf("guardar:mid.1") + 1, log.indexOf("texto:Tenemos varios"))).toEqual(["escribiendo"]);
  });

  it("el mensaje de error tecnico se registra apenas sale", async () => {
    const log: string[] = [];
    const deps = crearDeps({
      catalogo: vi.fn(async () => null),
      enviarTexto: vi.fn(async () => { log.push("texto"); return ["mid.t"]; }),
      guardarSalida: vi.fn(async () => { log.push("guardar"); }),
    });

    await procesarEventos([mensaje()], deps);

    expect(log).toEqual(["texto", "guardar"]);
  });

  it("texto largo enviado a medias: registra los ids ya entregados y luego manda el mensaje tecnico", async () => {
    const orden: string[] = [];
    let primera = true;
    const deps = crearDeps({
      enviarTexto: vi.fn(async (_s: string, t: string) => {
        if (primera) {
          primera = false;
          throw new ErrorEnvioParcial("Graph API 400: x", ["mid.parte1"]);
        }
        orden.push(`texto:${t === MENSAJE_ERROR_TECNICO ? "tecnico" : t}`);
        return ["mid.tec"];
      }),
      guardarSalida: vi.fn(async (_s: string, partes: Array<{ texto: string; mid: string | null }>) => { orden.push(`guardar:${partes.map((p) => p.mid).join(",")}`); }),
    });

    await procesarEventos([mensaje()], deps);

    expect(orden).toEqual(["guardar:mid.parte1", "texto:tecnico", "guardar:mid.tec"]);
  });

  it("si el propio mensaje tecnico sale a medias, tambien registra los ids parciales", async () => {
    const deps = crearDeps({
      catalogo: vi.fn(async () => null),
      enviarTexto: vi.fn(async () => { throw Object.assign(new Error("parcial"), { ids: ["mid.p1"] }); }),
    });

    await procesarEventos([mensaje()], deps);

    expect(deps.guardarSalida).toHaveBeenCalledWith("111", [{ texto: MENSAJE_ERROR_TECNICO, mid: "mid.p1" }]);
  });

  it("un 'escribiendo' que nunca responde no demora el envio mas alla de la demora", async () => {
    const deps = crearDeps({ escribiendo: vi.fn(() => new Promise<void>(() => {})) });

    await procesarEventos([mensaje()], deps);

    expect(deps.enviarTexto).toHaveBeenCalledTimes(1);
  });

  it("'escribiendo' y la demora corren en paralelo", async () => {
    const orden: string[] = [];
    const deps = crearDeps({
      escribiendo: vi.fn(async () => { orden.push("escribiendo:inicio"); await Promise.resolve(); orden.push("escribiendo:fin"); }),
      esperar: vi.fn(async () => { orden.push("esperar:inicio"); await Promise.resolve(); orden.push("esperar:fin"); }),
    });

    await procesarEventos([mensaje()], deps);

    // La demora arranca antes de que termine el "escribiendo".
    expect(orden.indexOf("esperar:inicio")).toBeLessThan(orden.indexOf("escribiendo:fin"));
  });

  it("'visto' no frena la lectura del catalogo ni al motor, pero la respuesta espera hasta 1500 ms por el", async () => {
    vi.useFakeTimers();
    const deps = crearDeps({ marcarVisto: vi.fn(() => new Promise<void>(() => {})) });

    const turno = procesarEventos([mensaje()], deps);
    await vi.advanceTimersByTimeAsync(0);
    expect(conversar).toHaveBeenCalled();
    expect(deps.enviarTexto).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1500);
    await turno;
    expect(deps.enviarTexto).toHaveBeenCalledTimes(1);
  });

  it("pasados 12 s del turno se omiten 'escribiendo' y demoras, pero los mensajes se mandan igual", async () => {
    let ms = 0;
    const deps = crearDeps({
      ahora: () => new Date(AHORA.getTime() + ms),
      enviarTexto: vi.fn(async () => { ms += 13_000; return ["mid.x"]; }),
    });
    vi.mocked(conversar).mockReturnValue(tres);

    await procesarEventos([mensaje()], deps);

    expect(deps.enviarTexto).toHaveBeenCalledTimes(2);
    expect(deps.enviarTarjetas).toHaveBeenCalledTimes(1);
    expect(deps.escribiendo).toHaveBeenCalledTimes(1); // solo antes del primero
    expect(deps.esperar).toHaveBeenCalledTimes(1);
  });

  it("lead: agrega el @usuario del perfil al mensaje para encontrar a la persona en Instagram", async () => {
    const lead = { nombre: "Juan", telefono: "3537 123456", mensaje: "Quiere verlo el sábado" };
    const deps = crearDeps({
      cargarChat: vi.fn(async () => ({ sesion: SESION, pausaHasta: null, perfil: { nombre: "Juan", usuario: "juan_p" } })),
    });
    vi.mocked(conversar).mockReturnValue(resultado({ lead }));

    await procesarEventos([mensaje()], deps);

    expect(deps.guardarLead).toHaveBeenCalledWith("111", { ...lead, mensaje: "Quiere verlo el sábado (@juan_p)" });
  });

  it("lead sin mensaje: queda solo el @usuario; con perfil recien obtenido tambien", async () => {
    const deps = crearDeps({
      cargarChat: vi.fn(async () => ({ sesion: SESION, pausaHasta: null, perfil: null })),
      obtenerPerfil: vi.fn(async () => ({ usuario: "maria_p" })),
    });
    vi.mocked(conversar).mockReturnValue(resultado({ lead: { nombre: "Maria", telefono: "3537 000000" } }));

    await procesarEventos([mensaje()], deps);

    expect(deps.guardarLead).toHaveBeenCalledWith("111", { nombre: "Maria", telefono: "3537 000000", mensaje: "@maria_p" });
  });

  it("lead fallido: ademas del texto manda la tarjeta con el boton de Nati", async () => {
    const deps = crearDeps({ guardarLead: vi.fn(async () => { throw new Error("db caida"); }) });
    vi.mocked(conversar).mockReturnValue(resultado({ lead: { nombre: "Juan", telefono: "3537 123456" } }));

    await procesarEventos([mensaje()], deps);

    expect(enviado(deps)).toEqual([MENSAJE_LEAD_FALLIDO]);
    expect(deps.enviarTarjetas).toHaveBeenCalledWith("111", [tarjetaContacto(null, { negocio: NEGOCIO, siteUrl: "https://sitio.example" })]);
  });

  it("lead fallido con la tarjeta rechazada: cae al texto con el link de WhatsApp", async () => {
    const deps = crearDeps({
      guardarLead: vi.fn(async () => { throw new Error("db caida"); }),
      enviarTarjetas: vi.fn(async () => { throw new Error("rechazada"); }),
    });
    vi.mocked(conversar).mockReturnValue(resultado({ lead: { nombre: "Juan", telefono: "3537 123456" } }));

    await procesarEventos([mensaje()], deps);

    const textos = enviado(deps);
    expect(textos).toHaveLength(2);
    expect(textos[0]).toBe(MENSAJE_LEAD_FALLIDO);
    expect(textos[1]).toContain("https://wa.me/");
    expect(violacionesDeTono(textos[1])).toEqual([]);
  });
});

describe("textos fijos al cliente", () => {
  it.each([
    ["MENSAJE_ERROR_TECNICO", MENSAJE_ERROR_TECNICO],
    ["MENSAJE_LEAD_FALLIDO", MENSAJE_LEAD_FALLIDO],
  ])("%s lleva el WhatsApp visible, cumple el tono y no se dice persona", (_nombre, texto) => {
    expect(texto).toContain(NEGOCIO.whatsappVisible);
    expect(violacionesDeTono(texto)).toEqual([]);
    expect(texto).not.toMatch(/soy (una persona|humano|nati)/i);
  });
});

describe("procesarEventos: adjuntos", () => {
  afterEach(() => vi.restoreAllMocks());

  it("pasa al motor los textos del adjunto y solo loguea los tipos, nunca el contenido", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    vi.mocked(conversar).mockReturnValue(resultado());
    const deps = crearDeps();

    await procesarEventos([mensaje({ texto: null, adjuntos: ["contact"], adjuntosTexto: ["Juan 3537 123456"] })], deps);

    expect(conversar).toHaveBeenCalledWith(
      expect.objectContaining({ adjuntos: ["contact"], adjuntosTexto: ["Juan 3537 123456"] }),
    );
    expect(info).toHaveBeenCalledWith("[bot] Adjuntos recibidos", { tipos: ["contact"], conTexto: false });
    expect(JSON.stringify(info.mock.calls)).not.toContain("3537");
  });
});
