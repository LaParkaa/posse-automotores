"use client";
import Image from "next/image";
import Link from "next/link";
import type { TarjetaWeb } from "@/lib/bot/web/tipos";
import { sePuedeOptimizar } from "@/lib/imagen";
import type { Burbuja } from "./estado";
import { AvatarRobot } from "./robot";
import { enlaceBoton, etiquetaBoton, urlSegura } from "./urls";

const BURBUJA_ASISTENTE = "rounded-2xl rounded-tl-sm bg-car-gray2 px-3.5 py-2.5 text-sm leading-relaxed text-car-white";

/** Lo que dice el asistente va con el robot chiquito al lado. */
function DelAsistente({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <AvatarRobot tam={28} className="mt-0.5" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function WaIcono() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-4 shrink-0" aria-hidden="true">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2zm5.8 14.03c-.25.69-1.44 1.32-2.01 1.41-.51.08-1.16.11-1.87-.12-.43-.14-.98-.32-1.69-.62-2.98-1.29-4.93-4.29-5.08-4.49-.15-.2-1.21-1.61-1.21-3.07 0-1.46.77-2.18 1.04-2.48.27-.3.6-.37.79-.37.2 0 .4 0 .57.01.18.01.43-.07.67.51.25.6.84 2.06.92 2.21.07.15.12.32.02.52-.1.2-.15.32-.3.5-.15.17-.31.39-.45.52-.15.15-.3.31-.13.61.17.3.77 1.27 1.65 2.06 1.14 1.01 2.09 1.33 2.39 1.48.3.15.47.12.64-.07.17-.2.74-.87.94-1.17.2-.3.4-.25.67-.15.27.1 1.74.82 2.04.97.3.15.5.22.57.35.08.12.08.72-.17 1.41z" />
    </svg>
  );
}

const ESTILO_BOTON = {
  whatsapp: "bg-[#25D366] text-white hover:bg-[#1da851]",
  interno: "border border-car-gold/60 text-car-gold hover:bg-car-gold hover:text-car-black",
  externo: "border border-white/20 text-car-white/80 hover:border-car-gold hover:text-car-gold",
} as const;

const BOTON = "flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-center text-xs font-bold uppercase tracking-wide transition";

function TarjetaAuto({ tarjeta }: { tarjeta: TarjetaWeb }) {
  const foto = urlSegura(tarjeta.imagenUrl, "imagen");
  const origen = typeof window === "undefined" ? null : window.location.origin;
  const botones = tarjeta.botones
    .map((b) => ({ titulo: b.titulo, enlace: enlaceBoton(b.url, origen) }))
    .filter((b): b is { titulo: string; enlace: NonNullable<typeof b.enlace> } => b.enlace !== null);

  return (
    <article className="flex w-56 shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-white/10 bg-car-black">
      <div className="relative aspect-[4/3] bg-car-gray2">
        {foto ? (
          <Image
            src={foto}
            alt={tarjeta.titulo}
            fill
            sizes="224px"
            unoptimized={!sePuedeOptimizar(foto)}
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center font-condensed text-sm font-bold uppercase tracking-wide text-car-muted">
            Posse Automotores
          </div>
        )}
        {tarjeta.estado === "reservado" && (
          <span className="absolute left-2 top-2 rounded bg-amber-400 px-2 py-0.5 text-[10px] font-bold uppercase text-car-black">
            Reservado
          </span>
        )}
        {tarjeta.estado === "vendido" && (
          <span className="absolute left-2 top-2 rounded bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
            Vendido
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div>
          <h3 className="font-condensed text-base font-bold leading-tight text-car-white">{tarjeta.titulo}</h3>
          <p className="mt-0.5 text-xs text-car-white/60">{tarjeta.subtitulo}</p>
        </div>
        {botones.length > 0 && (
          <div className="mt-auto flex flex-col gap-1.5">
            {botones.map(({ titulo, enlace }, i) => {
              const clase = `${BOTON} ${ESTILO_BOTON[enlace.tipo]}`;
              const etiqueta = etiquetaBoton(titulo, enlace);
              if (enlace.tipo === "interno") {
                return (
                  <Link key={i} href={enlace.href} className={clase}>
                    {etiqueta}
                  </Link>
                );
              }
              return (
                <a
                  key={i}
                  href={enlace.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-vehiculo={tarjeta.slug ?? undefined}
                  className={clase}
                >
                  {enlace.tipo === "whatsapp" && <WaIcono />}
                  {etiqueta}
                </a>
              );
            })}
          </div>
        )}
      </div>
    </article>
  );
}

export function BurbujaChat({ burbuja }: { burbuja: Burbuja }) {
  const { mensaje } = burbuja;

  if (burbuja.de === "cliente") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[80%] whitespace-pre-line break-words rounded-2xl rounded-tr-sm bg-car-gold px-3.5 py-2 text-sm text-car-black">
          {mensaje.tipo === "texto" ? mensaje.texto : ""}
        </p>
      </div>
    );
  }

  if (mensaje.tipo === "tarjetas") {
    return (
      <DelAsistente>
        <div className="-mr-3 flex snap-x gap-2.5 overflow-x-auto pb-1 pr-3">
          {mensaje.tarjetas.map((t, i) => (
            <TarjetaAuto key={t.slug ?? i} tarjeta={t} />
          ))}
        </div>
      </DelAsistente>
    );
  }

  if (mensaje.tipo === "cierre") {
    const url = urlSegura(mensaje.url, "whatsapp");
    return (
      <DelAsistente>
        <div className={`${BURBUJA_ASISTENTE} max-w-[92%]`}>
          <p className="whitespace-pre-line break-words border-l-2 border-[#25D366] pl-2.5 italic text-car-white/90">
            {mensaje.texto}
          </p>
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              data-vehiculo={mensaje.vehiculoSlug ?? undefined}
              className={`${BOTON} mt-3 w-full bg-[#25D366] py-2.5 text-sm text-white hover:bg-[#1da851]`}
            >
              <WaIcono /> Enviar por WhatsApp
            </a>
          )}
        </div>
      </DelAsistente>
    );
  }

  return (
    <DelAsistente>
      <p className={`${BURBUJA_ASISTENTE} w-fit max-w-[92%] whitespace-pre-line break-words`}>{mensaje.texto}</p>
    </DelAsistente>
  );
}

export function Escribiendo() {
  return (
    <DelAsistente>
      <div className={`${BURBUJA_ASISTENTE} flex w-fit items-center gap-1 py-3`}>
        <span className="sr-only">El asistente está escribiendo</span>
        {[0, 150, 300].map((d) => (
          <span
            key={d}
            aria-hidden="true"
            className="size-1.5 animate-bounce rounded-full bg-car-white/60"
            style={{ animationDelay: `${d}ms` }}
          />
        ))}
      </div>
    </DelAsistente>
  );
}
