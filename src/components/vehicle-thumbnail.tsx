export function VehicleThumbnail({
  src,
  alt,
  className = "aspect-video w-full",
  imgClassName = "",
  loading,
}: {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  loading?: "lazy" | "eager";
}) {
  return (
    <div className={`relative overflow-hidden bg-car-gray2 ${className}`}>
      <div
        aria-hidden="true"
        className="absolute inset-0 scale-110 bg-cover bg-center opacity-60 blur-xl"
        style={{ backgroundImage: `url(${src})` }}
      />
      <img
        src={src}
        alt={alt}
        loading={loading}
        className={`relative h-full w-full object-contain ${imgClassName}`}
      />
    </div>
  );
}
