import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { FloatingWhatsApp } from "@/components/floating-whatsapp";

export const metadata: Metadata = {
  title: "Política de privacidad | Posse Automotores",
  description:
    "Cómo Posse Automotores trata tus datos personales cuando nos escribís por Instagram o por la web, y cómo pedir que los eliminemos.",
};

const waUrl = "https://wa.me/5493537662444";
const waTexto = "+54 9 3537 66-2444";

const enlaceClase = "font-semibold text-car-gold underline-offset-4 hover:underline";

function Seccion({
  id,
  numero,
  titulo,
  children,
}: {
  id: string;
  numero: number;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 border-t border-car-gold/15 pt-8">
      <h2 className="font-condensed text-2xl font-black italic uppercase text-car-white sm:text-3xl">
        <span className="text-car-gold">{numero}.</span> {titulo}
      </h2>
      <div className="mt-4 space-y-4 leading-7 text-car-white/75">{children}</div>
    </section>
  );
}

export default function PrivacidadPage() {
  return (
    <>
      <SiteHeader />
      <main className="px-5 pb-20 pt-28">
        <div className="mx-auto max-w-3xl">
          <p className="font-condensed text-sm font-bold italic uppercase tracking-[4px] text-car-gold">
            Tus datos, claros
          </p>
          <h1 className="mt-3 font-condensed text-4xl font-black italic uppercase leading-none text-car-white sm:text-6xl">
            Política de <span className="text-car-gold">privacidad</span>
          </h1>
          <div className="mt-4 h-0.5 w-12 bg-car-gold" />
          <p className="mt-6 text-lg leading-8 text-car-white/78">
            Acá te contamos, en palabras simples, qué datos tuyos usamos cuando nos escribís por
            Instagram o por nuestra web, para qué los usamos y cómo podés pedir que los eliminemos.
          </p>

          <div className="mt-10 space-y-10">
            <Seccion id="quienes-somos" numero={1} titulo="Quiénes somos">
              <p>
                Somos Posse Automotores, una concesionaria de autos y motos de Justiniano Posse,
                Córdoba, Argentina.
              </p>
              <p>
                Podés contactarnos por WhatsApp al{" "}
                <a href={waUrl} target="_blank" rel="noopener" className={enlaceClase}>
                  {waTexto}
                </a>
                .
              </p>
            </Seccion>

            <Seccion id="datos-que-recopilamos" numero={2} titulo="Qué datos recopilamos">
              <p>Cuando nos escribís por Instagram o por la web, podemos recibir:</p>
              <ul className="list-disc space-y-2 pl-6 marker:text-car-gold">
                <li>Los mensajes que nos enviás.</li>
                <li>
                  Tu identificador de Instagram y tu nombre o usuario público, si Instagram nos los
                  informa.
                </li>
                <li>
                  Los datos de contacto que nos des voluntariamente, por ejemplo tu nombre y tu
                  teléfono.
                </li>
                <li>
                  Si te postulás para trabajar con nosotros, lo que nos cuentes en la charla: tu
                  edad, tu localidad, tu teléfono y tu experiencia laboral.
                </li>
              </ul>
              <p>No pedimos ni guardamos contraseñas, datos de tarjetas ni documentos.</p>
            </Seccion>

            <Seccion id="para-que-los-usamos" numero={3} titulo="Para qué los usamos">
              <ul className="list-disc space-y-2 pl-6 marker:text-car-gold">
                <li>Responder tus consultas sobre vehículos.</li>
                <li>Contarte la disponibilidad y los precios.</li>
                <li>Derivarte con nuestro equipo por WhatsApp.</li>
                <li>Contactarte, si lo pediste.</li>
                <li>Armar tu mensaje de postulación, si querés sumarte a nuestro equipo.</li>
              </ul>
              <p>
                Parte de la atención por Instagram es automática (asistente virtual) y siempre podés
                pedir hablar con una persona.
              </p>
              <p>No vendemos tus datos ni los usamos para publicidad de terceros.</p>
            </Seccion>

            <Seccion id="con-quien-los-compartimos" numero={4} titulo="Con quién los compartimos">
              <p>
                Solo con los proveedores que hacen posible el servicio, que los tratan por cuenta
                nuestra:
              </p>
              <ul className="list-disc space-y-2 pl-6 marker:text-car-gold">
                <li>Meta / Instagram, por la mensajería.</li>
                <li>Supabase, por el almacenamiento.</li>
                <li>Vercel, por el alojamiento.</li>
              </ul>
              <p>No los cedemos a otros fines.</p>
            </Seccion>

            <Seccion id="cuanto-tiempo-los-guardamos" numero={5} titulo="Cuánto tiempo los guardamos">
              <p>
                Los guardamos mientras sea necesario para atender tu consulta y por hasta 12 meses
                después del último contacto, salvo que pidas antes su eliminación.
              </p>
            </Seccion>

            <Seccion id="tus-derechos" numero={6} titulo="Tus derechos">
              <p>
                Según la Ley 25.326 de Protección de Datos Personales de Argentina, podés acceder a
                tus datos, rectificarlos y pedir que los suprimamos.
              </p>
              <p>
                La Agencia de Acceso a la Información Pública (AAIP) es el órgano de control de esta
                ley, y podés acudir a ella si considerás que tus derechos no fueron respetados.
              </p>
            </Seccion>

            <Seccion id="eliminar-datos" numero={7} titulo="Cómo eliminar tus datos">
              <p>
                Escribinos por WhatsApp al{" "}
                <a href={waUrl} target="_blank" rel="noopener" className={enlaceClase}>
                  {waTexto}
                </a>{" "}
                o por mensaje directo a nuestra cuenta de Instagram{" "}
                <a
                  href="https://www.instagram.com/posse_automotores"
                  target="_blank"
                  rel="noopener"
                  className={enlaceClase}
                >
                  @posse_automotores
                </a>
                , indicando tu usuario de Instagram y que querés eliminar tus datos.
              </p>
              <p>Los borramos en un plazo máximo de 30 días y te lo confirmamos.</p>
            </Seccion>

            <Seccion id="cambios" numero={8} titulo="Cambios en esta política">
              <p>Si la modificamos, te avisamos publicando la nueva versión en esta página.</p>
            </Seccion>
          </div>

          <p className="mt-12 border-t border-car-gold/15 pt-6 text-xs text-car-muted">
            Última actualización: 13/10/2026
          </p>
        </div>
      </main>
      <SiteFooter />
      <FloatingWhatsApp />
    </>
  );
}
