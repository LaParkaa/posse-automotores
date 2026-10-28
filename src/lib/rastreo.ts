import { origenDe, rutaSeSigue, type TipoEvento } from "./eventos";

// Solo para el navegador. Nada de esto guarda datos personales: el "visitante" es un número al azar.
const CLAVE_VISITANTE = "posse_vid";
const CLAVE_SESION = "posse_sesion";

function idDeVisitante(): string | null {
  try {
    let id = localStorage.getItem(CLAVE_VISITANTE);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(CLAVE_VISITANTE, id);
    }
    return id;
  } catch {
    // Navegación privada o almacenamiento bloqueado: se cuenta igual, sin poder saber si ya había venido.
    return null;
  }
}

/** El origen solo se informa en la primera página de la visita (después, el "referrer" es el propio sitio). */
function origenDeLaSesion(): ReturnType<typeof origenDe> {
  try {
    if (sessionStorage.getItem(CLAVE_SESION)) return null;
    sessionStorage.setItem(CLAVE_SESION, "1");
  } catch {
    return null;
  }
  return origenDe(document.referrer, location.host);
}

/** Avisa al sitio que pasó algo (una visita, un clic). Falla en silencio: medir nunca debe romper la página. */
export function registrarEvento(tipo: TipoEvento, vehiculo: string | null = null): void {
  try {
    if (typeof window === "undefined" || navigator.doNotTrack === "1") return;
    const ruta = location.pathname;
    if (!rutaSeSigue(ruta)) return;

    const cuerpo = JSON.stringify({
      tipo,
      ruta,
      vehiculo_slug: vehiculo,
      visitante: idDeVisitante(),
      origen: tipo === "visita" ? origenDeLaSesion() : null,
    });
    const enviado = navigator.sendBeacon?.("/api/eventos", new Blob([cuerpo], { type: "application/json" }));
    if (!enviado) {
      void fetch("/api/eventos", { method: "POST", headers: { "content-type": "application/json" }, body: cuerpo, keepalive: true }).catch(() => {});
    }
  } catch {
    // Nada: es solo una estadística.
  }
}
