"use client";
import { useEffect, useState } from "react";
import { aplicarCambio, type CambioRealtime } from "./realtime-patch";
import { getBrowserSupabase } from "./supabase-browser";
import type { Vehiculo } from "./types";

/**
 * Arranca con la lista que renderizó el servidor y la mantiene al día con los
 * cambios de la tabla. Si Supabase no está configurado o el socket se cae, se
 * conserva la lista inicial: la vista nunca queda vacía.
 */
export function useVehiculosRealtime(inicial: Vehiculo[]): Vehiculo[] {
  const [vehiculos, setVehiculos] = useState(inicial);

  useEffect(() => {
    setVehiculos(inicial);
  }, [inicial]);

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;

    const canal = supabase
      .channel("vehiculos-posse-stock")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vehiculos_posse" },
        (payload: any) => {
          setVehiculos((prev) => aplicarCambio(prev, payload as unknown as CambioRealtime));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, []);

  return vehiculos;
}
