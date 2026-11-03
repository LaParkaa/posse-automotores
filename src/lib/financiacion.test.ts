import { describe, expect, it } from "vitest";
import { armarMensaje, esNavegadorInterno, urlFinanciacion, usadoDeUrl, validar, type SolicitudFinanciacion } from "./financiacion";
import { WHATSAPP_LOCAL } from "./utils";

const BASE: SolicitudFinanciacion = {
  auto: "Volkswagen Gol Power 1.6 (2010)",
  conPermuta: false,
  permuta: { modelo: "", anio: "", km: "", estado: null, conFotos: false },
  plazo: 24,
  nombre: "Juan Pérez",
};

const CON_PERMUTA: SolicitudFinanciacion = {
  ...BASE,
  conPermuta: true,
  permuta: { modelo: "Peugeot 208", anio: "2018", km: "85000", estado: "Excelente", conFotos: false },
};

describe("esNavegadorInterno", () => {
  it("reconoce los navegadores internos de Instagram y Facebook", () => {
    expect(esNavegadorInterno("Mozilla/5.0 (iPhone) AppleWebKit Mobile/15E148 Instagram 300.0.0")).toBe(true);
    expect(esNavegadorInterno("Mozilla/5.0 (Linux; Android 13) [FB_IAB/FB4A;FBAV/450.0]")).toBe(true);
  });

  it("no confunde un navegador común", () => {
    expect(esNavegadorInterno("Mozilla/5.0 (Windows NT 10.0) Chrome/120.0 Safari/537.36")).toBe(false);
  });
});

describe("validar", () => {
  it("una solicitud completa no tiene errores", () => {
    expect(validar(BASE)).toEqual({});
    expect(validar(CON_PERMUTA)).toEqual({});
  });

  it("pide auto y nombre", () => {
    const errores = validar({ ...BASE, auto: " ", nombre: "J" });
    expect(Object.keys(errores).sort()).toEqual(["auto", "nombre"]);
  });

  it("los datos del usado solo se exigen si hay permuta", () => {
    expect(validar({ ...BASE, permuta: { ...BASE.permuta, anio: "abc" } })).toEqual({});
    expect(Object.keys(validar({ ...CON_PERMUTA, permuta: { ...BASE.permuta } }))).toEqual(["modelo"]);
  });

  it("el año del usado es opcional pero, si está, tiene 4 cifras razonables", () => {
    const con = (anio: string) => validar({ ...CON_PERMUTA, permuta: { ...CON_PERMUTA.permuta, anio } }, 2026).anio;
    expect(con("")).toBeUndefined();
    expect(con("2018")).toBeUndefined();
    expect(con("2027")).toBeUndefined();
    expect(con("18")).toBeDefined();
    expect(con("1950")).toBeDefined();
    expect(con("2030")).toBeDefined();
  });
});

