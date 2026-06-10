import {
  CalendarClock,
  CheckCircle2,
  Copy,
  Heart,
  Link2,
  Mail,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Send,
  ShieldCheck,
  Trash2,
  UserCog,
  Users,
  XCircle
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';
import FormSelect from '../components/FormSelect';
import Modal from '../components/Modal';
import { useAuth } from '../hooks/useAuth';
import { useWedding } from '../hooks/useWedding';
import { useWeddingTable } from '../hooks/useWeddingTable';
import { supabase } from '../lib/supabase';
import { MemberRole, WeddingInvite, WeddingMember } from '../types';

const roleLabels: Record<string, string> = {
  owner: 'Proprietario',
  bride: 'Noiva',
  groom: 'Noivo',
  planner: 'Cerimonialista',
  viewer: 'Visualizador',
  noiva: 'Noiva',
  noivo: 'Noivo',
  cerimonialista: 'Cerimonialista'
};

const roleOptions = [
  { label: 'Noiva', value: 'bride' },
  { label: 'Noivo', value: 'groom' },
  { label: 'Cerimonialista', value: 'planner' },
  { label: 'Visualizador', value: 'viewer' }
];

const permissionItems = [
  { key: 'budget_view', label: 'Pode visualizar orcamento' },
  { key: 'budget', label: 'Pode editar orcamento' },
  { key: 'guests', label: 'Pode gerenciar convidados' },
  { key: 'vendors', label: 'Pode gerenciar fornecedores' },
  { key: 'timeline', label: 'Pode gerenciar tarefas' },
  { key: 'settings', label: 'Pode convidar outros membros' }
];

const fullPermissions = Object.fromEntries(permissionItems.map((item) => [item.key, true]));
const readOnlyPermissions = { budget_view: true, budget: false, guests: false, vendors: false, timeline: false, settings: false };

const defaultPermissions: Record<string, Record<string, boolean>> = {
  owner: fullPermissions,
  bride: fullPermissions,
  groom: fullPermissions,
  planner: { budget_view: true, budget: false, guests: true, vendors: true, timeline: true, settings: false },
  viewer: readOnlyPermissions,
  noiva: fullPermissions,
  noivo: fullPermissions,
  cerimonialista: { budget_view: true, budget: false, guests: true, vendors: true, timeline: true, settings: false }
};

function roleTheme(role: string) {
  const normalized = role === 'noiva' ? 'bride' : role === 'noivo' ? 'groom' : role === 'cerimonialista' ? 'planner' : role;
  if (normalized === 'owner' || normalized === 'bride') return 'bg-w-rose-lt text-w-rose ring-w-rose-md';
  if (normalized === 'groom') return 'bg-[#EFF6FF] text-[#2563EB] ring-[#DBEAFE]';
  if (normalized === 'planner') return 'bg-w-green-lt text-[#16A34A] ring-[#DCFCE7]';
  return 'bg-w-surface text-w-muted ring-w-border';
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'M';
}

function formatDate(value?: string | null) {
  if (!value) return 'Hoje';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(value));
}

function formatActivityTime(value?: string | null) {
  if (!value) return 'Hoje';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function inviteStatus(invite: WeddingInvite) {
  if (invite.is_revoked) return 'Cancelado';
  if (invite.used_at) return 'Aceito';
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) return 'Expirado';
  return 'Pendente';
}

type SummaryCardProps = {
  label: string;
  value: number;
  icon: typeof Heart;
  accent: string;
  iconTone: string;
  valueTone: string;
  bar: string;
  helper: string;
};

