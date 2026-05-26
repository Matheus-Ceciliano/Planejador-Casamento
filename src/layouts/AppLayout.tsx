import { ChevronDown, Files, Heart, Home, LogOut, Menu, Settings, Users, WalletCards, X, ListTodo, Clock3, Handshake, Armchair, Tags } from 'lucide-react';
import { ReactNode, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useWedding } from '../hooks/useWedding';

const nav = [
  { to: '/dashboard', label: 'Dashboard', icon: Home },
  { to: '/convidados', label: 'Convidados', icon: Users },
  { to: '/familias', label: 'Famílias', icon: Heart },
  { to: '/mesas', label: 'Mesas', icon: Armchair },
  { to: '/orcamento', label: 'Financeiro', icon: WalletCards },
  { to: '/categorias', label: 'Categorias', icon: Tags },
  { to: '/fornecedores', label: 'Fornecedores', icon: Handshake },
  { to: '/tarefas', label: 'Tarefas', icon: ListTodo },
  { to: '/cronograma', label: 'Cronograma', icon: Clock3 },
  { to: '/arquivos', label: 'Arquivos', icon: Files },
  { to: '/configuracoes', label: 'Configurações', icon: Settings }
];

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <aside className="flex h-full flex-col bg-white">
      <div className="flex h-16 items-center gap-3 border-b border-rosew-100 px-5">
        <span className="rounded-lg bg-rosew-100 p-2 text-rosew-500">
          <Heart size={20} />
        </span>
        <span className="font-semibold text-ink">Planejador</span>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {nav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-ink text-white' : 'text-stone-600 hover:bg-rosew-50'}`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

export default function AppLayout({ children }: { children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { signOut, user } = useAuth();
  const { wedding, weddings, selectWedding } = useWedding();

  return (
    <div className="min-h-screen bg-rosew-50">
      <div className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-rosew-100 lg:block">
        <Sidebar />
      </div>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button className="absolute inset-0 bg-stone-950/30" onClick={() => setOpen(false)} aria-label="Fechar menu" />
          <div className="relative h-full w-72 max-w-[80vw] border-r border-rosew-100">
            <button className="absolute right-3 top-3 z-10 rounded-lg p-2 hover:bg-rosew-50" onClick={() => setOpen(false)} aria-label="Fechar">
              <X size={20} />
            </button>
            <Sidebar onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-rosew-100 bg-white/85 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <button className="rounded-lg p-2 hover:bg-rosew-50 lg:hidden" onClick={() => setOpen(true)} aria-label="Abrir menu">
              <Menu size={22} />
            </button>
            <div>
              <p className="text-sm font-semibold text-ink">{wedding?.name ?? 'Planejador de Casamento'}</p>
              <p className="text-xs text-stone-500">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {weddings.length > 1 && (
              <label className="relative hidden sm:block">
                <select className="input appearance-none pr-9" value={wedding?.id ?? ''} onChange={(event) => selectWedding(event.target.value)}>
                  {weddings.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-2.5 text-stone-400" size={16} />
              </label>
            )}
            <button className="btn-secondary px-3" onClick={signOut} aria-label="Sair">
              <LogOut size={18} />
            </button>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  );
}


