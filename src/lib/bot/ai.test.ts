import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CONFIRMACION_LEAD,
  extraerRespuesta,
  LEAD_INCOMPLETO,
  RESPUESTA_VACIA,
  responderIA,
} from "./ai";

const leadValido = {
  nombre: "Juan Pérez",
  telefono: "3537 123456",
  vehiculo_interes: "Corolla 2011",
  mensaje: "Quiere verlo el sábado",
};

function llamadaLead(argumentos: unknown) {
  return {
    id: "call_1",
    type: "function",
    function: {
      name: "guardar_lead",
      arguments: typeof argumentos === "string" ? argumentos : JSON.stringify(argumentos),
    },
  };
}

describe("extraerRespuesta", () => {
  it("devuelve el texto recortado cuando no hay llamadas a herramientas", () => {
    const respuesta = extraerRespuesta({ content: "  ¡Hola! ¿Qué tipo de auto buscás?  " });

    expect(respuesta).toEqual({ texto: "¡Hola! ¿Qué tipo de auto buscás?", lead: null });
  });

  it("devuelve el lead y el texto cuando el modelo llama a guardar_lead", () => {
    const respuesta = extraerRespuesta({
      content: "¡Genial, Juan! Un vendedor te contacta.",
      tool_calls: [llamadaLead(leadValido)],
    });

    expect(respuesta.texto).toBe("¡Genial, Juan! Un vendedor te contacta.");
    expect(respuesta.lead).toEqual(leadValido);
  });

  it("usa una confirmacion fija si llamo a la herramienta sin escribir texto", () => {
    const respuesta = extraerRespuesta({ content: null, tool_calls: [llamadaLead(leadValido)] });

    expect(respuesta.texto).toBe(CONFIRMACION_LEAD);
    expect(respuesta.lead).not.toBeNull();
  });

  it("pide los datos de nuevo si los argumentos no son JSON valido (no confirma algo que no se guardo)", () => {
    const respuesta = extraerRespuesta({
      content: "¡Listo, ya te anoto!",
      tool_calls: [llamadaLead("{nombre: Juan, telefono")],
    });

    expect(respuesta).toEqual({ texto: LEAD_INCOMPLETO, lead: null });
  });

  it("pide los datos de nuevo si falta el nombre o el telefono", () => {
    const sinTelefono = extraerRespuesta({
      content: "Dale.",
      tool_calls: [llamadaLead({ nombre: "Juan" })],
    });
    const sinNombre = extraerRespuesta({
      content: "Dale.",
      tool_calls: [llamadaLead({ nombre: "  ", telefono: "123" })],
    });

    expect(sinTelefono).toEqual({ texto: LEAD_INCOMPLETO, lead: null });
    expect(sinNombre).toEqual({ texto: LEAD_INCOMPLETO, lead: null });
  });

  it("recorta los espacios de los datos del lead", () => {
    const respuesta = extraerRespuesta({
      content: "Listo",
      tool_calls: [llamadaLead({ nombre: " Ana ", telefono: " 351 555 " })],
    });

    expect(respuesta.lead).toEqual({ nombre: "Ana", telefono: "351 555" });
  });

  it("ignora herramientas desconocidas", () => {
    const respuesta = extraerRespuesta({
      content: "Hola",
      tool_calls: [{ function: { name: "otra_cosa", arguments: JSON.stringify(leadValido) } }],
    });

    expect(respuesta).toEqual({ texto: "Hola", lead: null });
  });

  it("devuelve una disculpa si no hay texto ni lead", () => {
    expect(extraerRespuesta({})).toEqual({ texto: RESPUESTA_VACIA, lead: null });
    expect(extraerRespuesta({ content: null, tool_calls: [] })).toEqual({
      texto: RESPUESTA_VACIA,
      lead: null,
    });
  });
});

