import { Copy, Link2, RotateCcw, Trash2 } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import CurrencyInput from '../components/CurrencyInput';
import FileUpload from '../components/FileUpload';
import FormInput from '../components/FormInput';
import FormSelect from '../components/FormSelect';
import FormTextarea from '../components/FormTextarea';
import StatusBadge from '../components/StatusBadge';
import { useAuth } from '../hooks/useAuth';
import { useWedding } from '../hooks/useWedding';
import { useWeddingTable } from '../hooks/useWeddingTable';
import { supabase } from '../lib/supabase';
import { MemberRole, WeddingInvite, WeddingMember } from '../types';

type Props = { firstRun?: boolean };

const roleLabels: Record<string, string> = {
  owner: 'Administrador principal',
  bride: 'Noiva',
  groom: 'Noivo',
  planner: 'Cerimonialista',
  viewer: 'Visualizador',
  noiva: 'Noiva',
  noivo: 'Noivo',
  cerimonialista: 'Cerimonialista',
};

const inviteRoleOptions = [
  { label: 'Noiva', value: 'bride' },
  { label: 'Noivo', value: 'groom' },
  { label: 'Cerimonialista', value: 'planner' },
  { label: 'Visualizador', value: 'viewer' },
];

function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function inviteStatus(invite: WeddingInvite) {
  if (invite.is_revoked) return 'Revogado';
  if (invite.used_at) return 'Usado';
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) return 'Expirado';
  return 'Ativo';
}

function statusTone(status: string) {
  if (status === 'Ativo') return 'confirmado';
  if (status === 'Usado') return 'enviado';
  if (status === 'Expirado') return 'pendente';
  return 'recusado';
}

