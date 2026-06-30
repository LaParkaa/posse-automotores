import Link from "next/link";
import { Car, LayoutDashboard, LogOut } from "lucide-react";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/vehiculos", label: "Vehículos", icon: Car },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-car-gray">
      <aside className="w-56 shrink-0 border-r border-white/10 bg-car-black">
        <div className="px-5 py-5">
          <p className="font-condensed text-base font-black italic text-car-white">
            <span className="text-car-gold">POSSE</span> ADMIN
          </p>
        </div>
        <nav className="px-3">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}
              className="flex items-center gap-3 rounded px-3 py-2.5 text-sm font-medium text-car-white/70 transition hover:bg-white/5 hover:text-car-gold">
              <Icon size={18} /> {label}
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-5 left-0 w-56 px-3">
          <form action="/api/auth/signout" method="post">
            <button type="submit" className="flex w-full items-center gap-3 rounded px-3 py-2.5 text-sm font-medium text-car-white/50 transition hover:text-car-white">
              <LogOut size={18} /> Cerrar sesión
            </button>
          </form>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  );
}
