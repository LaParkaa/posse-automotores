import { sanearTexto } from "./asistente";
import { LIMITES } from "./limites";
import { esOpcionId, type EntradaChat } from "./tipos";

export type PedidoChat = EntradaChat & { visitante: string };

// Mismos formatos que valida /api/eventos (src/lib/eventos.ts): el id de visitante es el de la web (posse_vid).
const VISITANTE = /^[A-Za-z0-9-]{8,64}$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SLUG = 120;

export const esSlugValido = (v: unknown): v is string => typeof v === "string" && v.length <= MAX_SLUG && SLUG.test(v);

const ausente = (v: unknown) => v === undefined || v === null;

/**
 * Valida el cuerpo de POST /api/chat. Devuelve el pedido limpio o `null` si algo no cierra: nunca lanza ni arregla
 * lo que viene mal formado. Exige exactamente una de las tres cosas: `texto`, `opcion` o `inicio: true`.
 * El texto sale recortado y sin caracteres de control ni surrogates sueltos (Postgres los rechaza).
 */
export function validarPedidoChat(crudo: unknown): PedidoChat | null {
  if (typeof crudo !== "object" || crudo === null || Array.isArray(crudo)) return null;
  const c = crudo as Record<string, unknown>;

  const { visitante } = c;
  if (typeof visitante !== "string" || !VISITANTE.test(visitante)) return null;

  let slug: string | null;
  let pagina: EntradaChat["pagina"];
  if (c.pagina === "ficha") {
    if (!esSlugValido(c.slug)) return null;
    pagina = "ficha";
    slug = c.slug;
  } else if (c.pagina === "catalogo") {
    if (!ausente(c.slug)) return null;
    pagina = "catalogo";
    slug = null;
  } else {
    return null;
  }

  const hayTexto = !ausente(c.texto);
  const hayOpcion = !ausente(c.opcion);
  const hayInicio = !ausente(c.inicio);
  if (Number(hayTexto) + Number(hayOpcion) + Number(hayInicio) !== 1) return null;

  if (hayInicio) return c.inicio === true ? { visitante, pagina, slug, inicio: true } : null;

  if (hayOpcion) return esOpcionId(c.opcion) ? { visitante, pagina, slug, opcion: c.opcion } : null;

  if (typeof c.texto !== "string") return null;
  const texto = sanearTexto(c.texto).trim();
  if (texto === "" || Array.from(texto).length > LIMITES.maxTexto) return null;
  return { visitante, pagina, slug, texto };
}
