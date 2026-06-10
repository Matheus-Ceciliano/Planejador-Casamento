import {
  CalendarDays, ChevronDown, Files, Handshake,
  Home, LogOut, Menu, MoreHorizontal,
  Receipt, Settings, Table2, Users, WalletCards, X,
} from 'lucide-react';
import { ReactNode, useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatedPage } from '../components/Animated';
import ConfirmDialog from '../components/ConfirmDialog';
import InstallPWAButton from '../components/InstallPWAButton';
import { useAuth } from '../hooks/useAuth';
import { useWedding } from '../hooks/useWedding';
import { isAnyModalOpen } from '../utils/modalLayer';

const nav = [
  { to: '/dashboard',    label: 'Início',         icon: Home },
  { to: '/agenda',       label: 'Agenda',          icon: CalendarDays },
  { to: '/convidados',   label: 'Convidados',      icon: Users },
  { to: '/orcamento',    label: 'Orçamento',       icon: WalletCards },
  { to: '/historico-pagamentos', label: 'Pagamentos', icon: Receipt },
  { to: '/fornecedores', label: 'Fornecedores',    icon: Handshake },
  { to: '/mesas',        label: 'Mesas',           icon: Table2 },
  { to: '/arquivos',     label: 'Arquivos',        icon: Files },
  { to: '/membros',      label: 'Membros',         icon: Users },
  { to: '/configuracoes',label: 'Configurações',   icon: Settings },
];

const mobileNav = [
  { to: '/dashboard',   label: 'Início',     icon: Home },
  { to: '/convidados',  label: 'Convidados', icon: Users },
  { to: '/agenda',      label: 'Agenda',     icon: CalendarDays },
  { to: '/orcamento',   label: 'Orçamento',  icon: WalletCards },
];

const mobileMoreNav = [
  { to: '/membros',       label: 'Membros',       icon: Users },
  { to: '/fornecedores',  label: 'Fornecedores',  icon: Handshake },
  { to: '/historico-pagamentos', label: 'Pagamentos', icon: Receipt },
  { to: '/mesas',         label: 'Mesas',         icon: Table2 },
  { to: '/arquivos',      label: 'Arquivos',      icon: Files },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
];

