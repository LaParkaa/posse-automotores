"use client";
import type { Vehiculo } from "@/lib/types";

const inputClass =
  "w-full rounded border border-white/15 bg-car-gray2 px-4 py-2.5 text-sm text-car-white outline-none focus:border-car-gold";
const labelClass = "mb-1.5 block text-xs uppercase tracking-wide text-car-muted";

export function VehiculoForm({
  action,
  vehiculo,
}: {
  action: (formData: FormData) => Promise<void>;
  vehiculo?: Vehiculo;
}) {
  const imagenesStr = vehiculo?.imagenes?.join("\n") ?? "";

  return (
    <form
      action={action}
      className="max-w-2xl space-y-5 rounded-lg border border-white/10 bg-car-gray p-8"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Nombre completo *</label>
          <input
            name="nombre"
            defaultValue={vehiculo?.nombre}
            required
            className={inputClass}
            placeholder="VW Amarok V6 Extreme"
          />
        </div>
        <div>
          <label className={labelClass}>Marca *</label>
          <input
            name="marca"
            defaultValue={vehiculo?.marca}
            required
            className={inputClass}
            placeholder="Volkswagen"
          />
        </div>
        <div>
          <label className={labelClass}>Modelo *</label>
          <input
            name="modelo"
            defaultValue={vehiculo?.modelo}
            required
            className={inputClass}
            placeholder="Amarok V6 Extreme"
          />
        </div>
        <div>
          <label className={labelClass}>Año *</label>
          <input
            name="anio"
            type="number"
            defaultValue={vehiculo?.anio}
            required
            className={inputClass}
            placeholder="2025"
          />
        </div>
        <div>
          <label className={labelClass}>Kilometraje</label>
          <input
            name="kilometraje"
            defaultValue={vehiculo?.kilometraje ?? "Consultá km"}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Combustible *</label>
          <select
            name="combustible"
            defaultValue={vehiculo?.combustible ?? "Nafta"}
            required
            className={inputClass}
          >
            {["Nafta", "Diesel", "Híbrido", "Eléctrico", "GNC"].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Transmisión *</label>
          <select
            name="transmision"
            defaultValue={vehiculo?.transmision ?? "Manual"}
            required
            className={inputClass}
          >
            <option value="Manual">Manual</option>
            <option value="Automático">Automático</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Motor</label>
          <input
            name="motor"
            defaultValue={vehiculo?.motor ?? ""}
            className={inputClass}
            placeholder="V6 3.0"
          />
        </div>
        <div>
          <label className={labelClass}>Tipo</label>
          <select
            name="tipo"
            defaultValue={vehiculo?.tipo ?? ""}
            className={inputClass}
          >
            <option value="">— Sin especificar —</option>
            {["Sedán", "Hatchback", "SUV", "Pick-up", "Camioneta", "Moto", "Utilitario"].map(
              (t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              )
            )}
          </select>
        </div>
        <div>
          <label className={labelClass}>Precio</label>
          <input
            name="precio_texto"
            defaultValue={vehiculo?.precio_texto ?? "Consultá precio"}
            className={inputClass}
            placeholder="Consultá precio"
          />
        </div>
        <div>
          <label className={labelClass}>Estado</label>
          <select
            name="estado"
            defaultValue={vehiculo?.estado ?? "disponible"}
            className={inputClass}
          >
            <option value="disponible">Disponible</option>
            <option value="vendido">Vendido</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Badge</label>
          <select
            name="badge"
            defaultValue={vehiculo?.badge ?? ""}
            className={inputClass}
          >
            <option value="">— Sin badge —</option>
            <option value="Nuevo ingreso">Nuevo ingreso</option>
            <option value="Destacado">Destacado</option>
            <option value="Usado">Usado</option>
          </select>
        </div>
      </div>
      <div>
        <label className={labelClass}>Descripción</label>
        <textarea
          name="descripcion"
          defaultValue={vehiculo?.descripcion ?? ""}
          rows={4}
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass}>
          URLs de imágenes (una por línea — la primera es la principal)
        </label>
        <textarea
          name="imagenes"
          defaultValue={imagenesStr}
          rows={4}
          className={inputClass}
          placeholder={"https://ejemplo.com/foto1.jpg\nhttps://ejemplo.com/foto2.jpg"}
        />
      </div>
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          className="rounded bg-car-gold px-6 py-3 font-condensed font-bold uppercase tracking-wide text-car-black transition hover:bg-car-gold-dark"
        >
          Guardar vehículo
        </button>
        <a
          href="/admin/vehiculos"
          className="rounded border border-white/15 px-6 py-3 text-sm text-car-muted transition hover:text-car-white"
        >
          Cancelar
        </a>
      </div>
    </form>
  );
}
