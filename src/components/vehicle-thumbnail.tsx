/**
 * Muestra la foto de un vehículo completa, sin recortar: la card toma el
 * alto real de la imagen (`h-auto`) en vez de forzar un recuadro fijo y
 * rellenarlo o recortar lo que sobre.
 *
 * Íconos chicos de tamaño fijo (p. ej. el thumbnail de 64px en vehicle-row.tsx) mantienen `object-cover` en vez de usar este componente, a propósito.
 */
export function VehicleThumbnail({
  src,
  alt,
  className = "",
  loading,
}: {
  src: string;
  alt: string;
  className?: string;
  loading?: "lazy" | "eager";
}) {
  return (
    <img
      src={src}
      alt={alt}
      loading={loading}
      className={`block w-full h-auto ${className}`}
    />
  );
}
