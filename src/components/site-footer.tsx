import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-car-gold/15 bg-[#070709] px-5 py-8 text-center">
      <img
        src="/logo-posse.png"
        alt="Posse Automotores"
        className="mx-auto h-14 w-auto"
      />
      <p className="mt-2 text-sm text-car-muted">
        Justiniano Posse, Córdoba · {new Date().getFullYear()}
      </p>
      <Link href="/admin" className="mt-3 inline-block text-[#111318] hover:text-car-muted transition-colors select-none">·</Link>
    </footer>
  );
}