describe("responderIA", () => {
  const fetchMock = vi.fn();
  const entrada = {
    stockTexto: "- Toyota Corolla XEI | 2011",
    historial: [{ role: "user" as const, content: "Hola" }],
  };

  function respuestaOk(message: unknown) {
    return new Response(JSON.stringify({ choices: [{ message }] }), { status: 200 });
  }

  beforeEach(() => {
    vi.stubEnv("LLM_API_KEY", "clave-de-prueba");
    vi.stubEnv("LLM_MODEL", "modelo-de-prueba");
    vi.stubEnv("LLM_BASE_URL", "");
    vi.stubEnv("LLM_REASONING_EFFORT", "");
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => respuestaOk({ content: "¡Hola!" }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("llama a /chat/completions de Groq por defecto, con la clave en el header", async () => {
    await responderIA(entrada);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer clave-de-prueba");
  });

  it("usa LLM_BASE_URL si esta definida y le saca la barra final", async () => {
    vi.stubEnv("LLM_BASE_URL", "https://otra.api/v1/");

    await responderIA(entrada);

    expect(fetchMock.mock.calls[0][0]).toBe("https://otra.api/v1/chat/completions");
  });

  it("manda el modelo, el system prompt con el stock, el historial y la herramienta", async () => {
    await responderIA(entrada);

    const cuerpo = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(cuerpo.model).toBe("modelo-de-prueba");
    expect(cuerpo.max_tokens).toBe(1000);
    expect(cuerpo.messages[0].role).toBe("system");
    expect(cuerpo.messages[0].content).toContain("- Toyota Corolla XEI | 2011");
    expect(cuerpo.messages.slice(1)).toEqual(entrada.historial);
    expect(cuerpo.tools).toHaveLength(1);
    expect(cuerpo.tools[0].type).toBe("function");
    expect(cuerpo.tools[0].function.name).toBe("guardar_lead");
  });

  it("devuelve el texto de la respuesta", async () => {
    expect(await responderIA(entrada)).toEqual({ texto: "¡Hola!", lead: null });
  });

  it("devuelve el lead cuando la respuesta trae una llamada a guardar_lead", async () => {
    fetchMock.mockImplementation(async () =>
      respuestaOk({ content: "¡Listo!", tool_calls: [llamadaLead(leadValido)] }),
    );

    const respuesta = await responderIA(entrada);

    expect(respuesta.texto).toBe("¡Listo!");
    expect(respuesta.lead).toEqual(leadValido);
  });

  it("lanza con el status si el proveedor responde con error (ej. cuota agotada)", async () => {
    fetchMock.mockImplementation(
      async () => new Response('{"error":{"message":"rate limit"}}', { status: 429 }),
    );

    await expect(responderIA(entrada)).rejects.toThrow(/LLM 429/);
  });

  it("no filtra la API key en el mensaje de error", async () => {
    fetchMock.mockImplementation(async () => new Response("fallo", { status: 500 }));

    await expect(responderIA(entrada)).rejects.not.toThrow(/clave-de-prueba/);
  });

  it("lanza si la respuesta no trae choices", async () => {
    fetchMock.mockImplementation(async () => new Response("{}", { status: 200 }));

    await expect(responderIA(entrada)).rejects.toThrow(/choices/);
  });

  it("lanza claro y no llama a la red si falta LLM_API_KEY", async () => {
    vi.stubEnv("LLM_API_KEY", "");

    await expect(responderIA(entrada)).rejects.toThrow(/LLM_API_KEY/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lanza claro y no llama a la red si falta LLM_MODEL", async () => {
    vi.stubEnv("LLM_MODEL", "");

    await expect(responderIA(entrada)).rejects.toThrow(/LLM_MODEL/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("no manda parametros de razonamiento si LLM_REASONING_EFFORT no esta definida", async () => {
    await responderIA(entrada);

    const cuerpo = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(cuerpo).not.toHaveProperty("reasoning_effort");
    expect(cuerpo).not.toHaveProperty("include_reasoning");
  });

  it("manda reasoning_effort e include_reasoning:false cuando se configura", async () => {
    vi.stubEnv("LLM_REASONING_EFFORT", "low");

    await responderIA(entrada);

    const cuerpo = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(cuerpo.reasoning_effort).toBe("low");
    expect(cuerpo.include_reasoning).toBe(false);
  });

  it("lanza si LLM_REASONING_EFFORT tiene un valor invalido y no llama a la red", async () => {
    vi.stubEnv("LLM_REASONING_EFFORT", "ultra");

    await expect(responderIA(entrada)).rejects.toThrow(/LLM_REASONING_EFFORT/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
