"use client";
import { useCallback, useState } from "react";
import Cropper from "react-easy-crop";
import type { Area, Point } from "react-easy-crop";
import { X } from "lucide-react";
import { VehicleCard } from "@/components/vehicle-card";
import { cropImageToBlob } from "@/lib/image-crop";
import type { Vehiculo } from "@/lib/types";

export function CoverCropModal({
  imageUrl,
  previewVehiculo,
  onConfirm,
  onClose,
}: {
  imageUrl: string;
  previewVehiculo: Vehiculo;
  onConfirm: (blob: Blob) => void;
  onClose: () => void;
}) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [previewUrl, setPreviewUrl] = useState(imageUrl);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");

  const onCropComplete = useCallback(
    async (_area: Area, areaPixels: Area) => {
      setCroppedAreaPixels(areaPixels);
      try {
        const blob = await cropImageToBlob(imageUrl, areaPixels);
        setPreviewUrl(URL.createObjectURL(blob));
      } catch {
        // Si falla la generación de la vista previa se sigue mostrando la
        // última válida; el recorte final se reintenta al confirmar.
      }
    },
    [imageUrl]
  );

  async function confirmar() {
    if (!croppedAreaPixels) return;
    setConfirming(true);
    setError("");
    try {
      const blob = await cropImageToBlob(imageUrl, croppedAreaPixels);
      onConfirm(blob);
    } catch {
      setError("No se pudo generar el recorte. Probá de nuevo.");
      setConfirming(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-3xl rounded-lg border border-white/10 bg-car-gray p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-condensed text-lg font-bold uppercase tracking-wide text-car-gold">
            Recortar portada
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-car-muted transition hover:text-car-white"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="relative aspect-video w-full overflow-hidden rounded bg-black">
            <Cropper
              image={imageUrl}
              crop={crop}
              zoom={zoom}
              aspect={16 / 9}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-car-muted">
              Así se va a ver la card
            </p>
            <div className="pointer-events-none">
              <VehicleCard vehiculo={{ ...previewVehiculo, cover_image_url: previewUrl }} />
            </div>
          </div>
        </div>

        <label className="mt-4 block text-xs uppercase tracking-wide text-car-muted">
          Zoom
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="mt-1 w-full"
          />
        </label>

        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-white/15 px-5 py-2.5 text-sm text-car-muted transition hover:text-car-white"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={!croppedAreaPixels || confirming}
            className="rounded bg-car-gold px-6 py-2.5 text-sm font-bold uppercase tracking-wide text-car-black transition hover:bg-car-gold-dark disabled:opacity-50"
          >
            {confirming ? "Aplicando..." : "Usar este recorte"}
          </button>
        </div>
      </div>
    </div>
  );
}
