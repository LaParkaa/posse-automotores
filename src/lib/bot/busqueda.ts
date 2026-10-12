import type { VehiculoCatalogo } from "./types";
import type { Entidades } from "./nlu/entidades";
import { normalizar } from "./nlu/normalizar";
import { claveTipo } from "./nlu/vocabulario";
import type { Filtros } from "./sesion";

export type ResultadoBusqueda = {
  /** Cumplen todos los filtros. Solo autos disponibles, mas nuevos primero. */
  exactos: VehiculoCatalogo[];
  /** Si no hay exactos: los que quedan al relajar filtros (vacio si hay exactos). */
  alternativos: VehiculoCatalogo[];
  /** Filtros que hubo que soltar para llegar a `alternativos`, en el orden en que se soltaron. */
  relajados: Array<keyof Filtros>;
};

// El cliente suele pedir mas de lo que hay en stock: antes de decir "no tengo" se van soltando filtros, del
// menos al mas importante. El tipo nunca se suelta: ofrecerle un sedan a quien pidio una pick-up no ayuda.
const ORDEN_RELAJACION: Array<keyof Filtros> = ["anio", "transmision", "combustible", "marca"];

/** Copia solo lo que el cliente dijo; los null y las listas vacias no son filtros. */
export function filtrosDeEntidades(e: Entidades): Filtros {
  const filtros: Filtros = {};
  if (e.marca) filtros.marca = e.marca;
  if (e.tipos.length > 0) filtros.tipos = [...e.tipos];
  if (e.combustible) filtros.combustible = e.combustible;
  if (e.transmision) filtros.transmision = e.transmision;
  if (e.anio !== null) filtros.anio = e.anio;
  return filtros;
}

// Orden total y estable: created_at descendente y, si empatan, por id, para que el resultado no dependa
// del orden en que llegue el arreglo desde la base.
function masNuevoPrimero(a: VehiculoCatalogo, b: VehiculoCatalogo): number {
  const ta = Date.parse(a.created_at) || 0;
  const tb = Date.parse(b.created_at) || 0;
  if (ta !== tb) return tb - ta;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

// El combustible se carga a mano en el panel: "Nafta/GNC", "Nafta + GNC", "Diésel", "Gasoil"... Se compara
// por palabra (un auto bicombustible aparece al buscar nafta y al buscar gnc) y con los sinonimos comunes.
const SINONIMOS_COMBUSTIBLE: Record<string, string> = { gasoil: "diesel", gasolina: "nafta" };

function palabrasCombustible(texto: string): string[] {
  return normalizar(texto)
    .split(/[^a-z]+/)
    .filter((p) => p !== "")
    .map((p) => SINONIMOS_COMBUSTIBLE[p] ?? p);
}

// La transmision tambien es texto libre: "CVT", "DSG", "Tiptronic" y "Mecánica" son formas de decir
// automatico o manual. Lo que no se reconoce no matchea ninguno de los dos filtros.
const PALABRAS_AUTOMATICO = ["cvt", "dsg", "tiptronic", "secuencial", "semiautomatico", "semiautomatica", "at"];

function transmisionCanonica(texto: string): "automatico" | "manual" | null {
  const normalizado = normalizar(texto);
  const palabras = normalizado.split(/[^a-z]+/);
  if (normalizado.startsWith("automa") || palabras.some((p) => PALABRAS_AUTOMATICO.includes(p))) return "automatico";
  if (normalizado.startsWith("manual") || normalizado.includes("mecanic")) return "manual";
  return null;
}

function cumple(v: VehiculoCatalogo, f: Filtros): boolean {
  if (f.marca !== undefined && normalizar(v.marca) !== normalizar(f.marca)) return false;
  // Un auto sin tipo cargado nunca matchea un filtro de tipo (claveTipo("") no esta en ninguna lista).
  if (f.tipos !== undefined && f.tipos.length > 0 && !f.tipos.includes(claveTipo(v.tipo ?? ""))) return false;
  if (f.combustible !== undefined) {
    const buscado = palabrasCombustible(f.combustible)[0];
    if (buscado === undefined || !palabrasCombustible(v.combustible).includes(buscado)) return false;
  }
  if (f.transmision !== undefined) {
    const buscada = transmisionCanonica(f.transmision);
    if (buscada === null || transmisionCanonica(v.transmision) !== buscada) return false;
  }
  if (f.anio !== undefined && v.anio !== f.anio) return false;
  return true;
}

function disponibles(catalogo: VehiculoCatalogo[]): VehiculoCatalogo[] {
  return catalogo.filter((v) => v.estado === "disponible").sort(masNuevoPrimero);
}

export function buscar(catalogo: VehiculoCatalogo[], filtros: Filtros): ResultadoBusqueda {
  const stock = disponibles(catalogo);
  const exactos = stock.filter((v) => cumple(v, filtros));
  if (exactos.length > 0) return { exactos, alternativos: [], relajados: [] };

  const actuales: Filtros = { ...filtros };
  const relajados: Array<keyof Filtros> = [];
  for (const clave of ORDEN_RELAJACION) {
    // Soltar un filtro que el cliente no puso no cambia nada: no se cuenta como relajado.
    if (actuales[clave] === undefined) continue;
    delete actuales[clave];
    relajados.push(clave);
    const alternativos = stock.filter((v) => cumple(v, actuales));
    if (alternativos.length > 0) return { exactos: [], alternativos, relajados };
  }
  return { exactos: [], alternativos: [], relajados: [] };
}

/** Disponibles parecidos a `de`: mismo tipo por cercania de año; sin ninguno del tipo, los de la misma marca. */
export function similares(catalogo: VehiculoCatalogo[], de: VehiculoCatalogo, max = 3): VehiculoCatalogo[] {
  const candidatos = disponibles(catalogo).filter((v) => v.id !== de.id);
  const porCercania = (a: VehiculoCatalogo, b: VehiculoCatalogo) =>
    Math.abs(a.anio - de.anio) - Math.abs(b.anio - de.anio) || b.anio - a.anio || masNuevoPrimero(a, b);

  const clave = claveTipo(de.tipo ?? "");
  const mismoTipo = clave === "" ? [] : candidatos.filter((v) => claveTipo(v.tipo ?? "") === clave);
  // La marca es solo el plan B cuando no hay nada del mismo tipo: si ya hay del tipo, mezclar otros
  // modelos de la marca (ej. un hatchback al ver una utilitaria) le mostraria al cliente algo distinto de lo que mira.
  const base =
    mismoTipo.length > 0 ? mismoTipo : candidatos.filter((v) => normalizar(v.marca) === normalizar(de.marca));
  // Math.max: un limite negativo haria slice(0, -1), que devuelve casi todo en vez de nada.
  return base.sort(porCercania).slice(0, Math.max(0, max));
}

/** Los ultimos cargados, de cualquier estado (se usa cuando no se identifica la historia). */
export function recientes(catalogo: VehiculoCatalogo[], cantidad: number): VehiculoCatalogo[] {
  return [...catalogo].sort(masNuevoPrimero).slice(0, Math.max(0, cantidad));
}
