import { describe, expect, it } from "vitest";
import { armarAviso, avisoComoTexto, precioNumerico, type DatosNegocio, type VehiculoPublicable } from "./aviso";

function auto(over: Partial<VehiculoPublicable> = {}): VehiculoPublicable {
  return {
    nombre: "Volkswagen Vento 2.5 Advance 2015",
    marca: "Volkswagen",
    modelo: "Vento 2.5 Advance",
    anio: 2015,
    kilometraje: "130.000 km",
    combustible: "Nafta",
    transmision: "Automático",
    motor: "2.5",
    tipo: "Sedán",
    descripcion: null,
    precio_texto: "USD 14.500",
    ...over,
  };
}

const negocio: DatosNegocio = {
  nombre: "Posse Automotores",
  ciudad: "Justiniano Posse, Córdoba",
  whatsappVisible: "+54 9 3537 66-2444",
  financiacion: "Trabajamos con financiación bancaria y propia. Las condiciones dependen del auto, te las pasa Marcos.",
  permutas: "Tomamos tu usado como parte de pago: lo tasamos en el local.",
  garantia: "Todos los vehículos tienen garantía legal y verificación previa.",
};

describe("precioNumerico", () => {
  it("lee dólares y pesos sacando los puntos de miles", () => {
    expect(precioNumerico("USD 14.500")).toEqual({ moneda: "USD", monto: 14500 });
    expect(precioNumerico("U$S 8.000")).toEqual({ moneda: "USD", monto: 8000 });
    expect(precioNumerico("$9.500.000")).toEqual({ moneda: "ARS", monto: 9500000 });
    expect(precioNumerico("$ 9.500.000")).toEqual({ moneda: "ARS", monto: 9500000 });
  });

  it("si no hay un número devuelve null", () => {
    expect(precioNumerico("Consultá precio")).toBeNull();
    expect(precioNumerico("")).toBeNull();
  });
});

describe("armarAviso: título", () => {
  it("Mercado Libre lleva marca, modelo, año y km", () => {
    expect(armarAviso(auto(), "mercadolibre", negocio).titulo).toBe("Volkswagen Vento 2.5 Advance 2015 130.000 km");
  });

  it("Marketplace lleva un título corto", () => {
    expect(armarAviso(auto(), "marketplace", negocio).titulo).toBe("Volkswagen Vento 2.5 Advance 2015");
  });

  it("el título de Mercado Libre no pasa de 60 caracteres y no corta palabras", () => {
    const modelo = "Super Hiper Mega Extra Ultra Deluxe Edition Limitada Aniversario Especial 2.0";
    expect(modelo.length).toBeGreaterThanOrEqual(70);
    const { titulo } = armarAviso(auto({ modelo }), "mercadolibre", negocio);
    const original = new Set(`Volkswagen ${modelo} 2015 130.000 km`.split(" "));
    expect(titulo.length).toBeLessThanOrEqual(60);
    expect(titulo.endsWith(" ")).toBe(false);
    for (const palabra of titulo.split(" ")) expect(original.has(palabra)).toBe(true);
  });

  it("sin km legible no aparece 'Consultá'; con 0 km sí aparece", () => {
    const sinKm = armarAviso(auto({ kilometraje: "Consultá km" }), "mercadolibre", negocio);
    expect(sinKm.titulo).not.toContain("Consultá");
    expect(sinKm.descripcion).not.toContain("Consultá");
    expect(armarAviso(auto({ kilometraje: "0 km" }), "mercadolibre", negocio).titulo).toContain("0 km");
  });
});

describe("armarAviso: datos y faltantes", () => {
  it("el precio sale como número para pegarlo en el formulario", () => {
    const { datos } = armarAviso(auto(), "mercadolibre", negocio);
    expect(datos).toContainEqual({ etiqueta: "Precio (USD)", valor: "14500" });
  });

  it("con 'Consultá precio' no hay dato de precio y se avisa como faltante", () => {
    const aviso = armarAviso(auto({ precio_texto: "Consultá precio" }), "mercadolibre", negocio);
    expect(aviso.datos.some((d) => d.etiqueta.startsWith("Precio"))).toBe(false);
    expect(aviso.faltantes.some((f) => f.startsWith("Precio"))).toBe(true);
  });

  it("siempre pide completar versión, color y puertas", () => {
    for (const plataforma of ["mercadolibre", "marketplace"] as const) {
      const { faltantes } = armarAviso(auto(), plataforma, negocio);
      expect(faltantes).toEqual(expect.arrayContaining(["Versión", "Color", "Puertas"]));
    }
  });
});

describe("armarAviso: descripción", () => {
  it("la de Mercado Libre no lleva teléfono; la de Marketplace sí", () => {
    expect(armarAviso(auto(), "mercadolibre", negocio).descripcion).not.toContain("3537");
    expect(armarAviso(auto(), "marketplace", negocio).descripcion).toContain("+54 9 3537 66-2444");
  });

  it("no menciona lo que el negocio no tiene cargado", () => {
    const sin = armarAviso(auto(), "marketplace", { ...negocio, financiacion: null });
    expect(sin.descripcion).not.toContain("financiación");
    const con = armarAviso(auto(), "mercadolibre", negocio);
    expect(con.descripcion).toContain("financiación");
  });

  it("incluye la descripción propia del auto y nunca 'null' ni 'undefined'", () => {
    const propia = "Único dueño, service al día.";
    for (const plataforma of ["mercadolibre", "marketplace"] as const) {
      expect(armarAviso(auto({ descripcion: propia }), plataforma, negocio).descripcion).toContain(propia);
      const vacia = armarAviso(auto({ descripcion: null, motor: null, tipo: null }), plataforma, negocio);
      expect(vacia.descripcion).not.toMatch(/null|undefined/);
    }
  });
});

describe("avisoComoTexto", () => {
  it("junta el título y la descripción", () => {
    const aviso = armarAviso(auto(), "marketplace", negocio);
    const texto = avisoComoTexto(aviso);
    expect(texto).toContain(aviso.titulo);
    expect(texto).toContain(aviso.descripcion);
  });
});
