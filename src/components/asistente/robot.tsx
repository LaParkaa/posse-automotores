import Image from "next/image";

// La imagen es el robot entero (1080x1350); se agranda y se corre para que en el círculo quede la cabeza.
// La cabeza ocupa ~45% del ancho, centrada en x≈54% e y≈31% de la imagen.
const ZOOM = 1.9;
const ESTILO_ROBOT = {
  position: "absolute",
  maxWidth: "none",
  width: `${ZOOM * 100}%`,
  height: "auto",
  left: `${50 - 54 * ZOOM}%`,
  top: `${50 - 31.5 * ZOOM * (1350 / 1080)}%`,
} as const;

/** Cara del asistente en un círculo. Decorativa: el texto de al lado ya dice quién habla. */
export function AvatarRobot({ tam, className = "" }: { tam: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`relative block shrink-0 overflow-hidden rounded-full bg-gradient-to-b from-[#24365e] to-[#0f1729] ring-1 ring-car-gold/50 ${className}`}
      style={{ width: tam, height: tam }}
    >
      <Image
        src="/icons/botlogo.png"
        alt=""
        width={1080}
        height={1350}
        // Un solo tamaño para todos los círculos (el más grande, 56 px): el navegador baja una sola versión chica.
        sizes="107px"
        draggable={false}
        style={ESTILO_ROBOT}
      />
    </span>
  );
}
