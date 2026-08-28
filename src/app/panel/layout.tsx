import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Panel · Posse Automotores",
  description: "Gestión de stock y métricas de venta.",
  manifest: "/panel.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Posse",
    statusBarStyle: "black-translucent",
  },
  // El panel es privado: nunca debe aparecer en buscadores.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0d0d12",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // Deja que el fondo llegue hasta debajo del notch y de la barra de gestos.
  viewportFit: "cover",
};

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-car-black text-car-white">{children}</div>;
}
