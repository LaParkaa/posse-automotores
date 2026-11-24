"use client";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { BarChart3, Car, ChevronLeft, House, KeyRound, Plus } from "lucide-react";
import { cambiarEstado, deshacerVenta, marcarVendido } from "@/app/panel/actions";
import { getKpis } from "@/lib/metrics";
import { TITULOS_PANEL } from "@/lib/panel-tabs";
import { usePanelTab } from "@/lib/use-panel-tab";
import type { EstadoVehiculo, Vehiculo } from "@/lib/types";
import { useVehiculosRealtime } from "@/lib/use-vehiculos-realtime";
import { KpiHeader } from "./kpi-header";
import { LlavesView } from "./llaves-view";
import { PanelInicio } from "./panel-inicio";
import { PublicarSheet } from "./publicar-sheet";
import { SaleSheet } from "./sale-sheet";
import { SalesChart } from "./sales-chart";
import { StockList } from "./stock-list";

type Toast = { texto: string; tono: "ok" | "error"; deshacer?: () => void };

export function PanelApp({ vehiculos, ahora }: { vehiculos: Vehiculo[]; ahora: string }) {
  const vivos = useVehiculosRealtime(vehiculos);

  // El panel se usa como acceso directo y puede quedar abierto días. Si "ahora"
  // quedara clavado en el render del servidor, el KPI de la semana seguiría
  // mostrando la semana pasada. Arranca con el valor del servidor —para que la
  // hidratación coincida— y después se actualiza solo.
  const [ahoraVivo, setAhoraVivo] = useState(ahora);

  useEffect(() => {
    const refrescar = () => setAhoraVivo(new Date().toISOString());
    const id = setInterval(refrescar, 15 * 60 * 1000);
    document.addEventListener("visibilitychange", refrescar);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", refrescar);
    };
  }, []);

  // Siempre abre en el menú de inicio; la sección elegida queda en la dirección (/panel#llaves).
  const [tab, irA] = usePanelTab();
  const [ventaAbierta, setVentaAbierta] = useState<Vehiculo | null>(null);
  // Guarda solo el id: así la hoja siempre muestra el auto al día (Realtime) y se cierra si el auto desaparece.
  const [publicarId, setPublicarId] = useState<string | null>(null);
  const [pendientes, setPendientes] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<Toast | null>(null);
  const [, startTransition] = useTransition();

  const activos = useMemo(() => vivos.filter((v) => v.deleted_at === null), [vivos]);
  const kpis = useMemo(() => getKpis(activos, ahoraVivo), [activos, ahoraVivo]);
  const publicarAbierto = useMemo(() => activos.find((v) => v.id === publicarId) ?? null, [activos, publicarId]);
  // Estable: la hoja lo usa en un efecto y no debe reengancharse en cada render.
  const cerrarPublicar = useCallback(() => setPublicarId(null), []);
  const sinLlave = useMemo(() => activos.filter((v) => v.estado !== "vendido" && !v.key_image_url).length, [activos]);

  // El toast se va solo a los 6 segundos, que es la ventana para tocar "Deshacer".
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(id);
  }, [toast]);

  // Cada pantalla nueva arranca desde arriba, no donde quedó la anterior.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [tab]);

  function marcarPendiente(id: string, activo: boolean) {
    setPendientes((prev) => {
      const siguiente = new Set(prev);
      if (activo) siguiente.add(id);
      else siguiente.delete(id);
      return siguiente;
    });
  }

  /**
   * Corre una Server Action mostrando la fila como pendiente. Realtime trae el
   * estado real, así que no hace falta parchar la lista a mano: alcanza con
   * avisar si falló.
   */
  function ejecutar(id: string, accion: () => Promise<{ ok: boolean; error?: string }>, exito: Toast) {
    marcarPendiente(id, true);
    startTransition(async () => {
      try {
        const r = await accion();
        setToast(r.ok ? exito : { texto: r.error ?? "No se pudo guardar", tono: "error" });
      } catch (error) {
        console.error("panel: falló la acción", error);
        // La acción puede rechazar en vez de devolver un resultado: se cortó la
        // red o venció la sesión. Sin este catch la fila queda pendiente para
        // siempre y sus botones no vuelven a responder hasta recargar.
        setToast({ texto: "No se pudo guardar. Revisá la conexión.", tono: "error" });
      } finally {
        marcarPendiente(id, false);
      }
    });
  }

  function onEstado(id: string, estado: EstadoVehiculo) {
    const vehiculo = activos.find((v) => v.id === id);
    if (!vehiculo || vehiculo.estado === estado) return;

    if (estado === "vendido") {
      setVentaAbierta(vehiculo);
      return;
    }

    const texto = estado === "reservado" ? "Marcado como reservado" : "Devuelto al stock";
    ejecutar(id, () => cambiarEstado(id, estado), { texto, tono: "ok" });
  }

  function onConfirmarVenta(datos: { precio: number | null; nota: string | null }) {
    const vehiculo = ventaAbierta;
    if (!vehiculo) return;
    setVentaAbierta(null);

    ejecutar(vehiculo.id, () => marcarVendido(vehiculo.id, datos), {
      texto: `${vehiculo.nombre} · vendido`,
      tono: "ok",
      deshacer: () => {
        setToast(null);
        ejecutar(vehiculo.id, () => deshacerVenta(vehiculo.id), {
          texto: "Venta deshecha",
          tono: "ok",
        });
      },
    });
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col">
      {/* El inicio es una pantalla aparte, con su propio encabezado: la barra de arriba es solo de las secciones. */}
      {tab !== "inicio" && (
        <header
          className="sticky top-0 z-30 border-b border-white/10 bg-car-black/95 px-4 pb-2 backdrop-blur"
          style={{ paddingTop: "calc(0.5rem + env(safe-area-inset-top))" }}
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => irA("inicio")}
              aria-label="Volver al inicio"
              className="-ml-2 flex size-11 items-center justify-center rounded-full text-car-white active:bg-white/10"
            >
              <ChevronLeft size={24} />
            </button>
            <h1 className="font-condensed text-xl font-black italic uppercase tracking-wide text-car-white">
              {TITULOS_PANEL[tab]}
            </h1>
          </div>
        </header>
      )}

      <main
        className={`flex-1 px-4 ${tab === "inicio" ? "pb-10" : "pb-32 pt-4"}`}
        style={tab === "inicio" ? { paddingTop: "calc(1.5rem + env(safe-area-inset-top))" } : undefined}
      >
        {tab === "inicio" ? (
          <PanelInicio kpis={kpis} sinLlave={sinLlave} onIr={irA} />
        ) : tab === "stock" ? (
          <div className="space-y-4">
            <KpiHeader kpis={kpis} />
            <StockList vehiculos={activos} onEstado={onEstado} pendientes={pendientes} onPublicar={setPublicarId} />
          </div>
        ) : tab === "llaves" ? (
          <LlavesView vehiculos={activos} onToast={(texto, tono) => setToast({ texto, tono })} />
        ) : (
          <div className="space-y-4">
            <KpiHeader kpis={kpis} />
            <SalesChart vehiculos={activos} ahora={ahoraVivo} />
          </div>
        )}
      </main>

      {toast && (
        <div className="fixed inset-x-0 z-40 flex justify-center px-4" style={{ bottom: "calc(5.5rem + env(safe-area-inset-bottom))" }}>
          <div
            className={`flex w-full max-w-sm items-center justify-between gap-3 rounded-lg px-4 py-3 text-sm font-semibold shadow-lg ${
              toast.tono === "ok" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
            }`}
          >
            <span className="min-w-0 truncate">{toast.texto}</span>
            {toast.deshacer ? (
              <button type="button" onClick={toast.deshacer} className="shrink-0 underline">
                Deshacer
              </button>
            ) : (
              <button type="button" onClick={() => setToast(null)} className="shrink-0 underline">
                Cerrar
              </button>
            )}
          </div>
        </div>
      )}

      {tab !== "inicio" && (
      <nav
        aria-label="Secciones"
        className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-lg justify-around border-t border-white/10 bg-car-black/95 backdrop-blur"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {(
          [
            { valor: "inicio", texto: "Inicio", icono: <House size={20} /> },
            { valor: "stock", texto: "Stock", icono: <Car size={20} /> },
            { valor: "llaves", texto: "Llaves", icono: <KeyRound size={20} /> },
            { valor: "metricas", texto: "Métricas", icono: <BarChart3 size={20} /> },
          ] as const
        ).map(({ valor, texto, icono }) => (
          <button
            key={valor}
            type="button"
            onClick={() => irA(valor)}
            aria-current={tab === valor ? "page" : undefined}
            className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-bold uppercase ${
              tab === valor ? "text-car-gold" : "text-car-muted"
            }`}
          >
            {icono} {texto}
          </button>
        ))}
        <Link
          href="/admin/vehiculos/nuevo"
          className="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-bold uppercase text-car-muted"
        >
          <Plus size={20} /> Agregar
        </Link>
      </nav>
      )}

      {publicarAbierto && (
        <PublicarSheet
          vehiculo={publicarAbierto}
          onCerrar={cerrarPublicar}
          onToast={(texto, tono) => setToast({ texto, tono })}
        />
      )}

      <SaleSheet
        vehiculo={ventaAbierta}
        onCerrar={() => setVentaAbierta(null)}
        onConfirmar={onConfirmarVenta}
      />
    </div>
  );
}
