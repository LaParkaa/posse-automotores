import type { Metadata, Viewport } from "next";

// El login es la primera pantalla que ve el celular al abrir el acceso directo
// con la sesión vencida. Sin estos meta tags iOS lo sacaría de la app y lo
// abriría en Safari con toda la barra de navegación, que es justo lo que el
// acceso directo viene a evitar.
export const metadata: Metadata = {
  title: "Ingresar · Posse Automotores",
  manifest: "/panel.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Posse",
    statusBarStyle: "black-translucent",
  },
  robots: { index: false, follow: false },
  // Next 16 emite el nombre estandarizado (mobile-web-app-capable). iOS moderno
  // abre en pantalla completa por el "display: standalone" del manifest, pero
  // las versiones viejas de Safari solo miran este tag, y no cuesta nada.
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  themeColor: "#0d0d12",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