describe("armarMensaje", () => {
  it("sin permuta", () => {
    expect(armarMensaje(BASE)).toBe(
      [
        "¡Hola Marcos! Quiero solicitar una simulación de financiación:",
        "",
        "🚗 Auto a comprar: Volkswagen Gol Power 1.6 (2010)",
        "🔄 Entrega usado: No",
        "🗓️ Plazo deseado: 24 cuotas",
        "👤 Nombre: Juan Pérez",
        "",
        "Quedo a la espera de tu respuesta.",
      ].join("\n"),
    );
  });

  it("no pide ni menciona un monto", () => {
    expect(armarMensaje(BASE)).not.toMatch(/monto|\$/i);
  });

  it("sin emojis (navegador interno) queda el mismo texto sin los dibujitos", () => {
    const mensaje = armarMensaje({ ...CON_PERMUTA, permuta: { ...CON_PERMUTA.permuta, conFotos: true } }, false);
    expect(mensaje).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(mensaje).toContain("Auto a comprar: Volkswagen Gol Power 1.6 (2010)");
    expect(mensaje).toContain("Entrega usado: Sí (Peugeot 208 - Año 2018 - 85.000 km - Estado: Excelente)");
    expect(mensaje).toContain("Plazo deseado: 24 cuotas");
    expect(mensaje).toContain("Nota: Te adjunto las fotos");
  });

  it("con permuta lleva los datos del usado", () => {
    const mensaje = armarMensaje(CON_PERMUTA);
    expect(mensaje).toContain("🔄 Entrega usado: Sí (Peugeot 208 - Año 2018 - 85.000 km - Estado: Excelente)");
    expect(mensaje).not.toContain("📸");
  });

  it("si avisa que tiene fotos, el mensaje dice que las manda por el chat (antes del cierre)", () => {
    const mensaje = armarMensaje({ ...CON_PERMUTA, permuta: { ...CON_PERMUTA.permuta, conFotos: true } });
    expect(mensaje).toContain("📸 Nota: Te adjunto las fotos de mi vehículo a continuación en este chat.");
    expect(mensaje.endsWith("Quedo a la espera de tu respuesta.")).toBe(true);
  });

  it("la nota de las fotos solo va si hay permuta", () => {
    const mensaje = armarMensaje({ ...BASE, permuta: { ...BASE.permuta, conFotos: true } });
    expect(mensaje).not.toContain("📸");
  });

  it("omite lo que no se completó del usado", () => {
    const mensaje = armarMensaje({ ...CON_PERMUTA, permuta: { ...BASE.permuta, modelo: "Fiat Palio" } });
    expect(mensaje).toContain("🔄 Entrega usado: Sí (Fiat Palio)");
  });

  it("respeta un kilometraje escrito con palabras", () => {
    const mensaje = armarMensaje({ ...CON_PERMUTA, permuta: { ...CON_PERMUTA.permuta, km: "85 mil km" } });
    expect(mensaje).toContain("85 mil km");
  });

  it("limpia saltos de línea y espacios, y corta los textos largos", () => {
    const mensaje = armarMensaje({ ...BASE, nombre: "  Juan\n\nPérez  ", auto: "A".repeat(200) });
    expect(mensaje).toContain("👤 Nombre: Juan Pérez");
    expect(mensaje).toContain(`🚗 Auto a comprar: ${"A".repeat(60)}\n`);
  });
});

describe("urlFinanciacion", () => {
  it("abre el chat de Marcos con el mensaje codificado", () => {
    const url = urlFinanciacion(CON_PERMUTA);
    expect(url.startsWith(`https://wa.me/${WHATSAPP_LOCAL}?text=`)).toBe(true);
    expect(decodeURIComponent(url.split("?text=")[1])).toBe(armarMensaje(CON_PERMUTA));
  });
});

describe("usadoDeUrl", () => {
  it("toma el modelo y el año que trae el link", () => {
    expect(usadoDeUrl({ usado: "Chevrolet Corsa", usadoAnio: "2010" })).toEqual({ modelo: "Chevrolet Corsa", anio: "2010" });
  });

  it("sin año deja el año vacio, y con un año inventado lo descarta", () => {
    expect(usadoDeUrl({ usado: "Hilux" })).toEqual({ modelo: "Hilux", anio: "" });
    expect(usadoDeUrl({ usado: "Hilux", usadoAnio: "1850" })).toEqual({ modelo: "Hilux", anio: "" });
    expect(usadoDeUrl({ usado: "Hilux", usadoAnio: "dos mil" })).toEqual({ modelo: "Hilux", anio: "" });
  });

  it("?permuta=1 abre el simulador con el usado en Si pero sin datos", () => {
    expect(usadoDeUrl({ permuta: "1" })).toEqual({ modelo: "", anio: "" });
  });

  it("si el link no habla de un usado devuelve null", () => {
    expect(usadoDeUrl({})).toBeNull();
    expect(usadoDeUrl({ usado: "   ", permuta: "0" })).toBeNull();
  });

  it("limpia lo que viene de la direccion: espacios, saltos de linea y largo", () => {
    expect(usadoDeUrl({ usado: "  Gol\n\nPower  " })?.modelo).toBe("Gol Power");
    expect(usadoDeUrl({ usado: "x".repeat(200) })?.modelo.length).toBe(60);
  });
});
