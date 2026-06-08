import {
  CalendarDays, ChevronDown, Clock3, Files, Handshake,
  Heart, Home, LogOut, Menu,
  Send, Settings, Users, WalletCards, X,
} from 'lucide-react';
import { ReactNode, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { AnimatedPage } from '../components/Animated';
import InstallPWAButton from '../components/InstallPWAButton';
import { useAuth } from '../hooks/useAuth';
import { useWedding } from '../hooks/useWedding';
import { isAnyModalOpen } from '../utils/modalLayer';

const nav = [
  { to: '/dashboard',    label: 'Início',         icon: Home },
  { to: '/agenda',       label: 'Agenda',          icon: CalendarDays },
  { to: '/convidados',   label: 'Convidados',      icon: Users },
  { to: '/orcamento',    label: 'Orçamento',       icon: WalletCards },
  { to: '/fornecedores', label: 'Fornecedores',    icon: Handshake },
  { to: '/cronograma',   label: 'Cronograma',      icon: Clock3 },
  { to: '/arquivos',     label: 'Arquivos',        icon: Files },
  { to: '/membros',      label: 'Membros',         icon: Users },
  { to: '/configuracoes',label: 'Configurações',   icon: Settings },
];

const mobileNav = [
  { to: '/dashboard',   label: 'Início',     icon: Home },
  { to: '/convidados',  label: 'Convidados', icon: Users },
  { to: '/agenda',      label: 'Agenda',     icon: Send },
  { to: '/membros',     label: 'Membros',    icon: Users },
  { to: '/orcamento',   label: 'Orçamento',  icon: WalletCards },
];

/* ── Logo mark ────────────────────────────────────────────────────── */
function LogoMark() {
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-w-rose shadow-rose">
      <Heart size={15} className="fill-white text-white" />
    </div>
  );
}

/* ── Sidebar ──────────────────────────────────────────────────────── */
function Sidebar({ onNavigate, onSignOut }: { onNavigate?: () => void; onSignOut?: () => void }) {
  return (
    <aside className="flex h-full flex-col bg-white">
      {/* Brand */}
      <div className="flex h-16 items-center gap-3 border-b border-w-border px-5">
        <LogoMark />
        <div className="min-w-0">
          <p className="text-sm font-bold tracking-tight text-w-text">Casamento</p>
          <p className="text-[10px] font-medium text-w-faint">Planejador</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        <p className="mb-1 px-3 pt-1 text-[10px] font-bold uppercase tracking-widest text-w-faint">
          Menu
        </p>
        {nav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-w-rose text-white shadow-rose'
                  : 'text-w-muted hover:bg-w-surface hover:text-w-text'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className={`rounded-lg p-1 ${isActive ? 'bg-white/20' : ''}`}>
                  <Icon size={16} />
                </span>
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {onSignOut && (
        <div className="border-t border-w-border p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
          <button
            type="button"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-w-muted transition hover:bg-w-surface hover:text-w-text"
            onClick={onSignOut}
          >
            <span className="rounded-lg p-1">
              <LogOut size={16} />
            </span>
            Sair da conta
          </button>
        </div>
      )}
    </aside>
  );
}

/* ── Main Layout ──────────────────────────────────────────────────── */
export default function AppLayout({ children }: { children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const { signOut, user } = useAuth();
  const { wedding, weddings, selectWedding } = useWedding();
  const location = useLocation();

  useEffect(() => {
    const syncModalState = (event?: Event) => {
      const detail = (event as CustomEvent<{ isOpen: boolean }> | undefined)?.detail;
      setModalOpen(detail?.isOpen ?? isAnyModalOpen());
    };

    syncModalState();
    window.addEventListener('app:modal-state', syncModalState);
    return () => window.removeEventListener('app:modal-state', syncModalState);
  }, []);

  return (
    <div className="min-h-[100dvh] overflow-x-hidden bg-w-surface">

      {/* ── Desktop Sidebar ── */}
      <div className={`fixed inset-y-0 left-0 z-50 hidden w-64 border-r border-w-border bg-white lg:block ${modalOpen ? 'hidden lg:hidden' : ''}`}>
        <Sidebar />
      </div>

      {/* ── Mobile Drawer ── */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden animate-fade-in">
          <button
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
          />
          <div className="relative h-full w-72 max-w-[82vw] border-r border-w-border bg-white shadow-float animate-slide-right">
            <button
              className="absolute right-3 top-3 z-10 rounded-xl p-2 text-w-muted transition hover:bg-w-surface"
              onClick={() => setOpen(false)}
              aria-label="Fechar"
            >
              <X size={18} />
            </button>
            <Sidebar
              onNavigate={() => setOpen(false)}
              onSignOut={() => {
                setOpen(false);
                signOut();
              }}
            />
          </div>
        </div>
      )}

      {/* ── Content area ── */}
      <div className="lg:pl-64">

        {/* ── Header ── */}
        <header className={`app-header-safe sticky top-0 z-40 min-h-16 items-center justify-between border-b border-w-border/70 bg-white/90 px-4 shadow-soft backdrop-blur-xl sm:px-6 ${modalOpen ? 'hidden' : 'flex'}`}>
          <div className="flex min-w-0 items-center gap-3">
            {/* Mobile menu button */}
            <button
              className="rounded-xl p-2 text-w-muted transition hover:bg-w-surface lg:hidden"
              onClick={() => setOpen(true)}
              aria-label="Abrir menu"
            >
              <Menu size={20} />
            </button>

            {/* Event info */}
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-w-text">
                {wedding?.name ?? 'Planejador de Casamento'}
              </p>
              <p className="truncate text-xs text-w-faint">{user?.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <InstallPWAButton />

            {/* Wedding selector */}
            {weddings.length > 1 && (
              <label className="relative hidden sm:block">
                <select
                  className="input appearance-none pr-9 py-1.5 text-xs"
                  value={wedding?.id ?? ''}
                  onChange={(event) => selectWedding(event.target.value)}
                >
                  {weddings.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-2.5 text-w-faint" size={14} />
              </label>
            )}

            {/* Sign out */}
            <button
              className="btn-secondary hidden px-3 py-2 sm:inline-flex"
              onClick={signOut}
              aria-label="Sair"
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>

        {/* ── Page content ── */}
        <main className="pwa-main-safe mx-auto max-w-7xl animate-fade-in px-3 pt-5 sm:px-6 sm:pt-6 lg:pb-8">
          <AnimatedPage key={location.pathname}>
            {children ?? <Outlet />}
          </AnimatedPage>
        </main>
      </div>

      {/* ── Mobile Bottom Nav ── */}
      <nav className={`fixed inset-x-0 bottom-0 z-[60] border-t border-w-border/80 bg-white/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] pt-2 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] backdrop-blur-xl lg:hidden ${modalOpen ? 'hidden' : ''}`}>
        <div className="mx-auto grid max-w-md grid-cols-5 gap-0.5">
          {mobileNav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex min-h-[52px] min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-0.5 text-[8px] font-bold uppercase tracking-normal transition-all duration-150 min-[390px]:px-1 min-[390px]:text-[9px] ${
                  isActive
                    ? 'bg-w-rose text-white shadow-rose'
                    : 'text-w-faint hover:bg-w-surface hover:text-w-muted'
                }`
              }
            >
              <Icon size={20} />
              <span className="max-w-full truncate leading-none">{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
