const CORPORATIVO = /estimad|le informamos|a la brevedad|su consulta|quedamos a su disposici|lo saludamos/i;

/** Reglas de tono que TODO texto que mande el bot debe cumplir. Devuelve las que se violan. */
export function violacionesDeTono(texto: string): string[] {
  const v: string[] = [];
  if (new TextEncoder().encode(texto).length > 1000) v.push("supera 1000 bytes");
  if (texto.split("\n").filter((l) => l.trim() !== "").length > 5) v.push("mas de 5 lineas");
  if (/\*|`|^#/m.test(texto)) v.push("usa markdown");
  if (CORPORATIVO.test(texto)) v.push("usa formulas corporativas");
  return v;
}