export default function Settings({ firstRun }: Props) {
  const { user } = useAuth();
  const { wedding, saveWedding } = useWedding();
  const members = useWeddingTable<WeddingMember>('wedding_members', 'name');
  const invites = useWeddingTable<WeddingInvite>('wedding_invites', 'created_at');
  const [message, setMessage] = useState('');
  const [memberMessage, setMemberMessage] = useState('');
  const [inviteRole, setInviteRole] = useState<Exclude<MemberRole, 'owner'>>('bride');
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    groom_name: '',
    bride_name: '',
    wedding_date: '',
    ceremony_time: '',
    ceremony_place: '',
    party_place: '',
    planned_budget: 0,
    cover_url: '',
    color_palette: 'Rosé, champagne e off-white',
    notes: ''
  });

  const currentMember = useMemo(
    () => members.rows.find((member) => member.user_id === user?.id),
    [members.rows, user?.id]
  );
  const canManageMembers = ['owner', 'bride', 'groom', 'noiva', 'noivo'].includes(currentMember?.role ?? '');

  useEffect(() => {
    if (wedding) {
      setForm({
        name: wedding.name ?? '',
        groom_name: wedding.groom_name ?? '',
        bride_name: wedding.bride_name ?? '',
        wedding_date: wedding.wedding_date ?? '',
        ceremony_time: wedding.ceremony_time ?? '',
        ceremony_place: wedding.ceremony_place ?? '',
        party_place: wedding.party_place ?? '',
        planned_budget: Number(wedding.planned_budget ?? 0),
        cover_url: wedding.cover_url ?? '',
        color_palette: wedding.color_palette ?? '',
        notes: wedding.notes ?? ''
      });
    }
  }, [wedding]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    await saveWedding(form);
    setMessage('Configurações salvas.');
  }

  function inviteLink(token: string) {
    return `${window.location.origin}/convite/${token}`;
  }

  async function createInvite(event: FormEvent) {
    event.preventDefault();
    if (!wedding) return;
    setCreatingInvite(true);
    setMemberMessage('');
    const { error } = await supabase.rpc('create_wedding_invite', {
      target_wedding_id: wedding.id,
      invite_role: inviteRole,
      ttl_days: 7,
    });
    setCreatingInvite(false);
    if (error) {
      setMemberMessage(error.message);
      return;
    }
    setMemberMessage('Link de convite gerado.');
    await invites.refresh();
  }

  async function copyInvite(invite: WeddingInvite) {
    await navigator.clipboard.writeText(inviteLink(invite.token));
    setCopiedId(invite.id);
    setTimeout(() => setCopiedId(null), 1800);
  }

  async function revokeInvite(invite: WeddingInvite) {
    const { error } = await supabase.rpc('revoke_wedding_invite', { invite_id: invite.id });
    if (error) {
      setMemberMessage(error.message);
      return;
    }
    setMemberMessage('Convite revogado.');
    await invites.refresh();
  }

  async function removeMember(member: WeddingMember) {
    if (member.role === 'owner' || member.user_id === user?.id) return;
    await members.remove(member.id);
    setMemberMessage('Membro removido.');
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="page-title">{firstRun ? 'Cadastre o casamento' : 'Configurações'}</h1>
        <p className="mt-1 text-sm text-stone-500">Dados do planejamento, membros e convites de acesso.</p>
      </div>

      <form className="panel space-y-5 p-4 sm:p-5" onSubmit={submit}>
        <div className="grid gap-3 md:grid-cols-2">
          <FormInput label="Nome do casamento" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          <FormInput label="Data do casamento" type="date" value={form.wedding_date} onChange={(event) => setForm({ ...form, wedding_date: event.target.value })} />
          <FormInput label="Nome do noivo" value={form.groom_name} onChange={(event) => setForm({ ...form, groom_name: event.target.value })} />
          <FormInput label="Nome da noiva" value={form.bride_name} onChange={(event) => setForm({ ...form, bride_name: event.target.value })} />
          <FormInput label="Horário da cerimônia" type="time" value={form.ceremony_time} onChange={(event) => setForm({ ...form, ceremony_time: event.target.value })} />
          <CurrencyInput label="Orçamento total planejado" value={form.planned_budget} onValueChange={(value) => setForm({ ...form, planned_budget: value })} />
          <FormInput label="Local da cerimônia" value={form.ceremony_place} onChange={(event) => setForm({ ...form, ceremony_place: event.target.value })} />
          <FormInput label="Local da festa" value={form.party_place} onChange={(event) => setForm({ ...form, party_place: event.target.value })} />
          <FormInput label="Paleta de cores" value={form.color_palette} onChange={(event) => setForm({ ...form, color_palette: event.target.value })} />
          <div>
            <span className="label">Foto/capa</span>
            <div className="flex flex-wrap items-center gap-3">
              <FileUpload folder="capas" onUploaded={(url) => setForm({ ...form, cover_url: url })} />
              {form.cover_url && <a className="text-sm font-medium text-event-rose hover:underline" href={form.cover_url} target="_blank" rel="noreferrer">Ver capa</a>}
            </div>
          </div>
        </div>
        <FormTextarea label="Observações gerais" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} />
        {message && <p className="text-sm text-event-success">{message}</p>}
        <button className="btn-primary w-full sm:w-auto">Salvar configurações</button>
      </form>

      {wedding && (
        <section className="panel space-y-5 p-4 sm:p-5">
          <div>
            <h2 className="text-lg font-semibold text-event-text">Membros do planejamento</h2>
            <p className="mt-1 text-sm text-stone-500">Pessoas com acesso ao mesmo casamento.</p>
          </div>

          <div className="grid gap-2">
            {members.rows.map((member) => (
              <div key={member.id} className="flex items-center justify-between gap-3 rounded-xl border border-event-border bg-white/80 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-event-text">{member.name}</p>
                  <p className="truncate text-xs text-stone-500">{member.email}</p>
                  <p className="mt-1 text-[11px] text-stone-400">Entrada: {formatDate(member.created_at)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusBadge status={roleLabels[member.role] ?? member.role} />
                  {canManageMembers && member.role !== 'owner' && member.user_id !== user?.id && (
                    <button type="button" className="rounded-lg p-2 text-stone-500 hover:bg-[#C46A6A]/10 hover:text-[#C46A6A]" onClick={() => removeMember(member)} aria-label="Remover membro">
                      <Trash2 size={17} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-event-border bg-white/70 p-3 sm:p-4">
            <div className="flex items-start gap-3">
              <span className="rounded-lg bg-event-rose/10 p-2 text-event-rose"><Link2 size={18} /></span>
              <div>
                <h3 className="font-semibold text-event-text">Convidar novo membro</h3>
                <p className="mt-1 text-sm text-stone-500">Gere um link único para a pessoa entrar neste planejamento.</p>
              </div>
            </div>

            <form className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,220px)_auto]" onSubmit={createInvite}>
              <FormSelect
                label="Papel"
                value={inviteRole}
                onChange={(event) => setInviteRole(event.target.value as Exclude<MemberRole, 'owner'>)}
                options={inviteRoleOptions}
                disabled={!canManageMembers}
              />
              <div className="flex items-end">
                <button className="btn-primary w-full" disabled={creatingInvite || !canManageMembers}>
                  <Link2 size={17} />
                  {creatingInvite ? 'Gerando...' : 'Gerar link de convite'}
                </button>
              </div>
            </form>

            {!canManageMembers && <p className="mt-3 text-sm text-[#C46A6A]">Seu papel não permite gerenciar convites.</p>}
            {memberMessage && <p className="mt-3 text-sm text-stone-600">{memberMessage}</p>}
          </div>

          <div className="space-y-2">
            {invites.rows.map((invite) => {
              const status = inviteStatus(invite);
              return (
                <div key={invite.id} className="rounded-xl border border-event-border bg-white/80 p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-event-text">{roleLabels[invite.role]}</p>
                        <StatusBadge status={statusTone(status)} />
                      </div>
                      <p className="mt-1 truncate text-xs text-stone-500">{inviteLink(invite.token)}</p>
                      <p className="mt-1 text-[11px] text-stone-400">Expira em: {formatDate(invite.expires_at)}</p>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" className="btn-secondary flex-1 px-3 sm:flex-none" onClick={() => copyInvite(invite)}>
                        <Copy size={15} /> {copiedId === invite.id ? 'Copiado' : 'Copiar'}
                      </button>
                      {!invite.is_revoked && !invite.used_at && (
                        <button type="button" className="btn-secondary flex-1 px-3 text-[#C46A6A] sm:flex-none" onClick={() => revokeInvite(invite)}>
                          <RotateCcw size={15} /> Revogar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {!invites.rows.length && (
              <p className="rounded-xl border border-dashed border-event-border bg-white/55 p-4 text-sm text-stone-500">Nenhum convite gerado ainda.</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
