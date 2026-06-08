import { CheckCircle2, Heart, LogIn } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabase';

type InvitePreview = {
  id: string;
  wedding_id: string;
  wedding_name: string;
  role: string;
  expires_at: string | null;
  used_at: string | null;
  is_revoked: boolean;
  status: string;
};

const roleLabels: Record<string, string> = {
  bride: 'Noiva',
  groom: 'Noivo',
  planner: 'Cerimonialista',
  viewer: 'Visualizador'
};

export default function InviteAccept() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    async function load() {
      setPageLoading(true);
      const { data, error } = await supabase.rpc('get_wedding_invite_public', { invite_token: token });
      if (error) setMessage(error.message);
      const row = Array.isArray(data) ? data[0] : data;
      setInvite(row ?? null);
      setPageLoading(false);
    }

    load().catch((error) => {
      setMessage(error.message);
      setPageLoading(false);
    });
  }, [token]);

  async function acceptInvite() {
    if (!user) {
      localStorage.setItem('post_login_redirect', `/convite/${token}`);
      navigate('/login');
      return;
    }

    setAccepting(true);
    setMessage('');
    const { data, error } = await supabase.rpc('accept_wedding_invite', { invite_token: token });
    setAccepting(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    if (data) localStorage.setItem('active_wedding_id', data as string);
    navigate('/membros');
  }

  if (loading || pageLoading) return <div className="flex min-h-screen items-center justify-center"><LoadingSpinner /></div>;

  const unavailable = !invite || invite.status !== 'active';

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-w-surface p-4">
      <section className="w-full max-w-xl rounded-3xl border border-[#E5E7EB] bg-white p-6 text-center shadow-float">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-w-rose text-white shadow-rose">
          <Heart size={24} className="fill-white" />
        </div>
        <h1 className="mt-5 text-2xl font-bold text-w-text">Você foi convidado para participar do planejamento do casamento.</h1>
        {invite && (
          <div className="mt-5 rounded-2xl bg-w-surface p-4 text-left">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-w-faint">Casamento</p>
            <p className="mt-1 text-lg font-bold">{invite.wedding_name}</p>
            <p className="mt-2 text-sm text-w-muted">Função: <strong>{roleLabels[invite.role] ?? invite.role}</strong></p>
          </div>
        )}
        {unavailable ? (
          <p className="mt-5 rounded-2xl bg-w-red-lt p-4 text-sm font-semibold text-[#EF4444]">
            {message || 'Este convite não está disponível ou já expirou.'}
          </p>
        ) : (
          <button className="btn-primary mt-5 w-full" onClick={acceptInvite} disabled={accepting}>
            {user ? <CheckCircle2 size={17} /> : <LogIn size={17} />}
            {accepting ? 'Aceitando...' : user ? 'Aceitar convite' : 'Entrar para aceitar convite'}
          </button>
        )}
        {message && !unavailable && <p className="mt-4 text-sm font-semibold text-[#EF4444]">{message}</p>}
      </section>
    </main>
  );
}
