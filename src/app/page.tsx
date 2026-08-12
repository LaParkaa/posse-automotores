import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { FloatingWhatsApp } from "@/components/floating-whatsapp";
import { VehicleCard, VehicleCardVendido } from "@/components/vehicle-card";
import { getVehiculosDisponibles, getVehiculosVendidos } from "@/lib/data";

export const dynamic = "force-dynamic";

const CarIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-7">
    <path d="M1 3h15v13H1z"/><path d="M16 8h4l3 3v5h-7V8z"/>
    <circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>
  </svg>
);

export default async function Home() {
  const [disponibles, vendidos] = await Promise.all([
    getVehiculosDisponibles(),
    getVehiculosVendidos(),
  ]);

  const destacados = disponibles.filter((v) => v.badge === "Destacado").slice(0, 3);
  const featured = destacados.length >= 3 ? destacados : disponibles.slice(0, 3);

  const waUrl = `https://wa.me/5493537662444?text=${encodeURIComponent("Hola, quiero consultar un vehículo")}`;

  return (
    <>
      <SiteHeader />
      <main>
        {/* HERO */}
        <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-5 pb-20 pt-24 text-center">
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/img/frente%20local.jpg')" }} />
          <video
            className="absolute inset-0 h-full w-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster="/img/frente%20local.jpg"
            aria-hidden="true"
          >
            <source src="/toma_publicitaria_de_que_pasd.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-black/45" />
          <div className="relative z-10 max-w-3xl lg:-translate-y-8">
            <span className="mb-6 inline-block rounded-full border border-car-gold bg-car-gold/15 px-4 py-1.5 text-xs font-bold uppercase tracking-[3px] text-car-gold">
              Justiniano Posse · Córdoba · Argentina
            </span>
            <h1 className="font-condensed text-6xl font-black italic leading-none tracking-tight text-car-white sm:text-8xl">
              <span className="text-car-gold">POSSE</span><br />AUTOMOTORES
            </h1>
            <p className="mt-4 font-condensed text-xl font-bold italic uppercase tracking-[4px] text-car-white/50">
              Usados &amp; 0km
            </p>
            <p className="mt-6 text-lg text-car-white/80">Tu inversión en buenas manos.</p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link href="/catalogo" className="flex items-center gap-3 rounded border-2 border-white/35 bg-white/10 px-8 py-4 font-condensed text-lg font-bold uppercase tracking-wide text-car-white backdrop-blur-sm transition hover:border-car-gold hover:bg-car-gold/20 hover:text-car-gold">
                <CarIcon /> Ver catálogo
              </Link>
              <Link href={waUrl} target="_blank" rel="noopener"
                className="flex items-center gap-3 rounded bg-[#25D366] px-8 py-4 font-condensed text-lg font-bold uppercase tracking-wide text-white shadow-[0_4px_24px_rgba(37,211,102,0.3)] transition hover:bg-[#1da851]">
                Consultanos ahora
              </Link>
            </div>
          </div>
          <div className="absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1 text-car-white/30">
            <div className="h-10 w-px bg-gradient-to-b from-car-gold to-transparent" />
            <span className="text-xs uppercase tracking-[2px]">Scroll</span>
          </div>
        </section>

        {/* STRIP */}
        <section className="border-y-2 border-car-gold bg-gradient-to-r from-[#1a1200] to-[#2a1f00] px-5 py-5">
          <div className="mx-auto grid max-w-5xl grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              ["4.9★", "Google"],
              ["+300", "Clientes"],
              ["0km", "y Usados"],
              ["✓", "Financiación"],
            ].map(([num, label]) => (
              <div key={label} className="text-center">
                <p className="font-condensed text-3xl font-black italic text-car-gold">{num}</p>
                <p className="text-xs uppercase tracking-wide text-car-muted">{label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* DESTACADOS */}
        {featured.length > 0 && (
          <section className="mx-auto max-w-7xl px-5 py-20">
            <div className="mb-10 text-center">
              <p className="font-condensed text-sm font-bold italic uppercase tracking-[4px] text-car-gold">Nuestro stock</p>
              <h2 className="mt-2 font-condensed text-4xl font-black italic text-car-white">
                Vehículos <span className="text-car-gold">disponibles</span>
              </h2>
              <div className="mx-auto mt-4 h-0.5 w-12 bg-car-gold" />
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((v) => <VehicleCard key={v.id} vehiculo={v} />)}
            </div>
            {disponibles.length > 3 && (
              <div className="mt-10 text-center">
                <Link href="/catalogo" className="inline-flex items-center gap-2 rounded bg-car-gold px-8 py-3 font-condensed font-bold uppercase tracking-wide text-car-black transition hover:bg-car-gold-dark">
                  Ver catálogo completo
                </Link>
              </div>
            )}
          </section>
        )}

        {/* NOSOTROS */}
        <section id="nosotros" className="bg-car-gray px-5 py-20">
          <div className="mx-auto grid max-w-5xl gap-16 lg:grid-cols-2 lg:items-center">
            <div>
              <p className="font-condensed text-sm font-bold italic uppercase tracking-[4px] text-car-gold">Quiénes somos</p>
              <h2 className="mt-2 font-condensed text-4xl font-black italic text-car-white">
                Tu concesionaria de <span className="text-car-gold">confianza</span>
              </h2>
              <div className="mt-4 h-0.5 w-12 bg-car-gold" />
              <p className="mt-6 leading-7 text-car-white/70">
                Somos <strong className="text-car-white">Posse Automotores</strong>, una concesionaria con raíces en Justiniano Posse y presencia en toda la región de Córdoba. Nos especializamos en la compraventa de vehículos usados y 0km, con opciones para todos los presupuestos.
              </p>
              <p className="mt-4 leading-7 text-car-white/70">
                Trabajamos con honestidad y transparencia en cada operación. Te acompañamos desde que elegís el auto hasta que te entregamos las llaves, sin letra chica ni sorpresas.
              </p>
              <div className="mt-8 flex gap-8">
                {[["4.9★", "Google"], ["+300", "Clientes"], ["0km", "y Usados"]].map(([n, l]) => (
                  <div key={l}>
                    <p className="font-condensed text-3xl font-black italic text-car-gold">{n}</p>
                    <p className="text-xs uppercase tracking-wide text-car-muted">{l}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                ["⭐", "4.9 estrellas en Google", "Calificación de clientes reales"],
                ["👥", "Atención personalizada", "Te acompañamos en todo el proceso"],
                ["📍", "Presencia local", "En el corazón de Justiniano Posse"],
              ].map(([icon, title, desc], i) => (
                <div key={title} className={`rounded-lg border border-car-gold/15 bg-car-gray2 p-6 text-center transition hover:border-car-gold hover:-translate-y-1 ${i === 0 ? "col-span-2" : ""}`}>
                  <p className="mb-2 text-2xl">{icon}</p>
                  <p className="font-condensed font-bold text-car-white">{title}</p>
                  <p className="mt-1 text-xs text-car-muted">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* POR QUÉ ELEGIRNOS */}
        <section id="porque" className="px-5 py-20">
          <div className="mx-auto max-w-5xl">
            <div className="mb-12 text-center">
              <p className="font-condensed text-sm font-bold italic uppercase tracking-[4px] text-car-gold">Ventajas</p>
              <h2 className="mt-2 font-condensed text-4xl font-black italic text-car-white">
                Por qué <span className="text-car-gold">elegirnos</span>
              </h2>
              <div className="mx-auto mt-4 h-0.5 w-12 bg-car-gold" />
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["💳", "Financiación", "Opciones adaptadas a tu posibilidad. Cuotas accesibles."],
                ["🛡️", "Garantía", "Todos nuestros usados pasan control exhaustivo."],
                ["📄", "Trámites", "Nos encargamos de toda la documentación."],
                ["💬", "Atención 24hs", "Respondemos por WhatsApp sin demoras."],
              ].map(([icon, title, desc]) => (
                <div key={title} className="rounded-lg border border-car-gold/12 bg-car-gray p-8 text-center transition hover:border-car-gold hover:-translate-y-1.5 hover:shadow-[0_8px_32px_rgba(201,162,39,0.1)]">
                  <p className="mb-4 text-3xl">{icon}</p>
                  <p className="font-condensed text-lg font-black text-car-white">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-car-muted">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* VENDIDOS */}
        {vendidos.length > 0 && (
          <section className="bg-car-gray px-5 py-20">
            <div className="mx-auto max-w-7xl">
              <div className="mb-10 text-center">
                <p className="font-condensed text-sm font-bold italic uppercase tracking-[4px] text-car-gold">Historial</p>
                <h2 className="mt-2 font-condensed text-4xl font-black italic text-car-white">
                  Ya <span className="text-car-gold">vendidos</span>
                </h2>
                <div className="mx-auto mt-4 h-0.5 w-12 bg-car-gold" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {vendidos.slice(0, 8).map((v) => <VehicleCardVendido key={v.id} vehiculo={v} />)}
              </div>
            </div>
          </section>
        )}

        {/* CONTACTO */}
        <section id="contacto" className="px-5 py-20">
          <div className="mx-auto grid max-w-5xl gap-16 lg:grid-cols-2">
            <div>
              <p className="font-condensed text-sm font-bold italic uppercase tracking-[4px] text-car-gold">Encontranos</p>
              <h2 className="mt-2 font-condensed text-4xl font-black italic text-car-white">Contacto</h2>
              <div className="mt-4 h-0.5 w-12 bg-car-gold" />
              <table className="mt-8 w-full">
                <tbody>
                  {[
                    ["Lunes a Viernes", "9:00 – 13:00 / 16:00 – 20:00"],
                    ["Sábados", "9:00 – 13:00"],
                    ["Domingos", "Cerrado"],
                  ].map(([dia, hora]) => (
                    <tr key={dia} className="border-b border-white/5">
                      <td className="py-3 text-sm text-car-muted">{dia}</td>
                      <td className={`py-3 text-sm font-semibold ${hora === "Cerrado" ? "text-car-gold" : "text-car-white"}`}>{hora}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-8 flex flex-col gap-4">
                <Link href={waUrl} target="_blank" rel="noopener" className="flex items-center gap-3 text-car-white/70 transition hover:text-car-white">
                  <span className="grid size-11 place-items-center rounded-lg border border-car-gold/20 bg-car-gray2 text-xl">📱</span>
                  +54 9 3537 66-2444
                </Link>
                <Link href="https://maps.google.com/?q=Justiniano+Posse+Córdoba" target="_blank" rel="noopener" className="flex items-center gap-3 text-car-white/70 transition hover:text-car-white">
                  <span className="grid size-11 place-items-center rounded-lg border border-car-gold/20 bg-car-gray2 text-xl">📍</span>
                  Justiniano Posse, Córdoba
                </Link>
              </div>
            </div>
            <div className="overflow-hidden rounded-lg border border-car-gold/20">
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d27292.!2d-62.677!3d-33.876!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x95cc6d!2sJustiniano+Posse%2C+C%C3%B3rdoba!5e0!3m2!1ses!2sar!4v1"
                width="100%" height="100%" style={{ minHeight: 280, border: 0, filter: "invert(90%) hue-rotate(180deg)" }}
                allowFullScreen loading="lazy"
              />
            </div>
          </div>

          <Link
            href="/lavadero"
            className="group mx-auto mt-16 grid max-w-5xl overflow-hidden rounded-lg border border-car-gold/35 bg-car-gray text-left shadow-[0_16px_45px_rgba(0,0,0,0.25)] transition hover:scale-[1.01] hover:border-car-gold sm:grid-cols-[220px_1fr]"
          >
            <span
              className="min-h-36 bg-cover bg-center sm:min-h-full"
              style={{ backgroundImage: "url('/Gemini_Generated_Image_crrcp3crrcp3crrc.png')" }}
              aria-hidden="true"
            />
            <span className="flex flex-col justify-center p-6">
              <span className="font-condensed text-xs font-bold uppercase tracking-[3px] text-car-gold">
                Nuevo servicio
              </span>
              <span className="mt-1 font-condensed text-2xl font-black italic uppercase text-car-white">
                Lavadero Posse Automotores
              </span>
              <span className="mt-2 text-sm leading-6 text-car-white/70">
                Lavado exterior, interior, aspirado, encerado y cuidado integral para tu vehículo.
              </span>
              <span className="mt-4 font-condensed text-sm font-bold uppercase tracking-wide text-car-gold transition group-hover:text-car-white">
                Conocer el lavadero
              </span>
            </span>
          </Link>
        </section>
      </main>
      <SiteFooter />
      <FloatingWhatsApp />
    </>
  );
}
