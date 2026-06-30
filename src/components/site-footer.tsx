import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-car-gold/15 bg-[#070709] px-5 py-8 text-center">
      <p className="font-condensed text-xl font-black italic text-car-white">
        <span className="text-car-gold">POSSE</span> AUTOMOTORES
      </p>
      <p className="mt-2 text-sm text-car-muted">
        Justiniano Posse, Córdoba · {new Date().getFullYear()}
      </p>
      <p className="mt-1 text-xs text-car-muted">
        <Link href="/admin" className="hover:text-car-gold">Admin</Link>
      </p>
    </footer>
  );
}
