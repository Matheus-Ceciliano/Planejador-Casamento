import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../layouts/AuthLayout';
import AppInput from '../components/ui/AppInput';
import { Mail, User } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export default function Register() {
  const { signUp, configured } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      await signUp(name, email, password);
      setMessage('Conta criada. Se a confirmação por e-mail estiver ativa, confirme antes de entrar.');
      setTimeout(() => navigate('/login'), 1000);
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <div className="mx-auto max-w-md animate-slide-up">
        <h1 className="text-3xl font-extrabold tracking-tight text-w-text">Criar conta</h1>
        <p className="mt-2 text-sm text-w-muted">Cadastre-se para iniciar o planejamento do seu casamento.</p>

        {!configured && (
          <p className="mt-4 rounded-xl bg-w-red-lt p-3 text-sm font-medium text-[#DC2626]">
            Supabase não configurado. Crie o arquivo .env com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.
          </p>
        )}

        <form className="mt-8 space-y-4" onSubmit={submit}>
          <AppInput
            label="Nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            leftIcon={<User size={17} />}
            placeholder="Seu nome completo"
            required
          />
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
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 6 caracteres"
            hint="Use pelo menos 6 caracteres"
            required
          />
          {message && (
            <p className="rounded-xl bg-w-surface p-3 text-sm text-w-muted">{message}</p>
          )}
          <button
            className="btn-primary w-full py-3 text-base"
            disabled={loading || !configured}
          >
            {loading ? 'Criando...' : 'Cadastrar'}
          </button>
        </form>

        <p className="mt-5 text-sm text-w-muted">
          Já tem conta?{' '}
          <Link className="font-semibold text-w-text hover:text-w-rose" to="/login">
            Entrar →
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
