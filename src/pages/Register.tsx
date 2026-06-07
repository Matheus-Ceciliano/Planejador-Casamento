import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '../layouts/AuthLayout';
import FormInput from '../components/FormInput';
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
      <div className="mx-auto max-w-md">
        <h1 className="text-3xl font-semibold text-event-text">Criar conta</h1>
        <p className="mt-2 text-sm text-stone-500">Cadastre-se para iniciar o planejamento.</p>
        {!configured && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">Supabase não configurado. Crie o arquivo .env com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY para liberar o cadastro.</p>}
        <form className="mt-8 space-y-4" onSubmit={submit}>
          <FormInput label="Nome" value={name} onChange={(event) => setName(event.target.value)} required />
          <FormInput label="E-mail" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          <FormInput label="Senha" type="password" minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} required />
          {message && <p className="text-sm text-stone-600">{message}</p>}
          <button className="btn-primary w-full" disabled={loading || !configured}>{loading ? 'Criando...' : 'Cadastrar'}</button>
        </form>
        <p className="mt-5 text-sm text-stone-500">
          Já tem conta? <Link className="font-medium text-event-text hover:underline" to="/login">Entrar</Link>
        </p>
      </div>
    </AuthLayout>
  );
}
