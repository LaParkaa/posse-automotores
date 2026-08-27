"use client";
import { useState } from "react";
import Link from "next/link";
import { Car, LayoutDashboard, LogOut, Users, Menu, X } from "lucide-react";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/vehiculos", label: "Vehículos", icon: Car },
  { href: "/admin/leads", label: "Leads (Bot)", icon: Users },
];

function Sidebar({ onClose }: { onClose?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-car-black">
      <div className="flex items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2">
          <img src="/logo-posse.png" alt="Posse Automotores" className="h-8 w-auto" />
          <span className="font-condensed text-base font-black italic text-car-gold">ADMIN</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-car-muted hover:text-car-white lg:hidden">
            <X size={20} />
          </button>
        )}
      </div>
      <nav className="flex-1 px-3">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            onClick={onClose}
            className="flex items-center gap-3 rounded px-3 py-2.5 text-sm font-medium text-car-white/70 transition hover:bg-white/5 hover:text-car-gold"
          >
            <Icon size={18} /> {label}
          </Link>
        ))}
      </nav>
      <div className="px-3 pb-5">
        <form action="/api/auth/signout" method="post">
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded px-3 py-2.5 text-sm font-medium text-car-white/50 transition hover:text-car-white"
          >
            <LogOut size={18} /> Cerrar sesión
          </button>
        </form>
      </div>
    </div>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-car-gray">
      {/* Sidebar desktop */}
      <aside className="hidden w-56 shrink-0 border-r border-white/10 lg:block">
        <div className="sticky top-0 h-screen">
          <Sidebar />
        </div>
      </aside>

      {/* Drawer mobile */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 border-r border-white/10">
            <Sidebar onClose={() => setOpen(false)} />
          </aside>
        </div>
      )}

      {/* Contenido */}
      <div className="flex flex-1 flex-col">
        {/* Header mobile */}
        <header className="flex items-center gap-3 border-b border-white/10 bg-car-black px-4 py-3 lg:hidden">
          <button onClick={() => setOpen(true)} className="text-car-white/70 hover:text-car-white">
            <Menu size={22} />
          </button>
          <img src="/logo-posse.png" alt="Posse Automotores" className="h-7 w-auto" />
          <span className="font-condensed text-base font-black italic text-car-gold">ADMIN</span>
        </header>

        <main className="flex-1 overflow-auto p-4 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
