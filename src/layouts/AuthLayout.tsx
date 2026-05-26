import { Heart } from 'lucide-react';
import { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#fdecea,transparent_34%),linear-gradient(135deg,#fff8f7,#f5ead8)] px-4 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-lg bg-white/80 shadow-soft md:grid-cols-[1fr_1.1fr]">
          <section className="hidden bg-ink p-10 text-white md:flex md:flex-col md:justify-between">
            <div className="flex items-center gap-3 text-lg font-semibold">
              <span className="rounded-lg bg-white/10 p-2">
                <Heart size={22} />
              </span>
              Planejador de Casamento
            </div>
            <div>
              <h1 className="text-4xl font-semibold leading-tight">Um planejamento leve para um dia inesquecível.</h1>
              <p className="mt-4 text-sm leading-6 text-white/75">Organize convidados, famílias, mesas, orçamento e fornecedores em um só lugar.</p>
            </div>
          </section>
          <section className="p-6 sm:p-10">{children}</section>
        </div>
      </div>
    </main>
  );
}
