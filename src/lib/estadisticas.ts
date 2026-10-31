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
  /** Solo con `dias = 1`: las últimas 24 horas, una por hora argentina (la última es la hora en curso). */
  porHora: Array<{ hora: string; etiqueta: string; visitas: number; consultas: number; simulaciones: number }>;
  autos: AutoResumen[];
  origenes: Array<{ origen: string; cantidad: number }>;
  dispositivos: { celular: number; compu: number };
};

const DIA_MS = 24 * 60 * 60 * 1000;
const HORA_MS = 60 * 60 * 1000;
/** Argentina no aplica horario de verano: el offset es fijo. */
const AR_OFFSET_MS = 3 * HORA_MS;
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const claveDia = (d: Date) => d.toISOString().slice(0, 10);
const etiquetaDia = (d: Date) => `${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`;
/** Comienzo de la hora en que cae un instante (en ms). Las horas enteras coinciden en UTC y en Argentina. */
const inicioHora = (iso: string) => Math.floor(new Date(iso).getTime() / HORA_MS) * HORA_MS;
const etiquetaHora = (ms: number) => `${new Date(ms - AR_OFFSET_MS).getUTCHours()} h`;

/**
 * Resume los eventos de los últimos `dias` días (el día de `ahora` incluido, en hora argentina). Con `dias = 1`
 * no es el día calendario sino las últimas 24 horas, y además arma el detalle hora por hora. Los autos salen
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

  const porHora = new Map<number, Resumen["porHora"][number]>();
  if (dias === 1) {
    const ultima = inicioHora(ahora);
    for (let i = 23; i >= 0; i--) {
      const ms = ultima - i * HORA_MS;
      porHora.set(ms, { hora: new Date(ms).toISOString(), etiqueta: etiquetaHora(ms), visitas: 0, consultas: 0, simulaciones: 0 });
    }
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
    porDia: [], porHora: [], autos: [], origenes: [], dispositivos: { celular: 0, compu: 0 },
  };

  for (const e of eventos) {
    const dia = toArDay(e.creado);
    const celda = porDia.get(claveDia(dia));
    const hora = dias === 1 ? porHora.get(inicioHora(e.creado)) : undefined;
    // Fuera de la ventana pedida (por si la consulta trajo de más). En 24 horas manda la hora, no el día.
    if (dias === 1 ? !hora : !celda) continue;

    if (e.tipo === "visita") {
      resumen.visitas++;
      if (celda) celda.visitas++;
      if (hora) hora.visitas++;
      if (e.visitante) visitantes.add(e.visitante);
      if (e.origen) origenes.set(e.origen, (origenes.get(e.origen) ?? 0) + 1);
      if (e.dispositivo === "celular" || e.dispositivo === "compu") resumen.dispositivos[e.dispositivo]++;
      if (e.vehiculo_slug) deAuto(e.vehiculo_slug).visitas++;
    } else if (e.tipo === "whatsapp") {
      resumen.consultas++;
      if (celda) celda.consultas++;
      if (hora) hora.consultas++;
      if (e.vehiculo_slug) deAuto(e.vehiculo_slug).consultas++;
      else resumen.consultasSinAuto++;
    } else if (e.tipo === "simular" || e.tipo === "simulacion") {
      resumen.simulaciones++;
      if (hora) hora.simulaciones++;
      if (e.vehiculo_slug) deAuto(e.vehiculo_slug).simulaciones++;
    }
  }

  resumen.visitantes = visitantes.size;
  resumen.porDia = [...porDia.values()];
  resumen.porHora = [...porHora.values()];
  resumen.autos = [...porAuto.values()].sort(
    (a, b) => b.consultas - a.consultas || b.simulaciones - a.simulaciones || b.visitas - a.visitas || a.nombre.localeCompare(b.nombre),
  );
  resumen.origenes = [...origenes].map(([origen, cantidad]) => ({ origen, cantidad })).sort((a, b) => b.cantidad - a.cantidad);
  return resumen;
}
