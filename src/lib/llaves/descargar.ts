import { hostEsPrivado, urlDescargable } from "./url-segura";

export type TipoImagen = { contentType: "image/jpeg" | "image/png" | "image/webp"; ext: "jpg" | "png" | "webp" };
export type ImagenDescargada = TipoImagen & { bytes: Uint8Array };

export const MAX_BYTES_LLAVE = 4 * 1024 * 1024;
const MAX_REDIRECCIONES = 3;
const TIMEOUT_MS = 6000;

export class ErrorDescarga extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ErrorDescarga";
  }
}

export type DepsDescarga = {
  fetch: typeof fetch;
  /** Direcciones IP a las que resuelve un nombre (para no entrar a la red interna con un dominio público). */
  resolver: (host: string) => Promise<string[]>;
  timeoutMs?: number;
};

/** Reconoce JPG, PNG y WebP por los primeros bytes (el Content-Type de un servidor ajeno no es confiable). */
export function tipoPorFirma(b: Uint8Array): TipoImagen | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { contentType: "image/jpeg", ext: "jpg" };
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    return { contentType: "image/png", ext: "png" };
  }
  if (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && // RIFF
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 // WEBP
  ) {
    return { contentType: "image/webp", ext: "webp" };
  }
  return null;
}

async function verificarHost(url: URL, resolver: DepsDescarga["resolver"]): Promise<void> {
  let ips: string[];
  try {
    ips = await resolver(url.hostname);
  } catch {
    throw new ErrorDescarga("No se pudo resolver la dirección de la imagen");
  }
  if (ips.length === 0 || ips.some(hostEsPrivado)) throw new ErrorDescarga("Dirección de imagen no permitida");
}

async function leerAcotado(respuesta: Response): Promise<Uint8Array> {
  const declarado = Number(respuesta.headers.get("content-length") ?? "0");
  if (declarado > MAX_BYTES_LLAVE) throw new ErrorDescarga("La imagen es demasiado pesada");
  if (!respuesta.body) throw new ErrorDescarga("La imagen vino vacía");

  const lector = respuesta.body.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    total += value.length;
    if (total > MAX_BYTES_LLAVE) {
      await lector.cancel();
      throw new ErrorDescarga("La imagen es demasiado pesada");
    }
    partes.push(value);
  }
  const bytes = new Uint8Array(total);
  let posicion = 0;
  for (const parte of partes) {
    bytes.set(parte, posicion);
    posicion += parte.length;
  }
  return bytes;
}

/**
 * Baja una imagen de una dirección ajena con todas las precauciones: solo http(s) públicos, cada redirección se vuelve a
 * validar, tiempo y peso acotados, y el formato se comprueba por el contenido. Lanza ErrorDescarga si algo no cierra.
 */
export async function descargarImagen(crudo: string, deps: DepsDescarga): Promise<ImagenDescargada> {
  const control = new AbortController();
  const timer = setTimeout(() => control.abort(), deps.timeoutMs ?? TIMEOUT_MS);
  try {
    let actual = urlDescargable(crudo);
    for (let salto = 0; salto <= MAX_REDIRECCIONES; salto++) {
      if (!actual) throw new ErrorDescarga("Dirección de imagen no permitida");
      await verificarHost(actual, deps.resolver);

      const respuesta = await deps.fetch(actual.toString(), {
        redirect: "manual",
        signal: control.signal,
        headers: { Accept: "image/jpeg,image/png,image/webp,*/*;q=0.5", "User-Agent": "Mozilla/5.0 (compatible; PosseLlaves/1.0)" },
      });

      if (respuesta.status >= 300 && respuesta.status < 400) {
        const destino = respuesta.headers.get("location");
        if (!destino) throw new ErrorDescarga("Redirección sin destino");
        actual = urlDescargable(new URL(destino, actual).toString());
        continue;
      }
      if (!respuesta.ok) throw new ErrorDescarga(`La imagen respondió ${respuesta.status}`);

      const bytes = await leerAcotado(respuesta);
      const tipo = tipoPorFirma(bytes);
      if (!tipo) throw new ErrorDescarga("Eso no es una imagen JPG, PNG o WebP");
      return { ...tipo, bytes };
    }
    throw new ErrorDescarga("Demasiadas redirecciones");
  } catch (e) {
    if (e instanceof ErrorDescarga) throw e;
    throw new ErrorDescarga("No se pudo bajar la imagen");
  } finally {
    clearTimeout(timer);
  }
}
