import { describe, expect, it } from "vitest";
import { CONFIRMACION_LEAD, extraerRespuesta, RESPUESTA_VACIA } from "./ai";

const leadValido = {
  nombre: "Juan Pérez",
  telefono: "3537 123456",
  vehiculo_interes: "Corolla 2011",
  mensaje: "Quiere verlo el sábado",
};

describe("extraerRespuesta", () => {
  it("devuelve el texto cuando solo hay bloques de texto", () => {
    const respuesta = extraerRespuesta([
      { type: "text", text: "¡Hola! " },
      { type: "text", text: "¿Qué tipo de auto buscás?" },
    ]);

    expect(respuesta).toEqual({ texto: "¡Hola!\n¿Qué tipo de auto buscás?", lead: null });
  });

  it("devuelve el lead y el texto cuando el modelo llama a guardar_lead", () => {
    const respuesta = extraerRespuesta([
      { type: "text", text: "¡Genial, Juan! Un vendedor te contacta." },
      { type: "tool_use", name: "guardar_lead", input: leadValido },
    ]);

    expect(respuesta.texto).toBe("¡Genial, Juan! Un vendedor te contacta.");
    expect(respuesta.lead).toEqual(leadValido);
  });

  it("usa una confirmacion fija si el modelo llamo a la herramienta sin escribir texto", () => {
    const respuesta = extraerRespuesta([
      { type: "tool_use", name: "guardar_lead", input: leadValido },
    ]);

    expect(respuesta.texto).toBe(CONFIRMACION_LEAD);
    expect(respuesta.lead).not.toBeNull();
  });

  it("ignora un lead sin nombre o sin telefono", () => {
    const sinTelefono = extraerRespuesta([
      { type: "text", text: "Dale." },
      { type: "tool_use", name: "guardar_lead", input: { nombre: "Juan" } },
    ]);
    const sinNombre = extraerRespuesta([
      { type: "text", text: "Dale." },
      { type: "tool_use", name: "guardar_lead", input: { nombre: "  ", telefono: "123" } },
    ]);

    expect(sinTelefono.lead).toBeNull();
    expect(sinNombre.lead).toBeNull();
  });

  it("ignora herramientas desconocidas y entradas que no son objetos", () => {
    const respuesta = extraerRespuesta([
      { type: "text", text: "Hola" },
      { type: "tool_use", name: "otra_cosa", input: leadValido },
      { type: "tool_use", name: "guardar_lead", input: "no soy un objeto" },
    ]);

    expect(respuesta.lead).toBeNull();
  });

  it("recorta los espacios de los datos del lead", () => {
    const respuesta = extraerRespuesta([
      { type: "tool_use", name: "guardar_lead", input: { nombre: " Ana ", telefono: " 351 555 " } },
    ]);

    expect(respuesta.lead).toEqual({ nombre: "Ana", telefono: "351 555" });
  });

  it("devuelve una respuesta de disculpa si no hay texto ni lead", () => {
    expect(extraerRespuesta([])).toEqual({ texto: RESPUESTA_VACIA, lead: null });
  });
});
