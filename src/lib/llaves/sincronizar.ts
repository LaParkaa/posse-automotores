import type { Vehiculo } from "@/lib/types";
import { ErrorBusqueda } from "./buscadores";
import { consultaLlave } from "./consulta";
import { ErrorDescarga, type ImagenDescargada } from "./descargar";

export type CodigoError = "sin_proveedor" | "sin_resultados" | "fallo";
export type ResultadoLlave = { ok: true; url: string } | { ok: false; codigo: CodigoError; error: string };

export type DepsSincronizar = {
  buscar: (consulta: string) => Promise<string[]>;
  descargar: (url: string) => Promise<ImagenDescargada>;
  guardar: (imagen: ImagenDescargada) => Promise<string>;
  ahora: () => number;
  /** Tiempo máximo para probar candidatas (la acción corre dentro del límite de la función del servidor). */
  presupuestoMs?: number;
};

const PRESUPUESTO_POR_DEFECTO_MS = 20_000;

/**
 * Busca la foto de la llave de un auto y guarda la primera imagen que sirva: prueba las candidatas en orden y salta
 * las que no se pueden bajar. Nunca lanza: devuelve el motivo para que la pantalla lo explique.
 */
export async function buscarYGuardarLlave(
  vehiculo: Pick<Vehiculo, "marca" | "modelo" | "anio">,
  deps: DepsSincronizar,
): Promise<ResultadoLlave> {
  const inicio = deps.ahora();
  const presupuesto = deps.presupuestoMs ?? PRESUPUESTO_POR_DEFECTO_MS;

  let candidatas: string[];
  try {
    candidatas = await deps.buscar(consultaLlave(vehiculo));
  } catch (e) {
    if (e instanceof ErrorBusqueda && e.motivo === "sin_proveedor") {
      return { ok: false, codigo: "sin_proveedor", error: e.message };
    }
    return { ok: false, codigo: "fallo", error: e instanceof Error ? e.message : "No se pudo buscar la imagen" };
  }
  if (candidatas.length === 0) {
    return { ok: false, codigo: "sin_resultados", error: "No encontré imágenes para esa llave" };
  }

  for (const candidata of candidatas) {
    if (deps.ahora() - inicio > presupuesto) break;

    let imagen: ImagenDescargada;
    try {
      imagen = await deps.descargar(candidata);
    } catch (e) {
      if (e instanceof ErrorDescarga) continue; // esta no sirvió: se prueba la siguiente
      return { ok: false, codigo: "fallo", error: e instanceof Error ? e.message : "No se pudo bajar la imagen" };
    }

    try {
      return { ok: true, url: await deps.guardar(imagen) };
    } catch (e) {
      // Si falla el guardado (storage o base) no tiene sentido seguir probando otras imágenes.
      return { ok: false, codigo: "fallo", error: e instanceof Error ? e.message : "No se pudo guardar la imagen" };
    }
  }

  return { ok: false, codigo: "sin_resultados", error: "No encontré una imagen que se pueda usar" };
}