/* ── Logo mark ────────────────────────────────────────────────────── */
function LogoMark() {
  return (
    <img className="h-9 w-9 rounded-xl shadow-rose" src="/logo-mark.png" alt="" aria-hidden="true" />
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
          <p className="text-sm font-bold tracking-tight text-w-text">OurDay</p>
          <p className="max-w-[132px] truncate text-[10px] font-medium text-w-faint">Grande dia em um só lugar</p>
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
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm leading-5 transition-all duration-150 ${
                isActive
                  ? 'bg-w-rose font-semibold text-white shadow-rose'
                  : 'font-medium text-w-muted hover:bg-w-surface hover:text-w-text'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className={`rounded-lg p-1 ${isActive ? 'bg-white/20' : ''}`}>
                  <Icon size={16} />
                </span>
                <span className="min-w-0 truncate">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {onSignOut && (
        <div className="border-t border-w-border p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
          <button
            type="button"
            className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-w-muted transition hover:bg-red-50 hover:text-[#DC2626]"
            onClick={onSignOut}
          >
            <span className="rounded-lg p-1 text-[#DC2626]">
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
  const [moreOpen, setMoreOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const { signOut, user } = useAuth();
  const { wedding, weddings, selectWedding } = useWedding();
  const location = useLocation();
  const navigate = useNavigate();
  const moreActive = mobileMoreNav.some((item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`));

  function requestSignOut() {
    setOpen(false);
    setMoreOpen(false);
    setConfirmingSignOut(true);
  }

  async function confirmSignOut() {
    if (signingOut) return;

    setSigningOut(true);
    try {
      await signOut();
      setConfirmingSignOut(false);
      navigate('/login', { replace: true });
    } finally {
      setSigningOut(false);
    }
  }

  useEffect(() => {
    const syncModalState = (event?: Event) => {
      const detail = (event as CustomEvent<{ isOpen: boolean }> | undefined)?.detail;
      setModalOpen(detail?.isOpen ?? isAnyModalOpen());
    };

    syncModalState();
    window.addEventListener('app:modal-state', syncModalState);
    return () => window.removeEventListener('app:modal-state', syncModalState);
  }, []);

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-[100dvh] overflow-x-hidden bg-w-surface">

      {/* ── Desktop Sidebar ── */}
      <div className={`fixed inset-y-0 left-0 z-50 hidden w-64 border-r border-w-border bg-white lg:block ${modalOpen ? 'hidden lg:hidden' : ''}`}>
        <Sidebar onSignOut={requestSignOut} />
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
              onSignOut={requestSignOut}
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
                {wedding?.name ?? 'OurDay'}
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
      {moreOpen && !modalOpen && (
        <div className="fixed inset-0 z-[55] lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/15 backdrop-blur-[1px]"
            aria-label="Fechar menu Mais"
            onClick={() => setMoreOpen(false)}
          />
          <div className="absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+4.9rem)] mx-auto max-w-md rounded-3xl border border-w-border bg-white p-3 shadow-[0_18px_60px_rgba(15,23,42,0.18)] animate-slide-up">
            <div className="mb-2 flex items-center justify-between px-1">
              <div>
                <p className="text-sm font-bold text-w-text">Mais opções</p>
                <p className="text-xs text-w-faint">Administração e organização</p>
              </div>
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-xl text-w-muted transition hover:bg-w-surface hover:text-w-text"
                aria-label="Fechar"
                onClick={() => setMoreOpen(false)}
              >
                <X size={17} />
              </button>
            </div>
            <div className="grid gap-1">
              {mobileMoreNav.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `flex min-h-12 items-center gap-3 rounded-2xl px-3 text-sm font-semibold transition-all duration-200 ${
                      isActive
                        ? 'bg-w-rose text-white shadow-rose'
                        : 'text-w-muted hover:bg-w-surface hover:text-w-text'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${isActive ? 'bg-white/20' : 'bg-w-surface text-w-muted'}`}>
                        <Icon size={18} />
                      </span>
                      <span className="min-w-0 truncate whitespace-nowrap">{label}</span>
                    </>
                  )}
                </NavLink>
              ))}
              <div className="mt-2 border-t border-w-border pt-2">
                <button
                  type="button"
                  className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 text-sm font-semibold text-w-muted transition hover:bg-red-50 hover:text-[#DC2626]"
                  onClick={requestSignOut}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50 text-[#DC2626]">
                    <LogOut size={18} />
                  </span>
                  <span className="min-w-0 truncate whitespace-nowrap">Sair da conta</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <nav className={`fixed inset-x-0 bottom-0 z-[60] border-t border-w-border/80 bg-white/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] pt-1.5 shadow-[0_-4px_24px_rgba(0,0,0,0.06)] backdrop-blur-xl lg:hidden ${modalOpen ? 'hidden' : ''}`}>
        <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
          {mobileNav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMoreOpen(false)}
              className={({ isActive }) =>
                `flex min-h-[50px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 text-[10px] font-bold tracking-normal transition-all duration-200 ${
                  isActive
                    ? 'bg-w-rose text-white shadow-rose'
                    : 'text-w-faint hover:bg-w-surface hover:text-w-muted'
                }`
              }
            >
              <Icon size={19} />
              <span className="max-w-full truncate whitespace-nowrap leading-none">{label}</span>
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen((value) => !value)}
            className={`flex min-h-[50px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 text-[10px] font-bold tracking-normal transition-all duration-200 ${
              moreActive || moreOpen
                ? 'bg-w-rose text-white shadow-rose'
                : 'text-w-faint hover:bg-w-surface hover:text-w-muted'
            }`}
            aria-expanded={moreOpen}
            aria-label="Abrir mais opções"
          >
            <MoreHorizontal size={20} />
            <span className="max-w-full truncate whitespace-nowrap leading-none">Mais</span>
          </button>
        </div>
      </nav>

      <ConfirmDialog
        open={confirmingSignOut}
        title="Sair da conta?"
        description="Tem certeza que deseja sair da sua conta?"
        confirmLabel="Sim, sair"
        variant="danger"
        loading={signingOut}
        onCancel={() => setConfirmingSignOut(false)}
        onConfirm={confirmSignOut}
      />
    </div>
  );
}
