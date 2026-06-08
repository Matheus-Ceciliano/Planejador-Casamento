import { Copy, Heart, Link2, Mail, Plus, Trash2, UserCog, Users } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';
import FormSelect from '../components/FormSelect';
import Modal from '../components/Modal';
import { useAuth } from '../hooks/useAuth';
import { useWedding } from '../hooks/useWedding';
import { useWeddingTable } from '../hooks/useWeddingTable';
import { supabase } from '../lib/supabase';
import { MemberRole, WeddingInvite, WeddingMember } from '../types';

const roleLabels: Record<string, string> = {
  owner: 'Proprietário',
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
  { key: 'guests', label: 'Convidados' },
  { key: 'agenda', label: 'Agenda' },
  { key: 'vendors', label: 'Fornecedores' },
  { key: 'budget', label: 'Orçamento' },
  { key: 'files', label: 'Arquivos' },
  { key: 'timeline', label: 'Cronograma' },
  { key: 'settings', label: 'Configurações' }
];

const fullPermissions = Object.fromEntries(permissionItems.map((item) => [item.key, true]));
const readOnlyPermissions = Object.fromEntries(permissionItems.map((item) => [item.key, false]));

const defaultPermissions: Record<string, Record<string, boolean>> = {
  owner: fullPermissions,
  bride: fullPermissions,
  groom: fullPermissions,
  planner: { guests: true, agenda: true, vendors: true, budget: false, files: true, timeline: true, settings: false },
  viewer: readOnlyPermissions,
  noiva: fullPermissions,
  noivo: fullPermissions,
  cerimonialista: { guests: true, agenda: true, vendors: true, budget: false, files: true, timeline: true, settings: false }
};

function roleBadgeClass(role: string) {
  const normalized = role === 'groom' || role === 'bride' || role === 'owner' ? 'owner' : role;
  if (normalized === 'owner') return 'bg-w-rose-lt text-w-rose';
  if (normalized === 'planner' || normalized === 'cerimonialista') return 'bg-[#F0FDF4] text-[#16A34A]';
  return 'bg-w-surface text-w-muted';
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'M';
}

function formatDate(value?: string | null) {
  if (!value) return 'Hoje';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(value));
}

function inviteStatus(invite: WeddingInvite) {
  if (invite.is_revoked) return 'Revogado';
  if (invite.used_at) return 'Aceito';
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) return 'Expirado';
  return 'Pendente';
}

