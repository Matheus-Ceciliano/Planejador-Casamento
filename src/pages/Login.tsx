import { Mail } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../layouts/AuthLayout';
import AppInput from '../components/ui/AppInput';
import { useAuth } from '../hooks/useAuth';

export default function Login() {
  const { signIn, resetPassword, configured } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage]   = useState('');
  const [loading, setLoading]   = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      await signIn(email, password);
      const redirect = localStorage.getItem('post_login_redirect');
      if (redirect) localStorage.removeItem('post_login_redirect');
      navigate(redirect || '/dashboard');
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function recover() {
    if (!email) { setMessage('Informe seu e-mail para recuperar a senha.'); return; }
    await resetPassword(email);
    setMessage('Enviamos as instruções para seu e-mail.');
  }

  return (
    <AuthLayout>
      <div className="mx-auto max-w-sm animate-slide-up">

        {/* Mobile brand */}
        <div className="mb-8 flex items-center gap-2.5 md:hidden">
          <img className="h-9 w-9 rounded-xl shadow-rose" src="/logo-mark.png" alt="" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-bold leading-4 text-w-text">OurDay</p>
            <p className="truncate text-[11px] font-medium text-w-muted">Planeje o grande dia em um só lugar.</p>
          </div>
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight text-w-text">Bem-vindo</h1>
        <p className="mt-1.5 text-sm text-w-muted">
          Entre para acessar o planejamento do seu casamento.
        </p>

        {!configured && (
          <p className="mt-4 rounded-xl bg-w-red-lt p-3 text-sm font-medium text-[#DC2626]">
            Configure as variáveis do Supabase no arquivo .env.
          </p>
        )}

        <form className="mt-8 space-y-4" onSubmit={submit}>
          <AppInput
            label="E-mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            leftIcon={<Mail size={17} />}
            placeholder="seu@email.com"
            required
          />
          <AppInput
            label="Senha"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
          {message && (
            <p className="rounded-xl bg-w-surface p-3 text-sm text-w-muted">{message}</p>
          )}
          <button className="btn-primary w-full py-3 text-base" disabled={loading || !configured}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <div className="mt-5 flex items-center justify-between text-sm">
          <button className="font-medium text-w-rose hover:underline" onClick={recover}>
            Recuperar senha
          </button>
          <Link className="font-semibold text-w-text hover:text-w-rose" to="/register">
            Criar conta →
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}
