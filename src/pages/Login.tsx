import { Heart } from 'lucide-react';
import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../layouts/AuthLayout';
import FormInput from '../components/FormInput';
import { useAuth } from '../hooks/useAuth';

export default function Login() {
  const { signIn, resetPassword, configured } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      await signIn(email, password);
      navigate('/dashboard');
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function recover() {
    if (!email) {
      setMessage('Informe seu e-mail para recuperar a senha.');
      return;
    }
    await resetPassword(email);
    setMessage('Enviamos as instruções para seu e-mail.');
  }

  return (
    <AuthLayout>
      <div className="mx-auto max-w-md">
        <div className="mb-8 flex items-center gap-3 md:hidden">
          <Heart className="text-rosew-500" />
          <span className="font-semibold">Planejador de Casamento</span>
        </div>
        <h1 className="text-3xl font-semibold text-ink">Entrar</h1>
        <p className="mt-2 text-sm text-stone-500">Acesse o planejamento do casamento.</p>
        {!configured && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">Configure as variáveis do Supabase no arquivo .env.</p>}
        <form className="mt-8 space-y-4" onSubmit={submit}>
          <FormInput label="E-mail" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <FormInput label="Senha" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          {message && <p className="text-sm text-stone-600">{message}</p>}
          <button className="btn-primary w-full" disabled={loading || !configured}>{loading ? 'Entrando...' : 'Entrar'}</button>
        </form>
        <div className="mt-5 flex items-center justify-between text-sm">
          <button className="text-rosew-500 hover:underline" onClick={recover}>Recuperar senha</button>
          <Link className="font-medium text-ink hover:underline" to="/register">Criar conta</Link>
        </div>
      </div>
    </AuthLayout>
  );
}