export default function Members() {
  const { user } = useAuth();
  const { wedding } = useWedding();
  const members = useWeddingTable<WeddingMember>('wedding_members', 'name');
  const invites = useWeddingTable<WeddingInvite>('wedding_invites', 'created_at');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [permissionOpen, setPermissionOpen] = useState<WeddingMember | null>(null);
  const [removing, setRemoving] = useState<WeddingMember | null>(null);
  const [copiedId, setCopiedId] = useState('');
  const [message, setMessage] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', role: 'bride' });
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});

  const currentMember = members.rows.find((member) => member.user_id === user?.id);
  const canManage = ['owner', 'bride', 'groom', 'noivo', 'noiva'].includes(currentMember?.role ?? '');
  const pendingInvites = invites.rows.filter((invite) => inviteStatus(invite) === 'Pendente');
  const brides = members.rows.filter((member) => ['bride', 'noiva'].includes(member.role)).length;
  const grooms = members.rows.filter((member) => ['groom', 'noivo'].includes(member.role)).length;
  const planners = members.rows.filter((member) => ['planner', 'cerimonialista'].includes(member.role)).length;
  const viewers = members.rows.filter((member) => member.role === 'viewer').length;

  const activities = useMemo(() => {
    const recentMembers = members.rows.slice(0, 2).map((member) => `${member.name} entrou no planejamento`);
    const recentInvites = pendingInvites.slice(0, 2).map((invite) => `Convite pendente para ${roleLabels[invite.role] ?? invite.role}`);
    return [...recentMembers, ...recentInvites, 'Histórico de alterações será registrado conforme a auditoria evoluir.'].slice(0, 4);
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
        ttl_days: 7
      });

      if (error) {
        const needsMigration = ['PGRST202', 'PGRST205'].includes(error.code ?? '') || error.message.includes('schema cache');
        setInviteError(needsMigration ? 'A estrutura de convites ainda não foi aplicada no Supabase. Execute supabase/member-roles-permissions.sql e recarregue o schema cache.' : error.message);
        return;
      }

      setInviteOpen(false);
      setInviteForm({ name: '', email: '', role: 'bride' });
      setMessage('Convite gerado. Copie o link em Convites pendentes.');
      await invites.refresh();
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : 'Nao foi possivel gerar o convite agora.');
    } finally {
      setInviteSubmitting(false);
    }
  }

  function openPermissions(member: WeddingMember) {
    setPermissionOpen(member);
    setPermissions({ ...(defaultPermissions[member.role] ?? defaultPermissions.viewer), ...(member.permissions ?? {}) });
  }

  async function savePermissions(event: FormEvent) {
    event.preventDefault();
    if (!permissionOpen) return;
    const { error } = await supabase
      .from('wedding_members')
      .update({ role: permissionOpen.role, permissions })
      .eq('id', permissionOpen.id);
    if (error) {
      setMessage(error.message);
      return;
    }
    setPermissionOpen(null);
    setMessage('Permissões atualizadas.');
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

  return (
    <div className="space-y-4 text-w-text">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-title">Membros</h1>
          <p className="mt-1 text-sm text-w-muted">Gerencie quem pode acessar e colaborar no planejamento do casamento.</p>
        </div>
        <button className="btn-primary" onClick={openInviteModal} disabled={!canManage}>
          <Plus size={16} /> Convidar membro
        </button>
      </div>

      {message && <div className="rounded-2xl border border-[#E5E7EB] bg-white p-3 text-sm font-semibold text-w-muted">{message}</div>}

      <section className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {[
          { label: 'Noivas', value: brides, icon: Heart, tone: 'text-w-rose' },
          { label: 'Noivos', value: grooms, icon: Users, tone: 'text-[#2563EB]' },
          { label: 'Cerimonialistas', value: planners, icon: UserCog, tone: 'text-[#16A34A]' },
          { label: 'Visualizadores', value: viewers, icon: Mail, tone: 'text-[#6B7280]' }
        ].map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="card-metric p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-w-faint">{label}</p>
              <Icon size={15} className={tone} />
            </div>
            <p className="mt-2 text-2xl font-bold">{value}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-3 lg:grid-cols-[1fr_360px]">
        <div className="grid gap-3">
          {members.rows.map((member) => (
            <article key={member.id} className="card-hover-soft rounded-3xl border border-[#E5E7EB] bg-white p-4 shadow-soft">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => openPermissions(member)}>
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-w-rose-lt text-sm font-bold text-w-rose">{initials(member.name)}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">{member.name}</span>
                    <span className="block truncate text-xs text-w-muted">{member.email}</span>
                    <span className="mt-2 block text-xs font-semibold text-w-muted">Último acesso: Hoje</span>
                  </span>
                </button>
                <div className="flex items-center justify-between gap-2 sm:justify-end">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${roleBadgeClass(member.role)}`}>{roleLabels[member.role] ?? member.role}</span>
                  {canManage && member.role !== 'owner' && member.user_id !== user?.id && (
                    <button type="button" className="rounded-xl p-2 text-w-muted transition hover:bg-w-red-lt hover:text-[#EF4444]" onClick={() => setRemoving(member)} aria-label="Remover membro">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>

        <aside className="space-y-3">
          <section className="rounded-3xl border border-[#E5E7EB] bg-white p-4 shadow-soft">
            <h2 className="text-sm font-bold">Convites pendentes</h2>
            <div className="mt-3 grid gap-2">
              {pendingInvites.map((invite) => (
                <div key={invite.id} className="rounded-2xl border border-[#E5E7EB] bg-[#FAFAFA] p-3">
                  <p className="text-sm font-bold">{roleLabels[invite.role] ?? invite.role}</p>
                  <p className="mt-1 text-xs text-w-muted">Validade: {formatDate(invite.expires_at)}</p>
                  <button className="btn-secondary mt-3 w-full" onClick={() => copyInvite(invite)}>
                    <Copy size={15} /> {copiedId === invite.id ? 'Copiado' : 'Copiar link'}
                  </button>
                </div>
              ))}
              {!pendingInvites.length && <p className="rounded-2xl bg-w-surface p-4 text-sm font-semibold text-w-muted">Nenhum convite pendente.</p>}
            </div>
          </section>

          <section className="rounded-3xl border border-[#E5E7EB] bg-white p-4 shadow-soft">
            <h2 className="text-sm font-bold">Atividades recentes</h2>
            <div className="mt-3 grid gap-2">
              {activities.map((activity) => (
                <p key={activity} className="rounded-2xl bg-w-surface p-3 text-sm font-semibold text-w-muted">{activity}</p>
              ))}
            </div>
          </section>
        </aside>
      </section>

      <button className="btn-primary fixed bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] right-4 z-20 rounded-full px-5 lg:hidden" onClick={openInviteModal} disabled={!canManage}>
        <Plus size={16} /> Convidar
      </button>

      <Modal open={inviteOpen} title="Convidar membro" onClose={closeInviteModal}>
        <form className="space-y-4" onSubmit={submitInvite}>
          {inviteError && (
            <div className="rounded-2xl border border-w-red/20 bg-w-red-lt p-3 text-sm font-semibold text-w-red">
              {inviteError}
            </div>
          )}
          <label className="block">
            <span className="label">Nome</span>
            <input className="input" value={inviteForm.name} onChange={(event) => setInviteForm({ ...inviteForm, name: event.target.value })} placeholder="Nome do membro" />
          </label>
          <label className="block">
            <span className="label">Email</span>
            <input className="input" type="email" value={inviteForm.email} onChange={(event) => setInviteForm({ ...inviteForm, email: event.target.value })} placeholder="email@exemplo.com" />
          </label>
          <FormSelect label="Função" value={inviteForm.role} onChange={(event) => setInviteForm({ ...inviteForm, role: event.target.value })} options={roleOptions} />
          <div className="rounded-2xl bg-w-surface p-3 text-sm text-w-muted">
            O link único expira em 7 dias e poderá ser compartilhado com a pessoa convidada.
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={closeInviteModal} disabled={inviteSubmitting}>Cancelar</button>
            <button className="btn-primary" disabled={inviteSubmitting}>
              <Link2 size={16} /> {inviteSubmitting ? 'Gerando...' : 'Enviar convite'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(permissionOpen)} title="Permissões do membro" onClose={() => setPermissionOpen(null)}>
        {permissionOpen && (
          <form className="space-y-4" onSubmit={savePermissions}>
            <div className="rounded-2xl bg-w-surface p-4">
              <p className="font-bold">{permissionOpen.name}</p>
              <p className="text-sm text-w-muted">{permissionOpen.email}</p>
            </div>
            <FormSelect
              label="Função"
              value={permissionOpen.role}
              onChange={(event) => setPermissionOpen({ ...permissionOpen, role: event.target.value as MemberRole })}
              options={[{ label: 'Proprietário', value: 'owner' }, ...roleOptions]}
              disabled={permissionOpen.role === 'owner'}
            />
            <div className="grid gap-2">
              {permissionItems.map((item) => (
                <label key={item.key} className="flex items-center justify-between rounded-2xl border border-[#E5E7EB] bg-white p-3 text-sm font-semibold">
                  {item.label}
                  <input
                    type="checkbox"
                    checked={Boolean(permissions[item.key])}
                    onChange={(event) => setPermissions((current) => ({ ...current, [item.key]: event.target.checked }))}
                    disabled={permissionOpen.role === 'owner'}
                  />
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setPermissionOpen(null)}>Cancelar</button>
              <button className="btn-primary">Salvar permissões</button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(removing)}
        title="Remover membro"
        message={`Remover ${removing?.name ?? 'este membro'} do planejamento?`}
        onCancel={() => setRemoving(null)}
        onConfirm={() => removing && removeMember(removing)}
      />
    </div>
  );
}
