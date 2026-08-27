import type { Vehiculo } from "./types";

export type CambioRealtime = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Vehiculo | null;
  old: { id?: string } | null;
};

/**
 * Aplica un evento de Postgres a la lista de vehículos y devuelve una lista
 * nueva. No filtra por estado: eso lo decide cada vista.
 */
export function aplicarCambio(lista: Vehiculo[], cambio: CambioRealtime): Vehiculo[] {
  if (cambio.eventType === "DELETE") {
    const id = cambio.old?.id;
    return id ? lista.filter((v) => v.id !== id) : lista;
  }

  const fila = cambio.new;
  if (!fila?.id) return lista;

  // Un borrado lógico llega como UPDATE, pero para la vista es una baja.
  if (fila.deleted_at !== null) return lista.filter((v) => v.id !== fila.id);

  const indice = lista.findIndex((v) => v.id === fila.id);
  if (indice === -1) return [fila, ...lista];

  const siguiente = [...lista];
  siguiente[indice] = fila;
  return siguiente;
}
