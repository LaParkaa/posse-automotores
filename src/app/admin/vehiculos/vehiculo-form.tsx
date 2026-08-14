"use client";
import { useState, useRef } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { X, ImagePlus, VideoIcon, Loader2 } from "lucide-react";
import type { Vehiculo } from "@/lib/types";

const BUCKET = "vehiculos-posse";

const inputClass =
  "w-full rounded border border-white/15 bg-car-gray2 px-4 py-2.5 text-sm text-car-white outline-none focus:border-car-gold";
const labelClass = "mb-1.5 block text-xs uppercase tracking-wide text-car-muted";

function getSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

function storagePathFromUrl(url: string) {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : url.slice(i + marker.length);
}

export function VehiculoForm({
  action,
  vehiculo,
}: {
  action: (formData: FormData) => Promise<void>;
  vehiculo?: Vehiculo;
}) {
  const [imagenes, setImagenes] = useState<string[]>(vehiculo?.imagenes ?? []);
  const [videos, setVideos] = useState<string[]>(vehiculo?.videos ?? []);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadError("");
    const supabase = getSupabase();
    const nuevas: string[] = [];

    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop() ?? "jpg";
      const nombre = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(nombre, file, { upsert: false });

      if (error) {
        setUploadError(`Error subiendo ${file.name}: ${error.message}`);
        continue;
      }

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(nombre);
      nuevas.push(data.publicUrl);
    }

    setImagenes((prev) => [...prev, ...nuevas]);
    setUploading(false);
  }

  async function handleVideoFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadError("");
    const supabase = getSupabase();
    const nuevos: string[] = [];

    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop() ?? "mp4";
      const nombre = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(nombre, file, { upsert: false });

      if (error) {
        setUploadError(`Error subiendo ${file.name}: ${error.message}`);
        continue;
      }

      const { data } = supabase.storage.from(BUCKET).getPublicUrl(nombre);
      nuevos.push(data.publicUrl);
    }

    setVideos((prev) => [...prev, ...nuevos]);
    setUploading(false);
  }

  async function eliminarImagen(url: string) {
    setImagenes((prev) => prev.filter((u) => u !== url));
    const path = storagePathFromUrl(url);
    if (path) {
      const supabase = getSupabase();
      await supabase.storage.from(BUCKET).remove([path]);
    }
  }

  async function eliminarVideo(url: string) {
    setVideos((prev) => prev.filter((u) => u !== url));
    const path = storagePathFromUrl(url);
    if (path) {
      const supabase = getSupabase();
      await supabase.storage.from(BUCKET).remove([path]);
    }
  }

  function moverPrincipal(url: string) {
    setImagenes((prev) => [url, ...prev.filter((u) => u !== url)]);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError("");
    const formData = new FormData(e.currentTarget);
    formData.set("imagenes", imagenes.join("\n"));
    formData.set("videos", videos.join("\n"));
    try {
      await action(formData);
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? `No se pudo guardar: ${err.message}`
          : "No se pudo guardar el vehículo. Probá de nuevo."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="max-w-2xl space-y-5 rounded-lg border border-white/10 bg-car-gray p-5 sm:p-8"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Nombre completo *</label>
          <input name="nombre" defaultValue={vehiculo?.nombre} required className={inputClass} placeholder="VW Amarok V6 Extreme" />
        </div>
        <div>
          <label className={labelClass}>Marca *</label>
          <input name="marca" defaultValue={vehiculo?.marca} required className={inputClass} placeholder="Volkswagen" />
        </div>
        <div>
          <label className={labelClass}>Modelo *</label>
          <input name="modelo" defaultValue={vehiculo?.modelo} required className={inputClass} placeholder="Amarok V6 Extreme" />
        </div>
        <div>
          <label className={labelClass}>Año *</label>
          <input name="anio" type="number" defaultValue={vehiculo?.anio} required className={inputClass} placeholder="2025" />
        </div>
        <div>
          <label className={labelClass}>Kilometraje</label>
          <input name="kilometraje" defaultValue={vehiculo?.kilometraje ?? "Consultá km"} className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>Combustible *</label>
          <select name="combustible" defaultValue={vehiculo?.combustible ?? "Nafta"} required className={inputClass}>
            {["Nafta", "Diesel", "Híbrido", "Eléctrico", "GNC"].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Transmisión *</label>
          <select name="transmision" defaultValue={vehiculo?.transmision ?? "Manual"} required className={inputClass}>
            <option value="Manual">Manual</option>
            <option value="Automático">Automático</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Motor</label>
          <input name="motor" defaultValue={vehiculo?.motor ?? ""} className={inputClass} placeholder="V6 3.0" />
        </div>
        <div>
          <label className={labelClass}>Tipo</label>
          <select name="tipo" defaultValue={vehiculo?.tipo ?? ""} className={inputClass}>
            <option value="">— Sin especificar —</option>
            {["Sedán", "Hatchback", "SUV", "Pick-up", "Camioneta", "Moto", "Utilitario"].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Precio</label>
          <input name="precio_texto" defaultValue={vehiculo?.precio_texto ?? "Consultá precio"} className={inputClass} placeholder="Consultá precio" />
        </div>
        <div>
          <label className={labelClass}>Estado</label>
          <select name="estado" defaultValue={vehiculo?.estado ?? "disponible"} className={inputClass}>
            <option value="disponible">Disponible</option>
            <option value="vendido">Vendido</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Badge</label>
          <select name="badge" defaultValue={vehiculo?.badge ?? ""} className={inputClass}>
            <option value="">— Sin badge —</option>
            <option value="Nuevo ingreso">Nuevo ingreso</option>
            <option value="Destacado">Destacado</option>
            <option value="Usado">Usado</option>
          </select>
        </div>
      </div>

      <div>
        <label className={labelClass}>Descripción</label>
        <textarea name="descripcion" defaultValue={vehiculo?.descripcion ?? ""} rows={4} className={inputClass} />
      </div>

      {/* ── Imágenes ───────────────────────────────────────────────────── */}
      <div>
        <label className={labelClass}>
          Fotos del vehículo{" "}
          <span className="normal-case text-car-muted/60">(la primera es la principal)</span>
        </label>

        {imagenes.length > 0 && (
          <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {imagenes.map((url, i) => (
              <div key={url} className="group relative">
                <img
                  src={url}
                  alt={`Foto ${i + 1}`}
                  className={`aspect-square w-full rounded object-cover ${i === 0 ? "ring-2 ring-car-gold" : "opacity-80"}`}
                />
                {i === 0 && (
                  <span className="absolute bottom-1 left-1 rounded bg-car-gold px-1 text-[9px] font-bold uppercase text-car-black">
                    Principal
                  </span>
                )}
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded bg-black/60 opacity-0 transition group-hover:opacity-100">
                  {i !== 0 && (
                    <button
                      type="button"
                      onClick={() => moverPrincipal(url)}
                      className="rounded bg-car-gold px-2 py-0.5 text-[10px] font-bold text-car-black"
                    >
                      Principal
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => eliminarImagen(url)}
                    className="rounded bg-red-600 p-1 text-white"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex w-full items-center justify-center gap-2 rounded border border-dashed border-white/20 py-4 text-sm text-car-muted transition hover:border-car-gold hover:text-car-gold disabled:opacity-50"
        >
          {uploading ? (
            <><Loader2 size={16} className="animate-spin" /> Subiendo...</>
          ) : (
            <><ImagePlus size={16} /> Agregar fotos (galería o cámara)</>
          )}
        </button>

        <p className="mt-1.5 text-xs text-car-muted">
          En iPhone: elegís desde la galería o sacás foto directo. Podés subir varias a la vez.
        </p>
      </div>

      {/* ── Video ──────────────────────────────────────────────────────── */}
      <div>
        <label className={labelClass}>Video del vehículo</label>

        {videos.length > 0 && (
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {videos.map((url) => (
              <div key={url} className="group relative">
                <video src={url} className="aspect-video w-full rounded bg-black object-cover" muted />
                <div className="absolute inset-0 flex items-center justify-center gap-1 rounded bg-black/60 opacity-0 transition group-hover:opacity-100">
                  <button
                    type="button"
                    onClick={() => eliminarVideo(url)}
                    className="rounded bg-red-600 p-1 text-white"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          multiple
          className="hidden"
          onChange={(e) => handleVideoFiles(e.target.files)}
        />
        <button
          type="button"
          onClick={() => videoInputRef.current?.click()}
          disabled={uploading}
          className="flex w-full items-center justify-center gap-2 rounded border border-dashed border-white/20 py-4 text-sm text-car-muted transition hover:border-car-gold hover:text-car-gold disabled:opacity-50"
        >
          {uploading ? (
            <><Loader2 size={16} className="animate-spin" /> Subiendo...</>
          ) : (
            <><VideoIcon size={16} /> Agregar video (opcional)</>
          )}
        </button>

        {uploadError && <p className="mt-2 text-xs text-red-400">{uploadError}</p>}
      </div>

      {submitError && (
        <p className="rounded border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {submitError}
        </p>
      )}

      <div className="flex flex-col gap-3 pt-2 sm:flex-row">
        <button
          type="submit"
          disabled={submitting || uploading}
          className="rounded bg-car-gold px-6 py-3 font-condensed font-bold uppercase tracking-wide text-car-black transition hover:bg-car-gold-dark disabled:opacity-50"
        >
          {submitting ? "Guardando..." : "Guardar vehículo"}
        </button>
        <a
          href="/admin/vehiculos"
          className="rounded border border-white/15 px-6 py-3 text-center text-sm text-car-muted transition hover:text-car-white"
        >
          Cancelar
        </a>
      </div>
    </form>
  );
}
