"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { BarChart3, Car, Plus } from "lucide-react";
import { cambiarEstado, deshacerVenta, marcarVendido } from "@/app/panel/actions";
import { getKpis } from "@/lib/metrics";
import type { EstadoVehiculo, Vehiculo } from "@/lib/types";
import { useVehiculosRealtime } from "@/lib/use-vehiculos-realtime";
import { KpiHeader } from "./kpi-header";
import { SaleSheet } from "./sale-sheet";
import { SalesChart } from "./sales-chart";
import { StockList } from "./stock-list";

type Tab = "stock" | "metricas";
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

  const [tab, setTab] = useState<Tab>("stock");
  const [ventaAbierta, setVentaAbierta] = useState<Vehiculo | null>(null);
  const [pendientes, setPendientes] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<Toast | null>(null);
  const [, startTransition] = useTransition();

  const activos = useMemo(() => vivos.filter((v) => v.deleted_at === null), [vivos]);
  const kpis = useMemo(() => getKpis(activos, ahoraVivo), [activos, ahoraVivo]);

  // El toast se va solo a los 6 segundos, que es la ventana para tocar "Deshacer".
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(id);
  }, [toast]);

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
      <header
        className="sticky top-0 z-30 border-b border-white/10 bg-car-black/95 px-4 pb-3 backdrop-blur"
        style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top))" }}
      >
        <div className="mb-3 flex items-center gap-2">
          <img src="/logo-posse.png" alt="Posse Automotores" className="h-7 w-auto" />
          <span className="font-condensed text-sm font-black italic uppercase tracking-[3px] text-car-gold">
            Panel
          </span>
        </div>

        <KpiHeader kpis={kpis} />

        <div className="mt-3 grid grid-cols-2 gap-1 rounded-full bg-car-gray2 p-1">
          {(["stock", "metricas"] as Tab[]).map((valor) => (
            <button
              key={valor}
              type="button"
              onClick={() => setTab(valor)}
              className={`min-h-11 rounded-full text-sm font-bold uppercase tracking-wide transition ${
                tab === valor ? "bg-car-gold text-car-black" : "text-car-muted"
              }`}
            >
              {valor === "stock" ? "Stock" : "Métricas"}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 px-4 pb-32 pt-4">
        {tab === "stock" ? (
          <StockList vehiculos={activos} onEstado={onEstado} pendientes={pendientes} />
        ) : (
          <SalesChart vehiculos={activos} ahora={ahoraVivo} />
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

      <nav
        className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-lg justify-around border-t border-white/10 bg-car-black/95 backdrop-blur"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <button
          type="button"
          onClick={() => setTab("stock")}
          className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-bold uppercase ${
            tab === "stock" ? "text-car-gold" : "text-car-muted"
          }`}
        >
          <Car size={20} /> Stock
        </button>
        <button
          type="button"
          onClick={() => setTab("metricas")}
          className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-bold uppercase ${
            tab === "metricas" ? "text-car-gold" : "text-car-muted"
          }`}
        >
          <BarChart3 size={20} /> Métricas
        </button>
        <Link
          href="/admin/vehiculos/nuevo"
          className="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-bold uppercase text-car-muted"
        >
          <Plus size={20} /> Agregar
        </Link>
      </nav>

      <SaleSheet
        vehiculo={ventaAbierta}
        onCerrar={() => setVentaAbierta(null)}
        onConfirmar={onConfirmarVenta}
      />
    </div>
  );
}
