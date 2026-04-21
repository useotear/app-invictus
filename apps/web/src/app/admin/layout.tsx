import Link from "next/link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-invictus-bg">
      <header className="bg-invictus text-white">
        <div className="max-w-6xl mx-auto px-6 py-4 flex gap-6 items-center">
          <Link href="/admin" className="flex flex-col leading-tight">
            <span className="text-[10px] font-semibold tracking-[0.2em] text-invictus-accent uppercase">
              Invictus • Admin
            </span>
            <span className="font-bold text-lg">Painel</span>
          </Link>
          <nav className="flex gap-5 text-sm ml-4">
            <Link href="/admin" className="hover:text-invictus-accent transition">Projetos</Link>
            <Link href="/admin/clients" className="hover:text-invictus-accent transition">Clientes</Link>
          </nav>
          <div className="ml-auto w-10 h-10 rounded-full bg-invictus-accent" aria-hidden />
        </div>
      </header>
      <main className="flex-1 p-6 max-w-6xl mx-auto w-full">{children}</main>
    </div>
  );
}
