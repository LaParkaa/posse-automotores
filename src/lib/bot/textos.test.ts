import { describe, expect, it } from "vitest";
import { violacionesDeTono } from "./__fixtures__/tono";
import { CAMPOS_POSTULACION } from "./sesion";
import * as T from "./textos";

const emojis = (t: string) => Array.from(t.matchAll(/\p{Extended_Pictographic}/gu)).length;

const VARIANTES: Array<[string, readonly string[]]> = [
  ["postulacionIntro", [...T.postulacionIntro(null), ...T.postulacionIntro("Ana")]],
  ["postulacionRetoma", T.postulacionRetoma],
  ...CAMPOS_POSTULACION.map((campo): [string, readonly string[]] => [
    `preguntaPostulacion.${campo}`,
    T.preguntaPostulacion[campo],
  ]),
  ...Object.entries(T.repreguntaPostulacion).map(([campo, variantes]): [string, readonly string[]] => [
    `repreguntaPostulacion.${campo}`,
    variantes,
  ]),
  ["preguntaDuracion", T.preguntaDuracion],
  ["postulacionCondiciones", T.postulacionCondiciones("Marcos")],
  ["postulacionCancelada", T.postulacionCancelada],
  ["postulacionYaArmada", T.postulacionYaArmada("Marcos")],
  ["postulacionListo", T.postulacionListo("Ana", "Marcos")],
  ["postulacionSinNombre", T.postulacionSinNombre("Marcos")],
  ["postulacionAdjunto", T.postulacionAdjunto("Marcos")],
  ["telefonoComoContacto", T.telefonoComoContacto],
];

describe("textos de la postulacion de vendedor", () => {
  for (const [nombre, variantes] of VARIANTES) {
    it(`${nombre}: 2 o mas variantes, 1 a 3 emojis y el tono del bot`, () => {
      expect(variantes.length).toBeGreaterThanOrEqual(2);
      for (const texto of variantes) {
        expect(emojis(texto), texto).toBeGreaterThanOrEqual(1);
        expect(emojis(texto), texto).toBeLessThanOrEqual(3);
        expect(violacionesDeTono(texto), texto).toEqual([]);
        // El bot nunca dice ser una persona.
        expect(texto).not.toMatch(/soy (una )?persona|soy humano/i);
      }
    });
  }

  it("hay una pregunta para cada dato que se pide", () => {
    for (const campo of CAMPOS_POSTULACION) expect(T.preguntaPostulacion[campo].length).toBeGreaterThan(0);
  });

  it("el cierre dice que el mensaje ya esta armado y que hay que tocar el boton", () => {
    for (const texto of T.postulacionListo("Ana", "Marcos")) {
      expect(texto).toMatch(/Ana/);
      expect(texto).toMatch(/Marcos/);
      expect(texto).toMatch(/bot[oó]n/i);
    }
  });

  it("el respaldo en texto del boton de Marcos lleva su numero (un link largo no entra en un mensaje)", () => {
    const texto = T.contactoReclutadorEnTexto("Marcos", "+54 9 3537 66-2444");

    expect(texto).toContain("Marcos");
    expect(texto).toContain("+54 9 3537 66-2444");
    expect(violacionesDeTono(texto)).toEqual([]);
  });
});
