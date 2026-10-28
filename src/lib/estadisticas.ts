import { toArDay } from "./metrics";

/** Lo que guarda la tabla `eventos` y lo que hace falta para resumirlo. */
export type EventoGuardado = {
  tipo: string;
  vehiculo_slug: string | null;
  visitante: string | null;
  origen: string | null;
  dispositivo: string | null;
  creado: string;
};

export type AutoConocido = { slug: string; nombre: string };

export type AutoResumen = {
  slug: string;
  nombre: string;
  /** Veces que se abrió su ficha. */
  visitas: number;
  /** Toques al botón de WhatsApp de ese auto. */
  consultas: number;
  /** "Simular mi financiación" tocado o formulario enviado para ese auto. */
  simulaciones: number;
};

export type Resumen = {
  visitas: number;
  /** Personas distintas (por el número anónimo del navegador). */
  visitantes: number;
  consultas: number;
  simulaciones: number;
  /** Consultas por WhatsApp que no eran de un auto en particular (botón del menú, del inicio...). */
  consultasSinAuto: number;
  porDia: Array<{ dia: string; etiqueta: string; visitas: number; consultas: number }>;
  autos: AutoResumen[];
  origenes: Array<{ origen: string; cantidad: number }>;
  dispositivos: { celular: number; compu: number };
};

const DIA_MS = 24 * 60 * 60 * 1000;
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const claveDia = (d: Date) => d.toISOString().slice(0, 10);
const etiquetaDia = (d: Date) => `${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`;

/**
 * Resume los eventos de los últimos `dias` días (el día de `ahora` incluido, en hora argentina). Los autos salen
 * ordenados por consultas, después por simulaciones y después por visitas; solo los que tuvieron alguna actividad.
 */
export function resumir(eventos: EventoGuardado[], autos: AutoConocido[], dias: number, ahora: string): Resumen {
  const hoy = toArDay(ahora).getTime();
  const primero = hoy - (dias - 1) * DIA_MS;

  const porDia = new Map<string, { dia: string; etiqueta: string; visitas: number; consultas: number }>();
  for (let i = 0; i < dias; i++) {
    const d = new Date(primero + i * DIA_MS);
    porDia.set(claveDia(d), { dia: claveDia(d), etiqueta: etiquetaDia(d), visitas: 0, consultas: 0 });
  }

  const nombres = new Map(autos.map((a) => [a.slug, a.nombre]));
  const porAuto = new Map<string, AutoResumen>();
  const deAuto = (slug: string) => {
    let a = porAuto.get(slug);
    if (!a) {
      a = { slug, nombre: nombres.get(slug) ?? slug, visitas: 0, consultas: 0, simulaciones: 0 };
      porAuto.set(slug, a);
    }
    return a;
  };

  const visitantes = new Set<string>();
  const origenes = new Map<string, number>();
  const resumen: Resumen = {
    visitas: 0, visitantes: 0, consultas: 0, simulaciones: 0, consultasSinAuto: 0,
    porDia: [], autos: [], origenes: [], dispositivos: { celular: 0, compu: 0 },
  };

  for (const e of eventos) {
    const dia = toArDay(e.creado);
    const celda = porDia.get(claveDia(dia));
    // Fuera de la ventana pedida (por si la consulta trajo de más).
    if (!celda) continue;

    if (e.tipo === "visita") {
      resumen.visitas++;
      celda.visitas++;
      if (e.visitante) visitantes.add(e.visitante);
      if (e.origen) origenes.set(e.origen, (origenes.get(e.origen) ?? 0) + 1);
      if (e.dispositivo === "celular" || e.dispositivo === "compu") resumen.dispositivos[e.dispositivo]++;
      if (e.vehiculo_slug) deAuto(e.vehiculo_slug).visitas++;
    } else if (e.tipo === "whatsapp") {
      resumen.consultas++;
      celda.consultas++;
      if (e.vehiculo_slug) deAuto(e.vehiculo_slug).consultas++;
      else resumen.consultasSinAuto++;
    } else if (e.tipo === "simular" || e.tipo === "simulacion") {
      resumen.simulaciones++;
      if (e.vehiculo_slug) deAuto(e.vehiculo_slug).simulaciones++;
    }
  }

  resumen.visitantes = visitantes.size;
  resumen.porDia = [...porDia.values()];
  resumen.autos = [...porAuto.values()].sort(
    (a, b) => b.consultas - a.consultas || b.simulaciones - a.simulaciones || b.visitas - a.visitas || a.nombre.localeCompare(b.nombre),
  );
  resumen.origenes = [...origenes].map(([origen, cantidad]) => ({ origen, cantidad })).sort((a, b) => b.cantidad - a.cantidad);
  return resumen;
}
