import { Heart, Sparkles } from 'lucide-react';
import { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-w-surface px-4 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-3xl bg-w-card shadow-float md:grid-cols-[1fr_1.15fr]">

          {/* ── Hero panel ── */}
          <section
            className="relative hidden overflow-hidden md:flex md:flex-col md:justify-between p-10"
            style={{
              background: 'linear-gradient(135deg, #E11D48 0%, #C01640 60%, #9B1035 100%)',
            }}
          >
            {/* Decorative orbs */}
            <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-12 -left-12 h-48 w-48 rounded-full bg-white/8 blur-2xl" />

            {/* Brand */}
            <div className="relative flex items-center gap-3 text-base font-bold text-white">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
                <Heart size={18} className="fill-white text-white" />
              </span>
              Planejador de Casamento
            </div>

            {/* Headline */}
            <div className="relative">
              <div className="mb-4 flex items-center gap-2">
                <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white/90 backdrop-blur-sm">
                  <Sparkles size={11} />
                  Tudo em um só lugar
                </span>
              </div>
              <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-white">
                Um planejamento leve para um dia inesquecível.
              </h1>
              <p className="mt-4 text-sm leading-relaxed text-white/75">
                Organize convidados, famílias, convites, orçamento e fornecedores com elegância.
              </p>

              {/* Stats */}
              <div className="mt-8 flex gap-6">
                {[
                  { value: '100%', label: 'Gratuito' },
                  { value: '∞',   label: 'Convidados' },
                  { value: '0',   label: 'Estresse' },
                ].map(({ value, label }) => (
                  <div key={label}>
                    <p className="text-2xl font-bold text-white">{value}</p>
                    <p className="mt-0.5 text-xs font-medium text-white/60">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Form panel ── */}
          <section className="p-8 sm:p-12">
            {children}
          </section>
        </div>
      </div>
    </main>
  );
}
