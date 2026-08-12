"use client";
import Link from "next/link";
import { useState } from "react";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const links = [
    { href: "/#nosotros", label: "Nosotros" },
    { href: "/catalogo", label: "Vehículos" },
    { href: "/lavadero", label: "Lavadero" },
    { href: "/#porque", label: "Por qué elegirnos" },
    { href: "/#contacto", label: "Contacto" },
  ];
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-car-gold/20 bg-car-black/92 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
        <Link href="/" className="font-condensed text-xl font-black italic tracking-wide text-car-white">
          <span className="text-car-gold">POSSE</span> AUTOMOTORES
        </Link>
        <nav className="hidden items-center gap-7 md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-sm font-semibold uppercase tracking-wide text-car-white/80 transition hover:text-car-gold">
              {l.label}
            </Link>
          ))}
          <Link
            href={`https://wa.me/5493537662444?text=${encodeURIComponent("Hola, quiero consultar un vehículo")}`}
            target="_blank" rel="noopener"
            className="rounded bg-car-gold px-4 py-2 text-sm font-bold uppercase tracking-wide text-car-black transition hover:bg-car-gold-dark"
          >
            WhatsApp
          </Link>
        </nav>
        <button
          className="flex size-10 flex-col items-center justify-center gap-1.5 md:hidden"
          onClick={() => setOpen(!open)}
          aria-label="Menú"
        >
          <span className={`block h-0.5 w-6 bg-car-white transition-all ${open ? "translate-y-2 rotate-45" : ""}`} />
          <span className={`block h-0.5 w-6 bg-car-white transition-all ${open ? "opacity-0" : ""}`} />
          <span className={`block h-0.5 w-6 bg-car-white transition-all ${open ? "-translate-y-2 -rotate-45" : ""}`} />
        </button>
      </div>
      {open && (
        <div className="border-t border-car-gold/20 bg-car-black/98 px-5 py-4 md:hidden">
          {links.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)}
              className="block py-3 text-sm font-semibold uppercase tracking-wide text-car-white/80 hover:text-car-gold">
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
