import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import {
  BarChart3,
  Car,
  CreditCard,
  Globe,
  KeyRound,
  LayoutDashboard,
  LayoutList,
  LogOut,
  MessageSquare,
  Plus,
  TrendingUp,
  Users,
} from "lucide-react";
import type { Kpis } from "@/lib/metrics";
import type { PanelTab } from "@/lib/panel-tabs";

type Seccion = {
  titulo: string;
  detalle: string;
  icono: ReactNode;
  /** Pantalla del propio panel (Stock, Llaves, Métricas). */
  tab?: PanelTab;
  /** Página del admin (o de la web). */
  href?: string;
  afuera?: boolean;
  /** Cartelito de aviso arriba a la derecha (por ejemplo "3 sin foto"). */
  aviso?: string;
};

const TARJETA =
  "group relative flex h-full min-h-36 flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-car-gray2 to-car-gray p-4 text-left shadow-lg shadow-black/30 transition duration-150 active:scale-[0.97] hover:border-car-gold/40";

function Contenido({ s }: { s: Seccion }) {
  return (
    <>
      {/* Un brillo dorado suave en la esquina, para que cada tarjeta tenga volumen. */}
      <span className="pointer-events-none absolute -right-8 -top-8 size-28 rounded-full bg-car-gold/10 blur-2xl transition group-hover:bg-car-gold/20" aria-hidden />
      <div className="relative flex items-start justify-between gap-2">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-car-gold/15 text-car-gold ring-1 ring-car-gold/30 transition group-active:bg-car-gold group-active:text-car-black">
          {s.icono}
        </span>
        {s.aviso && (
          <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-black uppercase text-car-black">{s.aviso}</span>
        )}
      </div>
      <div className="relative mt-4">
        <p className="font-condensed text-[21px] font-black italic leading-none text-car-white [overflow-wrap:anywhere]">{s.titulo}</p>
        <p className="mt-1.5 text-xs leading-snug text-car-muted">{s.detalle}</p>
      </div>
    </>
  );
}

/**
 * Pantalla con la que abre el panel: todas las secciones a la vista, ordenadas por tema, cada una con su ícono y una
 * línea de qué hace. Las que son del propio panel cambian de pantalla; el resto abre la página del admin.
 */
export function PanelInicio({
  kpis,
  sinLlave,
  onIr,
}: {
  kpis: Kpis;
  /** Autos en venta que todavía no tienen foto de llave. */
  sinLlave: number;
  onIr: (tab: PanelTab) => void;
}) {
  const grupos: { titulo: string; secciones: Seccion[] }[] = [
    {
      titulo: "Stock y llaves",
      secciones: [
        { titulo: "Stock", detalle: `${kpis.stockActivo} ${kpis.stockActivo === 1 ? "auto" : "autos"} en venta`, icono: <Car size={24} />, tab: "stock" },
        {
          titulo: "Llaves",
          detalle: sinLlave > 0 ? "La foto de cada llave, para agarrar la correcta" : "Todas las llaves tienen su foto",
          icono: <KeyRound size={24} />,
          tab: "llaves",
          aviso: sinLlave > 0 ? `${sinLlave} sin foto` : undefined,
        },
        { titulo: "Agregar auto", detalle: "Cargar un vehículo nuevo", icono: <Plus size={24} />, href: "/admin/vehiculos/nuevo" },
        { titulo: "Vehículos", detalle: "Editar fotos, precios y datos de cada auto", icono: <LayoutList size={24} />, href: "/admin/vehiculos" },
      ],
    },
    {
      titulo: "Ventas",
      secciones: [
        { titulo: "Métricas", detalle: "Ventas por semana y rotación del stock", icono: <TrendingUp size={24} />, tab: "metricas" },
        { titulo: "Créditos", detalle: "Financiación y documentación", icono: <CreditCard size={24} />, href: "/admin/creditos" },
      ],
    },
    {
      titulo: "Clientes",
      secciones: [
        { titulo: "Leads", detalle: "Gente que dejó sus datos", icono: <Users size={24} />, href: "/admin/leads" },
        { titulo: "Estadísticas", detalle: "Visitas, consultas y simulaciones de la web", icono: <BarChart3 size={24} />, href: "/admin/estadisticas" },
        { titulo: "Conversaciones", detalle: "Lo que le escriben al bot de Instagram y al asistente de la web", icono: <MessageSquare size={24} />, href: "/admin/conversaciones" },
      ],
    },
    {
      titulo: "Más",
      secciones: [
        { titulo: "Dashboard", detalle: "Resumen general del stock", icono: <LayoutDashboard size={24} />, href: "/admin" },
        { titulo: "Ver la web", detalle: "Cómo la ve el cliente", icono: <Globe size={24} />, href: "/", afuera: true },
      ],
    },
  ];

  let orden = 0;

  return (
    <div className="space-y-8">
      <div className="aparecer flex items-center gap-3" style={{ "--i": 0 } as CSSProperties}>
        <img src="/logo-posse.png" alt="Posse Automotores" className="h-10 w-auto" />
        <span className="rounded-full border border-car-gold/40 px-2.5 py-0.5 font-condensed text-xs font-black italic uppercase tracking-[3px] text-car-gold">
          Panel
        </span>
      </div>

      <div className="aparecer" style={{ "--i": 1 } as CSSProperties}>
        <h1 className="font-condensed text-4xl font-black italic leading-none text-car-white">¿Qué querés hacer hoy?</h1>
        <p className="mt-2 text-sm text-car-muted">
          <span className="font-bold text-car-gold">{kpis.stockActivo}</span> {kpis.stockActivo === 1 ? "auto" : "autos"} en venta ·{" "}
          <span className="font-bold text-car-gold">{kpis.vendidosSemana}</span>{" "}
          {kpis.vendidosSemana === 1 ? "vendido" : "vendidos"} esta semana
        </p>
      </div>

      {grupos.map((grupo) => (
        <section key={grupo.titulo} aria-label={grupo.titulo}>
          <h2 className="mb-3 flex items-center gap-3 font-condensed text-sm font-black italic uppercase tracking-[3px] text-car-gold">
            {grupo.titulo}
            <span className="h-px flex-1 bg-gradient-to-r from-car-gold/30 to-transparent" aria-hidden />
          </h2>
          <ul className="grid grid-cols-2 gap-3">
            {grupo.secciones.map((s, i) => {
              orden += 1;
              const ancha = grupo.secciones.length % 2 === 1 && i === grupo.secciones.length - 1;
              const clases = `aparecer ${ancha ? "col-span-2" : ""}`;
              const estilo = { "--i": orden + 1 } as CSSProperties;
              return (
                <li key={s.titulo} className={clases} style={estilo}>
                  {s.tab ? (
                    <button type="button" onClick={() => onIr(s.tab as PanelTab)} className={`${TARJETA} w-full`}>
                      <Contenido s={s} />
                    </button>
                  ) : (
                    <Link href={s.href ?? "/"} {...(s.afuera ? { target: "_blank", rel: "noopener" } : {})} className={TARJETA}>
                      <Contenido s={s} />
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <form action="/api/auth/signout" method="post" className="aparecer pb-2 text-center" style={{ "--i": orden + 2 } as CSSProperties}>
        <button
          type="submit"
          className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-bold text-car-muted transition active:text-car-white"
        >
          <LogOut size={16} /> Cerrar sesión
        </button>
      </form>
    </div>
  );
}
