import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-invictus text-white">
      <div className="w-64 h-64 relative mb-8">
        <Image src="/Invictus-Logo-branca.png" alt="Invictus Soluções" fill priority className="object-contain drop-shadow-[0_0_60px_rgba(255,200,33,0.25)]" />
      </div>
      <p className="text-invictus-accent text-sm font-medium mb-12">A sua energia solar, acompanhada.</p>
      <div className="flex gap-2 mb-16">
        <span className="w-2 h-2 rounded-full bg-white/40" />
        <span className="w-2 h-2 rounded-full bg-invictus-accent" />
        <span className="w-2 h-2 rounded-full bg-white/40" />
      </div>
      <Link
        href="/admin"
        className="px-8 py-3 bg-invictus-accent text-invictus-deep font-bold rounded-xl shadow-lg hover:brightness-110 transition"
      >
        Acessar painel
      </Link>
      <p className="text-xs text-white/50 mt-8 text-center max-w-xs">
        Cliente: acesse o link recebido por WhatsApp para ver seu projeto.
      </p>
    </main>
  );
}
