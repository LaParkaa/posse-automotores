import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Car, Clock, Droplets, MapPin, Phone, ShieldCheck, Sparkles, Wind } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { FloatingWhatsApp } from "@/components/floating-whatsapp";

export const metadata: Metadata = {
  title: "Lavadero Posse Automotores | Justiniano Posse",
  description: "Lavadero de autos de Posse Automotores. Lavado exterior, interior, encerado, motor y detailing.",
};

const waUrl = `https://wa.me/5493537662444?text=${encodeURIComponent("Hola, quiero consultar por el lavadero de Posse Automotores")}`;

const services = [
  {
    icon: Droplets,
    title: "Lavado exterior",
    text: "Limpieza de carrocería, llantas, vidrios y terminación prolija para uso diario.",
  },
  {
    icon: Wind,
    title: "Interior y aspirado",
    text: "Aspirado completo, repaso de paneles, alfombras y detalles de cabina.",
  },
  {
    icon: Sparkles,
    title: "Encerado",
    text: "Protección y brillo para levantar la presencia del vehículo.",
  },
  {
    icon: Car,
    title: "Lavado de motor",
    text: "Servicio cuidado para zonas visibles del vano motor y terminaciones.",
  },
  {
    icon: ShieldCheck,
    title: "Detailing básico",
    text: "Correcciones simples, limpieza profunda y preparación para entrega o venta.",
  },
  {
    icon: Droplets,
    title: "Lavado completo",
    text: "Exterior, interior, aspirado y terminación general en un solo servicio.",
  },
];

export default function LavaderoPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className="relative min-h-screen overflow-hidden px-5 pb-14 pt-24">
          <video
            className="absolute inset-0 h-full w-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster="/Gemini_Generated_Image_crrcp3crrcp3crrc.png"
            aria-hidden="true"
          >
            <source src="/necesito_que_me_armes_un_video.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-black/55" />
          <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-car-black to-transparent" />

          <div className="relative z-10 mx-auto flex min-h-[calc(100vh-9.5rem)] max-w-6xl items-end">
            <div className="max-w-3xl pb-16">
              <p className="font-condensed text-sm font-bold italic uppercase tracking-[4px] text-car-gold">
                Lavadero y estética vehicular
              </p>
              <h1 className="mt-3 font-condensed text-5xl font-black italic uppercase leading-none text-car-white sm:text-7xl">
                Lavadero <span className="text-car-gold">Posse Automotores</span>
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-car-white/78">
                Cuidamos tu auto con lavado exterior, interior, aspirado, encerado y servicios de detalle para que salga listo para la calle.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  href={waUrl}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center gap-3 rounded bg-[#25D366] px-7 py-4 font-condensed text-lg font-bold uppercase tracking-wide text-white shadow-[0_4px_24px_rgba(37,211,102,0.28)] transition hover:bg-[#1da851]"
                >
                  <Phone className="size-5" /> Consultar turno
                </Link>
                <Link
                  href="#servicios"
                  className="inline-flex items-center gap-3 rounded border-2 border-white/35 bg-white/10 px-7 py-4 font-condensed text-lg font-bold uppercase tracking-wide text-car-white backdrop-blur-sm transition hover:border-car-gold hover:bg-car-gold/20 hover:text-car-gold"
                >
                  <Sparkles className="size-5" /> Ver servicios
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section id="servicios" className="px-5 py-20">
          <div className="mx-auto max-w-6xl">
            <div className="mb-12 text-center">
              <p className="font-condensed text-sm font-bold italic uppercase tracking-[4px] text-car-gold">
                Servicios
              </p>
              <h2 className="mt-2 font-condensed text-4xl font-black italic text-car-white">
                Lavado y cuidado <span className="text-car-gold">integral</span>
              </h2>
              <div className="mx-auto mt-4 h-0.5 w-12 bg-car-gold" />
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {services.map(({ icon: Icon, title, text }) => (
                <article
                  key={title}
                  className="rounded-lg border border-car-gold/12 bg-car-gray p-7 transition hover:-translate-y-1 hover:border-car-gold hover:shadow-[0_8px_32px_rgba(201,162,39,0.1)]"
                >
                  <span className="grid size-12 place-items-center rounded-lg border border-car-gold/25 bg-car-gray2 text-car-gold">
                    <Icon className="size-6" />
                  </span>
                  <h3 className="mt-5 font-condensed text-xl font-black uppercase text-car-white">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-car-muted">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-car-gray px-5 py-20">
          <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div>
              <p className="font-condensed text-sm font-bold italic uppercase tracking-[4px] text-car-gold">
                Atención
              </p>
              <h2 className="mt-2 font-condensed text-4xl font-black italic text-car-white">
                Horarios y contacto
              </h2>
              <div className="mt-4 h-0.5 w-12 bg-car-gold" />
              <p className="mt-6 leading-7 text-car-white/70">
                Servicio de muestra para la presentación del lavadero. Usamos el mismo WhatsApp de Posse Automotores para centralizar las consultas.
              </p>
              <div className="mt-8 grid gap-4">
                <div className="flex items-start gap-4 rounded-lg border border-car-gold/12 bg-car-gray2 p-5">
                  <Clock className="mt-1 size-5 text-car-gold" />
                  <div>
                    <p className="font-condensed text-lg font-bold uppercase text-car-white">Lunes a sábados</p>
                    <p className="mt-1 text-sm text-car-muted">8:30 a 13:00 / 16:00 a 20:00</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 rounded-lg border border-car-gold/12 bg-car-gray2 p-5">
                  <MapPin className="mt-1 size-5 text-car-gold" />
                  <div>
                    <p className="font-condensed text-lg font-bold uppercase text-car-white">Justiniano Posse</p>
                    <p className="mt-1 text-sm text-car-muted">Córdoba, Argentina</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative min-h-[360px] overflow-hidden rounded-lg border border-car-gold/20 bg-car-black">
              <Image
                src="/Gemini_Generated_Image_crrcp3crrcp3crrc.png"
                alt="Lavadero Posse Automotores"
                fill
                sizes="(min-width: 1024px) 54vw, 100vw"
                className="object-cover"
              />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
      <FloatingWhatsApp />
    </>
  );
}
