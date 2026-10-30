import type { NextConfig } from "next";

// Las portadas de los autos viven en el bucket público de Supabase: Next puede achicarlas si conoce el host.
const hostSupabase = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname;
  } catch {
    return "";
  }
})();

const nextConfig: NextConfig = {
  // Para abrir el servidor de desarrollo desde el celular por la red local (http://<ip-de-la-compu>:3000).
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
  images: {
    // 40 es la calidad de las fotos de autos vendidos (ver vehicle-card.tsx).
    qualities: [40, 75],
    remotePatterns: hostSupabase
      ? [{ protocol: "https", hostname: hostSupabase, pathname: "/storage/v1/object/public/**" }]
      : [],
  },
};

export default nextConfig;
