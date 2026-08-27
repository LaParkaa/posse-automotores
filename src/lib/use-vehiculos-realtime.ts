"use client";
import { useEffect, useState } from "react";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
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
  const [inicialPrevio, setInicialPrevio] = useState(inicial);

  // Cuando el servidor manda datos nuevos, mandan ellos: son la fuente de
  // verdad y llegan después de cada revalidación. Ajustar el estado durante el
  // render (y no en un efecto) evita el render en cascada.
  if (inicial !== inicialPrevio) {
    setInicialPrevio(inicial);
    setVehiculos(inicial);
  }

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;

    const canal = supabase
      .channel("vehiculos-posse-stock")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vehiculos_posse" },
        (payload: RealtimePostgresChangesPayload<Vehiculo>) => {
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
