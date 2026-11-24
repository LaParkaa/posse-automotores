"use server";
import { lookup } from "node:dns/promises";
import { revalidatePath } from "next/cache";
import { requireAdminSession } from "@/lib/auth";
import { buscarImagenes, configDesdeEnv } from "@/lib/llaves/buscadores";
import { normalizarPatente } from "@/lib/llaves/consulta";
import { descargarImagen, ErrorDescarga, tipoPorFirma } from "@/lib/llaves/descargar";
import { guardarImagenLlave, quitarImagenLlave } from "@/lib/llaves/guardar";
import { buscarYGuardarLlave, type CodigoError } from "@/lib/llaves/sincronizar";
import { urlDescargable } from "@/lib/llaves/url-segura";
import { createAdminSupabaseClient } from "@/lib/supabase";

/** Lo que devuelven las acciones de las llaves: siempre un resultado, nunca una excepción (Next oculta su texto). */
export type ResultadoLlaveAccion =
  | { ok: true; url?: string | null; patente?: string | null }
  | { ok: false; error: string; codigo?: CodigoError };

// Cada foto subida desde el celular ya viene achicada (~900 KB); este es el tope del lado del servidor.
const MAX_BYTES_SUBIDA = 1_000_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const resolver = async (host: string) => (await lookup(host, { all: true })).map((r) => r.address);
const descargar = (url: string) => descargarImagen(url, { fetch, resolver });

async function autoDe(id: string) {
  if (!UUID.test(id)) return null;
  const { data } = await createAdminSupabaseClient()
    .from("vehiculos_posse")
    .select("id, marca, modelo, anio, estado")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  return data as { id: string; marca: string; modelo: string; anio: number; estado: string } | null;
}

function listo(extra: Omit<Extract<ResultadoLlaveAccion, { ok: true }>, "ok"> = {}): ResultadoLlaveAccion {
  revalidatePath("/panel");
  return { ok: true, ...extra };
}

function falla(error: unknown, respaldo: string): ResultadoLlaveAccion {
  console.error("[llaves]", error instanceof Error ? error.message : error);
  return { ok: false, error: error instanceof ErrorDescarga ? error.message : respaldo };
}

/** Busca sola la foto de la llave de un auto en internet y la guarda. */
export async function buscarLlaveAuto(id: string): Promise<ResultadoLlaveAccion> {
  await requireAdminSession();
  const auto = await autoDe(id);
  if (!auto) return { ok: false, error: "No encontré ese auto" };

  const db = createAdminSupabaseClient();
  const config = configDesdeEnv();
  const resultado = await buscarYGuardarLlave(auto, {
    buscar: (consulta) => buscarImagenes(consulta, config),
    descargar,
    guardar: (imagen) => guardarImagenLlave(db, auto.id, imagen),
    ahora: Date.now,
  });

  if (!resultado.ok) {
    if (resultado.codigo === "fallo") console.error("[llaves] búsqueda automática:", resultado.error);
    return { ok: false, error: resultado.error, codigo: resultado.codigo };
  }
  return listo({ url: resultado.url });
}

/** El vendedor pegó el link de una imagen: se baja y se guarda en el Storage para que nunca se rompa. */
export async function guardarLlaveDesdeUrl(id: string, enlace: string): Promise<ResultadoLlaveAccion> {
  await requireAdminSession();
  const auto = await autoDe(id);
  if (!auto) return { ok: false, error: "No encontré ese auto" };
  if (!urlDescargable(enlace)) return { ok: false, error: "Ese link no sirve. Pegá la dirección de una imagen (https://...)." };

  try {
    const imagen = await descargar(enlace);
    const url = await guardarImagenLlave(createAdminSupabaseClient(), auto.id, imagen);
    return listo({ url });
  } catch (e) {
    return falla(e, "No se pudo guardar la imagen");
  }
}

/** La foto sacada con el celular (ya achicada por el navegador). */
export async function subirLlave(id: string, formData: FormData): Promise<ResultadoLlaveAccion> {
  await requireAdminSession();
  const auto = await autoDe(id);
  if (!auto) return { ok: false, error: "No encontré ese auto" };

  const archivo = formData.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) return { ok: false, error: "No llegó la foto" };
  if (archivo.size > MAX_BYTES_SUBIDA) return { ok: false, error: "La foto es demasiado pesada" };

  try {
    const bytes = new Uint8Array(await archivo.arrayBuffer());
    const tipo = tipoPorFirma(bytes);
    if (!tipo) return { ok: false, error: "La foto tiene que ser JPG, PNG o WebP" };
    const url = await guardarImagenLlave(createAdminSupabaseClient(), auto.id, { ...tipo, bytes });
    return listo({ url });
  } catch (e) {
    return falla(e, "No se pudo guardar la foto");
  }
}

/** Deja al auto sin foto de llave (por si la que se encontró no es la correcta). */
export async function quitarLlave(id: string): Promise<ResultadoLlaveAccion> {
  await requireAdminSession();
  const auto = await autoDe(id);
  if (!auto) return { ok: false, error: "No encontré ese auto" };

  try {
    await quitarImagenLlave(createAdminSupabaseClient(), auto.id);
    return listo({ url: null });
  } catch (e) {
    return falla(e, "No se pudo quitar la foto");
  }
}

/** Guarda la patente del auto (vacía la borra). */
export async function guardarPatente(id: string, texto: string): Promise<ResultadoLlaveAccion> {
  await requireAdminSession();
  const auto = await autoDe(id);
  if (!auto) return { ok: false, error: "No encontré ese auto" };

  const patente = normalizarPatente(typeof texto === "string" ? texto : "");
  if (patente === undefined) return { ok: false, error: "La patente no parece válida. Ejemplo: AB123CD" };

  const { error } = await createAdminSupabaseClient().from("vehiculos_posse").update({ patente }).eq("id", auto.id);
  if (error) return falla(error.message, "No se pudo guardar la patente");
  return listo({ patente });
}