function SummaryCard({ label, value, icon: Icon, accent, iconTone, valueTone, bar, helper }: SummaryCardProps) {
  return (
    <article className={`relative min-h-[104px] w-full max-w-full overflow-hidden rounded-2xl border p-3 shadow-[0_12px_28px_rgba(15,23,42,0.06)] transition hover:-translate-y-0.5 hover:shadow-card sm:min-h-[116px] sm:p-4 ${accent}`}>
      <span className={`absolute inset-x-0 top-0 h-1 ${bar}`} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-w-faint sm:text-[11px]">{label}</p>
          <p className={`mt-1 text-[1.65rem] font-extrabold leading-none tracking-tight sm:text-3xl ${valueTone}`}>{value}</p>
        </div>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ring-1 ${iconTone}`}>
          <Icon size={16} />
        </span>
      </div>
      <p className="mt-2 truncate text-[11px] font-semibold text-w-muted sm:text-xs">{helper}</p>
    </article>
  );
}

type MemberCardProps = {
  member: WeddingMember;
  canManage: boolean;
  isCurrentUser: boolean;
  actionOpen: string;
  onToggleActions: (id: string) => void;
  onEdit: (member: WeddingMember) => void;
  onRemove: (member: WeddingMember) => void;
};

function MemberCard({ member, canManage, isCurrentUser, actionOpen, onToggleActions, onEdit, onRemove }: MemberCardProps) {
  const removable = canManage && member.role !== 'owner' && !isCurrentUser;
  const isOpen = actionOpen === member.id;

  return (
    <article
      className={`relative w-full max-w-full overflow-visible rounded-2xl border border-w-border bg-white p-2.5 shadow-soft transition hover:border-w-border-md hover:shadow-card sm:p-4 ${isOpen ? 'z-40' : 'z-0'}`}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex min-w-0 items-start gap-2.5 sm:gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-w-rose-lt to-white text-xs font-extrabold text-w-rose ring-1 ring-w-rose-md sm:h-11 sm:w-11 sm:rounded-2xl sm:text-sm">
          {initials(member.name)}
        </span>

        <div className="min-w-0 flex-1 overflow-hidden pr-9">
          <div className="flex min-w-0 items-center gap-2">
            <h3 className="min-w-0 flex-1 truncate overflow-hidden text-sm font-extrabold leading-5 text-w-text sm:text-base">{member.name}</h3>
            {isCurrentUser && <span className="shrink-0 rounded-full bg-w-surface px-2 py-0.5 text-[10px] font-bold uppercase text-w-faint">Voce</span>}
          </div>
          <p className="mt-0.5 min-w-0 truncate overflow-hidden text-xs font-medium leading-4 text-w-muted">{member.email}</p>
          <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] font-semibold text-w-faint sm:mt-2 sm:gap-x-3">
            <span className="inline-flex min-w-0 items-center gap-1">
              <CalendarClock size={12} /> Ultimo acesso: Hoje
            </span>
            <span className="inline-flex min-w-0 items-center gap-1 text-w-green">
              <CheckCircle2 size={12} /> Ativo
            </span>
          </div>
          <span className={`mt-2 inline-flex max-w-full truncate rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ${roleTheme(member.role)}`}>
            {roleLabels[member.role] ?? member.role}
          </span>
        </div>

        <div className="absolute right-2.5 top-2.5 flex shrink-0 items-center gap-2">
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-w-muted transition hover:bg-w-surface hover:text-w-text"
            onClick={(event) => {
              event.stopPropagation();
              onToggleActions(isOpen ? '' : member.id);
            }}
            aria-label="Acoes do membro"
            aria-expanded={isOpen}
          >
            <MoreHorizontal size={18} />
          </button>
        </div>
      </div>

      {isOpen && (
        <div
          className="absolute right-2 top-12 z-50 w-[min(14rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-w-border bg-white shadow-float animate-scale-in sm:right-3 sm:w-56"
          onClick={(event) => event.stopPropagation()}
        >
          <button type="button" className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold text-w-text hover:bg-w-surface" onClick={() => onEdit(member)}>
            <ShieldCheck size={15} /> Editar permissoes
          </button>
          <button type="button" className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold text-w-text hover:bg-w-surface" onClick={() => onEdit(member)}>
            <UserCog size={15} /> Alterar funcao
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 border-t border-w-border px-3 py-2.5 text-left text-sm font-semibold text-w-red hover:bg-w-red-lt disabled:cursor-not-allowed disabled:opacity-40"
            disabled={!removable}
            onClick={() => removable && onRemove(member)}
          >
            <Trash2 size={15} /> Remover membro
          </button>
        </div>
      )}
    </article>
  );
}

type InviteCardProps = {
  invite: WeddingInvite;
  copiedId: string;
  onCopy: (invite: WeddingInvite) => void;
  onResend: (invite: WeddingInvite) => void;
  onCancel: (invite: WeddingInvite) => void;
};

function InviteCard({ invite, copiedId, onCopy, onResend, onCancel }: InviteCardProps) {
  const status = inviteStatus(invite);
  return (
    <article className="w-full max-w-full rounded-2xl border border-w-border bg-white p-3 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-extrabold leading-5 text-w-text">Convite para {roleLabels[invite.role] ?? invite.role}</p>
          <p className="mt-1 truncate text-xs font-semibold text-w-faint">Validade: {formatDate(invite.expires_at)}</p>
        </div>
        <span className="shrink-0 rounded-full bg-w-gold-lt px-2 py-1 text-[10px] font-extrabold uppercase text-w-gold">{status}</span>
      </div>
      <div className="mt-3 grid gap-2">
        <button type="button" className="btn-primary min-h-9 w-full rounded-xl py-1.5 text-xs shadow-none" onClick={() => onCopy(invite)}>
          <Copy size={14} /> {copiedId === invite.id ? 'Link copiado' : 'Copiar link'}
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="btn-secondary min-h-9 px-2 py-1.5 text-xs" onClick={() => onResend(invite)}>
            <Send size={13} /> Reenviar
          </button>
          <button type="button" className="btn-secondary min-h-9 px-2 py-1.5 text-xs text-w-red" onClick={() => onCancel(invite)}>
            <XCircle size={13} /> Cancelar
          </button>
        </div>
      </div>
    </article>
  );
}

export default function Members() {
  const { user } = useAuth();
  const { wedding } = useWedding();
  const members = useWeddingTable<WeddingMember>('wedding_members', 'name');
  const invites = useWeddingTable<WeddingInvite>('wedding_invites', 'created_at');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [permissionOpen, setPermissionOpen] = useState<WeddingMember | null>(null);
  const [confirmingPermissions, setConfirmingPermissions] = useState(false);
  const [removing, setRemoving] = useState<WeddingMember | null>(null);
  const [cancelingInvite, setCancelingInvite] = useState<WeddingInvite | null>(null);
  const [copiedId, setCopiedId] = useState('');
  const [message, setMessage] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [actionOpen, setActionOpen] = useState('');
  const [inviteForm, setInviteForm] = useState({
    name: '',
    email: '',
    role: 'bride',
    ttlDays: 7
  });
  const [invitePermissions, setInvitePermissions] = useState<Record<string, boolean>>(defaultPermissions.bride);
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});

  useEffect(() => {
    function closeActions() {
      setActionOpen('');
    }

    window.addEventListener('click', closeActions);
    return () => window.removeEventListener('click', closeActions);
  }, []);

  const currentMember = members.rows.find((member) => member.user_id === user?.id);
  const canManage = ['owner', 'bride', 'groom', 'noivo', 'noiva'].includes(currentMember?.role ?? '');
  const pendingInvites = invites.rows.filter((invite) => inviteStatus(invite) === 'Pendente');
  const brides = members.rows.filter((member) => ['bride', 'noiva'].includes(member.role)).length;
  const grooms = members.rows.filter((member) => ['groom', 'noivo'].includes(member.role)).length;
  const planners = members.rows.filter((member) => ['planner', 'cerimonialista'].includes(member.role)).length;
  const viewers = members.rows.filter((member) => member.role === 'viewer').length;

  const activities = useMemo(() => {
    const recentMembers = members.rows.slice(0, 3).map((member) => ({
      id: `member-${member.id}`,
      text: `${member.name} entrou no planejamento`,
      time: formatActivityTime(member.created_at)
    }));
    const recentInvites = pendingInvites.slice(0, 2).map((invite) => ({
      id: `invite-${invite.id}`,
      text: `Convite pendente para ${roleLabels[invite.role] ?? invite.role}`,
      time: `Expira em ${formatDate(invite.expires_at)}`
    }));
    return [...recentMembers, ...recentInvites].slice(0, 5);
  }, [members.rows, pendingInvites]);

  function inviteLink(token: string) {
    return `${window.location.origin}/convite/${token}`;
  }

  function openInviteModal() {
    setMessage('');
    setInviteError('');
    setInviteOpen(true);
  }

  function closeInviteModal() {
    if (inviteSubmitting) return;
    setInviteError('');
    setInviteOpen(false);
  }

  async function submitInvite(event: FormEvent) {
    event.preventDefault();
    if (!wedding) return;
    setMessage('');
    setInviteError('');
    setInviteSubmitting(true);

    try {
      const { error } = await supabase.rpc('create_wedding_invite', {
        target_wedding_id: wedding.id,
        invite_role: inviteForm.role,
        ttl_days: inviteForm.ttlDays
      });

      if (error) {
        const needsMigration = ['PGRST202', 'PGRST205'].includes(error.code ?? '') || error.message.includes('schema cache');
        setInviteError(needsMigration ? 'A estrutura de convites ainda nao foi aplicada no Supabase. Execute supabase/member-roles-permissions.sql e recarregue o schema cache.' : error.message);
        return;
      }

      setInviteOpen(false);
      setInviteForm({ name: '', email: '', role: 'bride', ttlDays: 7 });
      setInvitePermissions(defaultPermissions.bride);
      setMessage('Convite gerado. Copie o link em Convites pendentes.');
      await invites.refresh();
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : 'Nao foi possivel gerar o convite agora.');
    } finally {
      setInviteSubmitting(false);
    }
  }

  function openPermissions(member: WeddingMember) {
    setActionOpen('');
    setPermissionOpen(member);
    setPermissions({ ...(defaultPermissions[member.role] ?? defaultPermissions.viewer), ...(member.permissions ?? {}) });
  }

  async function confirmSavePermissions() {
    if (!permissionOpen) return;
    const { error } = await supabase
      .from('wedding_members')
      .update({ role: permissionOpen.role, permissions })
      .eq('id', permissionOpen.id);
    if (error) {
      setMessage(error.message);
      return;
    }
    setConfirmingPermissions(false);
    setPermissionOpen(null);
    setMessage('Permissoes atualizadas.');
    await members.refresh();
  }

  async function removeMember(member: WeddingMember) {
    if (member.role === 'owner' || member.user_id === user?.id) return;
    await members.remove(member.id);
    setRemoving(null);
    setMessage('Membro removido.');
  }

  async function copyInvite(invite: WeddingInvite) {
    await navigator.clipboard.writeText(inviteLink(invite.token));
    setCopiedId(invite.id);
    setTimeout(() => setCopiedId(''), 1600);
  }

  async function resendInvite(invite: WeddingInvite) {
    await copyInvite(invite);
    setMessage('Link copiado para reenviar o convite.');
  }

  async function confirmCancelInvite() {
    if (!cancelingInvite) return;
    const { error } = await supabase.rpc('revoke_wedding_invite', { invite_id: cancelingInvite.id });
    if (error) {
      setMessage(error.message);
      return;
    }
    setCancelingInvite(null);
    setMessage('Convite cancelado.');
    await invites.refresh();
  }

  return (
    <div className="max-w-full space-y-4 overflow-x-hidden pb-3 text-w-text sm:space-y-5 lg:pb-0" onClick={() => setActionOpen('')}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="page-title">Membros</h1>
          <p className="mt-1 text-[15px] font-normal leading-[22px] text-w-muted sm:text-base sm:leading-6">Gerencie quem pode acessar e colaborar no planejamento do casamento.</p>
        </div>
        <button className="btn-primary min-h-11 w-full justify-center rounded-2xl px-5 py-2.5 shadow-rose sm:w-auto" onClick={openInviteModal} disabled={!canManage}>
          <Plus size={17} /> Convidar membro
        </button>
      </div>

      {message && <div className="rounded-2xl border border-w-border bg-white px-4 py-3 text-sm font-semibold text-w-muted shadow-soft">{message}</div>}

      <section className="grid max-w-full grid-cols-2 gap-2.5 overflow-x-hidden sm:gap-3 xl:grid-cols-4">
        <SummaryCard label="Noivas" value={brides} icon={Heart} accent="border-rose-100 bg-rose-50/50" iconTone="bg-white text-w-rose ring-rose-100" valueTone="text-w-rose" bar="bg-w-rose" helper={`${brides} ${brides === 1 ? 'membro ativo' : 'membros ativos'}`} />
        <SummaryCard label="Noivos" value={grooms} icon={Users} accent="border-blue-100 bg-blue-50/50" iconTone="bg-white text-[#2563EB] ring-blue-100" valueTone="text-[#2563EB]" bar="bg-[#2563EB]" helper={`${grooms} ${grooms === 1 ? 'membro ativo' : 'membros ativos'}`} />
        <SummaryCard label="Cerimonialistas" value={planners} icon={UserCog} accent="border-emerald-100 bg-emerald-50/50" iconTone="bg-white text-[#16A34A] ring-emerald-100" valueTone="text-[#15803D]" bar="bg-[#16A34A]" helper={`${planners} ${planners === 1 ? 'membro ativo' : 'membros ativos'}`} />
        <SummaryCard label="Visualizadores" value={viewers} icon={Mail} accent="border-amber-100 bg-amber-50/55" iconTone="bg-white text-[#D97706] ring-amber-100" valueTone="text-[#B45309]" bar="bg-[#F59E0B]" helper={`${viewers} ${viewers === 1 ? 'acesso limitado' : 'acessos limitados'}`} />
      </section>

      <section className="grid max-w-full gap-4 overflow-visible lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="min-w-0 max-w-full overflow-visible rounded-3xl border border-w-border bg-white/70 p-2.5 shadow-soft sm:p-4">
          <div className="mb-3 flex items-start justify-between gap-3 px-1">
            <div className="min-w-0">
              <h2 className="section-title">Equipe do planejamento</h2>
              <p className="mt-0.5 text-xs font-medium text-w-muted">{members.rows.length} pessoas com acesso</p>
            </div>
            <span className="shrink-0 rounded-full bg-w-rose-lt px-2.5 py-1 text-[11px] font-bold text-w-rose">Colaborativo</span>
          </div>

          <div className="grid min-w-0 max-w-full gap-2.5 overflow-visible">
            {members.rows.map((member) => (
              <MemberCard
                key={member.id}
                member={member}
                canManage={canManage}
                isCurrentUser={member.user_id === user?.id}
                actionOpen={actionOpen}
                onToggleActions={setActionOpen}
                onEdit={openPermissions}
                onRemove={(next) => {
                  setActionOpen('');
                  setRemoving(next);
                }}
              />
            ))}
          </div>
        </div>

        <aside className="min-w-0 max-w-full space-y-4 overflow-visible">
          <section className="rounded-3xl border border-w-border bg-white p-4 shadow-soft">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="section-title">Convites pendentes</h2>
                <p className="mt-0.5 text-xs font-medium text-w-muted">{pendingInvites.length} aguardando aceite</p>
              </div>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-w-rose-lt text-w-rose">
                <Link2 size={17} />
              </span>
            </div>
            <div className="mt-3 grid gap-2.5">
              {pendingInvites.map((invite) => (
                <InviteCard key={invite.id} invite={invite} copiedId={copiedId} onCopy={copyInvite} onResend={resendInvite} onCancel={setCancelingInvite} />
              ))}
              {!pendingInvites.length && <p className="rounded-2xl bg-w-surface p-4 text-sm font-semibold text-w-muted">Nenhum convite pendente.</p>}
            </div>
          </section>

          <section className="rounded-3xl border border-w-border bg-white p-4 shadow-soft">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="section-title">Atividades recentes</h2>
                <p className="mt-0.5 text-xs font-medium text-w-muted">Historico do acesso</p>
              </div>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-w-surface text-w-muted">
                <CalendarClock size={17} />
              </span>
            </div>
            <div className="mt-4">
              {activities.map((activity, index) => (
                <div key={activity.id} className="relative flex gap-3 pb-4 last:pb-0">
                  <div className="relative flex w-4 shrink-0 justify-center">
                    <span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-w-rose ring-4 ring-w-rose-lt" />
                    {index < activities.length - 1 && <span className="absolute top-5 h-[calc(100%-0.75rem)] w-px bg-w-border" />}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold leading-5 text-w-text">{activity.text}</p>
                    <p className="mt-0.5 text-xs font-semibold text-w-faint">{activity.time}</p>
                  </div>
                </div>
              ))}
              {!activities.length && <p className="rounded-2xl bg-w-surface p-4 text-sm font-semibold text-w-muted">Nenhuma atividade recente.</p>}
            </div>
          </section>
        </aside>
      </section>

      <Modal open={inviteOpen} title="Convidar membro" onClose={closeInviteModal}>
        <form className="space-y-5" onSubmit={submitInvite}>
          {inviteError && (
            <div className="rounded-2xl border border-w-red/20 bg-w-red-lt p-3 text-sm font-semibold text-w-red">
              {inviteError}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="label">Nome do membro</span>
              <input className="input rounded-2xl" value={inviteForm.name} onChange={(event) => setInviteForm({ ...inviteForm, name: event.target.value })} placeholder="Nome do membro" />
            </label>
            <label className="block">
              <span className="label">E-mail</span>
              <input className="input rounded-2xl" type="email" value={inviteForm.email} onChange={(event) => setInviteForm({ ...inviteForm, email: event.target.value })} placeholder="email@exemplo.com" />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <FormSelect
              label="Tipo de acesso"
              value={inviteForm.role}
              onChange={(event) => {
                const nextRole = event.target.value;
                setInviteForm({ ...inviteForm, role: nextRole });
                setInvitePermissions(defaultPermissions[nextRole] ?? defaultPermissions.viewer);
              }}
              options={roleOptions}
            />
            <label className="block">
              <span className="label">Validade do convite</span>
              <select
                className="input rounded-2xl"
                value={inviteForm.ttlDays}
                onChange={(event) => setInviteForm({ ...inviteForm, ttlDays: Number(event.target.value) })}
              >
                <option value={3}>3 dias</option>
                <option value={7}>7 dias</option>
                <option value={15}>15 dias</option>
                <option value={30}>30 dias</option>
              </select>
            </label>
          </div>

          <div className="rounded-3xl border border-w-border bg-w-surface p-3">
            <p className="px-1 text-xs font-extrabold uppercase tracking-[0.14em] text-w-faint">Permissoes</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {permissionItems.map((item) => (
                <label key={item.key} className="flex items-center justify-between gap-3 rounded-2xl border border-w-border bg-white p-3 text-sm font-semibold text-w-text">
                  <span>{item.label}</span>
                  <input
                    type="checkbox"
                    checked={Boolean(invitePermissions[item.key])}
                    onChange={(event) => setInvitePermissions((current) => ({ ...current, [item.key]: event.target.checked }))}
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-w-rose-lt p-3 text-sm font-semibold text-w-rose">
            O app gera um link unico para compartilhar com a pessoa convidada.
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" className="btn-secondary justify-center" onClick={closeInviteModal} disabled={inviteSubmitting}>Cancelar</button>
            <button className="btn-primary justify-center" disabled={inviteSubmitting}>
              <Send size={16} /> {inviteSubmitting ? 'Enviando...' : 'Enviar convite'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(permissionOpen)} title="Permissoes do membro" onClose={() => setPermissionOpen(null)}>
        {permissionOpen && (
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); setConfirmingPermissions(true); }}>
            <div className="flex items-center gap-3 rounded-3xl bg-w-surface p-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-w-rose-lt text-sm font-extrabold text-w-rose">{initials(permissionOpen.name)}</span>
              <div className="min-w-0">
                <p className="truncate font-extrabold text-w-text">{permissionOpen.name}</p>
                <p className="truncate text-sm text-w-muted">{permissionOpen.email}</p>
              </div>
            </div>
            <FormSelect
              label="Funcao"
              value={permissionOpen.role}
              onChange={(event) => setPermissionOpen({ ...permissionOpen, role: event.target.value as MemberRole })}
              options={[{ label: 'Proprietario', value: 'owner' }, ...roleOptions]}
              disabled={permissionOpen.role === 'owner'}
            />
            <div className="grid gap-2 sm:grid-cols-2">
              {permissionItems.map((item) => (
                <label key={item.key} className="flex items-center justify-between gap-3 rounded-2xl border border-w-border bg-white p-3 text-sm font-semibold">
                  <span>{item.label}</span>
                  <input
                    type="checkbox"
                    checked={Boolean(permissions[item.key])}
                    onChange={(event) => setPermissions((current) => ({ ...current, [item.key]: event.target.checked }))}
                    disabled={permissionOpen.role === 'owner'}
                  />
                </label>
              ))}
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" className="btn-secondary justify-center" onClick={() => setPermissionOpen(null)}>Cancelar</button>
              <button className="btn-primary justify-center">Salvar permissoes</button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(removing)}
        title="Remover membro?"
        description="Este membro perderá o acesso ao planejamento. Tem certeza que deseja continuar?"
        confirmLabel="Sim, remover"
        variant="danger"
        details={removing ? [
          { label: 'Membro', value: removing.name },
          { label: 'E-mail', value: removing.email },
          { label: 'Função', value: roleLabels[removing.role] ?? removing.role }
        ] : undefined}
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          if (!removing) return;
          return removeMember(removing);
        }}
      />

      <ConfirmDialog
        open={confirmingPermissions}
        title="Alterar permissões?"
        description="Essa mudança pode alterar o que este membro pode visualizar ou editar no planejamento."
        confirmLabel="Sim, alterar"
        variant="warning"
        details={permissionOpen ? [
          { label: 'Membro', value: permissionOpen.name },
          { label: 'Função', value: roleLabels[permissionOpen.role] ?? permissionOpen.role }
        ] : undefined}
        onCancel={() => setConfirmingPermissions(false)}
        onConfirm={confirmSavePermissions}
      />

      <ConfirmDialog
        open={Boolean(cancelingInvite)}
        title="Cancelar convite?"
        description="Este convite deixará de permitir acesso ao planejamento. Tem certeza que deseja continuar?"
        confirmLabel="Sim, cancelar convite"
        variant="danger"
        details={cancelingInvite ? [
          { label: 'Função', value: roleLabels[cancelingInvite.role] ?? cancelingInvite.role },
          { label: 'Validade', value: formatDate(cancelingInvite.expires_at) }
        ] : undefined}
        onCancel={() => setCancelingInvite(null)}
        onConfirm={confirmCancelInvite}
      />
    </div>
  );
}
