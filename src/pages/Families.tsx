import { CheckCircle2, ChevronDown, Edit2, Eye, MoreHorizontal, Phone, Plus, Trash2, Users, XCircle } from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import EmptyState from '../components/EmptyState';
import FormInput from '../components/FormInput';
import FormSelect from '../components/FormSelect';
import FormTextarea from '../components/FormTextarea';
import ConfirmDialog from '../components/ConfirmDialog';
import Modal from '../components/Modal';
import { useWeddingTable } from '../hooks/useWeddingTable';
import { Guest, GuestGroup } from '../types';
import { buildWhatsAppChatLink } from '../utils/whatsappService';

const blank = { name: '', side: 'noiva', responsible_name: '', responsible_phone: '', notes: '' };

function isPendingStatus(status: string) {
  return !['confirmado', 'recusado'].includes(status);
}

function normalizeText(value: string | null | undefined) {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function isFamilyHead(guest: Guest, group: GuestGroup) {
  return Boolean(group.responsible_name && normalizeText(guest.full_name) === normalizeText(group.responsible_name));
}

function orderMembers(members: Guest[], group: GuestGroup) {
  return [...members].sort((a, b) => {
    const aHead = isFamilyHead(a, group);
    const bHead = isFamilyHead(b, group);
    if (aHead !== bHead) return aHead ? -1 : 1;
    return a.full_name.localeCompare(b.full_name, 'pt-BR', { sensitivity: 'base' });
  });
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'C';
}

function StatusBadge({ status }: { status: string }) {
  const style =
    status === 'confirmado'
      ? 'bg-[#5F8D6D]/15 text-[#5F8D6D] ring-[#5F8D6D]/25'
      : status === 'recusado'
        ? 'bg-[#C46A6A]/15 text-[#C46A6A] ring-[#C46A6A]/25'
        : 'bg-[#E7E0D8] text-[#6F6760] ring-[#E7E0D8]';
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ${style}`}>{status}</span>;
}

function TypeBadge({ type }: { type: string }) {
  return <span className="inline-flex rounded-full bg-[#B76E79]/15 px-2.5 py-1 text-xs font-semibold capitalize text-[#B76E79] ring-1 ring-[#B76E79]/25">{type}</span>;
}

function Stat({ label, value, tone = 'neutral' }: { label: string; value: number; tone?: 'neutral' | 'success' | 'warning' | 'danger' }) {
  const toneClass = {
    neutral: 'bg-white text-[#2D2A26] ring-[#E7E0D8]',
    success: 'bg-[#F0FDF4] text-[#5F8D6D] ring-[#DCFCE7]',
    warning: 'bg-[#FFFBEB] text-[#B07C45] ring-[#FEF3C7]',
    danger: 'bg-[#FEF2F2] text-[#C46A6A] ring-[#FEE2E2]'
  }[tone];

  return (
    <div className={`min-h-[64px] rounded-2xl px-3 py-2 ring-1 ${toneClass}`}>
      <p className="text-lg font-extrabold leading-none sm:text-xl">{value}</p>
      <p className="mt-1.5 truncate text-[9px] font-bold uppercase tracking-[0.12em] opacity-70 sm:text-[10px]">{label}</p>
    </div>
  );
}

export default function Families() {
  const navigate = useNavigate();
  const groups = useWeddingTable<GuestGroup>('guest_groups', 'name');
  const guests = useWeddingTable<Guest>('guests', 'full_name');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<GuestGroup | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [actionOpen, setActionOpen] = useState('');
  const [form, setForm] = useState(blank);
  const [confirming, setConfirming] = useState<Guest | null>(null);
  const [refusing, setRefusing] = useState<Guest | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<GuestGroup | null>(null);
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [toast, setToast] = useState('');

  const membersByGroup = useMemo(
    () => new Map(groups.rows.map((group) => [group.id, guests.rows.filter((guest) => guest.group_id === group.id)])),
    [groups.rows, guests.rows]
  );

  function start(row?: GuestGroup) {
    setEditing(row ?? null);
    setForm(row ? { name: row.name, side: row.side, responsible_name: row.responsible_name ?? '', responsible_phone: row.responsible_phone ?? '', notes: row.notes ?? '' } : blank);
    setOpen(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (editing) await groups.update(editing.id, form as Partial<GuestGroup>);
    else await groups.create(form as Partial<GuestGroup>);
    setOpen(false);
  }

  function toggleExpanded(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function familyNameForGuest(guest: Guest | null) {
    if (!guest?.group_id) return null;
    return groups.rows.find((group) => group.id === guest.group_id)?.name ?? null;
  }

  function requestConfirmGuest(guest: Guest) {
    if (guest.invite_status === 'confirmado') {
      setToast('Este convidado já está confirmado.');
      return;
    }
    setConfirming(guest);
  }

  function requestRefuseGuest(guest: Guest) {
    if (guest.invite_status === 'recusado') {
      setToast('Este convidado já está recusado.');
      return;
    }
    setRefusing(guest);
  }

  async function confirmGuestPresence() {
    if (!confirming || statusSubmitting) return;
    const current = guests.rows.find((guest) => guest.id === confirming.id) ?? confirming;
    if (current.invite_status === 'confirmado') {
      setConfirming(null);
      setToast('Este convidado já está confirmado.');
      return;
    }
    setStatusSubmitting(true);
    try {
      await guests.update(confirming.id, { invite_status: 'confirmado' });
      setConfirming(null);
      setToast('Presença confirmada com sucesso.');
    } finally {
      setStatusSubmitting(false);
    }
  }

  async function refuseGuestPresence() {
    if (!refusing || statusSubmitting) return;
    const current = guests.rows.find((guest) => guest.id === refusing.id) ?? refusing;
    if (current.invite_status === 'recusado') {
      setRefusing(null);
      setToast('Este convidado já está recusado.');
      return;
    }
    setStatusSubmitting(true);
    try {
      await guests.update(refusing.id, { invite_status: 'recusado' });
      setRefusing(null);
      setToast('Presença marcada como recusada.');
    } finally {
      setStatusSubmitting(false);
    }
  }

  async function confirmDeleteGroup() {
    if (!deletingGroup || statusSubmitting) return;
    setStatusSubmitting(true);
    try {
      await groups.remove(deletingGroup.id);
      setDeletingGroup(null);
      setToast('Família excluída com sucesso.');
    } finally {
      setStatusSubmitting(false);
    }
  }

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    function closeActions() {
      setActionOpen('');
    }

    window.addEventListener('click', closeActions);
    return () => window.removeEventListener('click', closeActions);
  }, []);

  return (
    <div className="max-w-full space-y-5 overflow-x-hidden">
      {toast && (
        <div className="fixed left-4 right-4 top-[calc(env(safe-area-inset-top)+1rem)] z-[10020] mx-auto max-w-md rounded-2xl border border-[#F0EBE6] bg-white px-4 py-3 text-sm font-semibold text-[#2D2A26] shadow-float animate-slide-up sm:left-auto sm:right-6 sm:top-6">
          {toast}
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="page-title">Famílias e grupos</h1>
          <p className="mt-1 text-xs leading-relaxed text-stone-500 sm:text-sm">Organize convidados por núcleos familiares, mantendo confirmações individuais.</p>
        </div>
        <button className="btn-primary min-h-11 w-full justify-center rounded-2xl px-5 py-2.5 shadow-rose sm:w-auto" onClick={() => start()}><Plus size={16} />Nova família</button>
      </div>

      {groups.rows.length ? (
        <section className="grid max-w-full gap-4 md:grid-cols-2">
          {groups.rows.map((group) => {
            const members = membersByGroup.get(group.id) ?? [];
            const orderedMembers = orderMembers(members, group);
            const confirmed = members.filter((guest) => guest.invite_status === 'confirmado').length;
            const refused = members.filter((guest) => guest.invite_status === 'recusado').length;
            const pending = members.filter((guest) => isPendingStatus(guest.invite_status)).length;
            const isOpen = expanded.has(group.id);

            return (
              <article key={group.id} className="relative w-full max-w-full overflow-visible rounded-3xl border border-[#F0EBE6] bg-white shadow-soft transition hover:border-[#E5DDD8] hover:shadow-card">
                <div className="p-3.5 sm:p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 overflow-hidden pr-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <h2 className="min-w-0 truncate text-xl font-bold leading-6 text-[#2D2A26] sm:text-[22px]">{group.name}</h2>
                        <span className="shrink-0 rounded-full bg-[#B76E79]/10 px-2 py-0.5 text-[10px] font-bold text-[#B76E79] ring-1 ring-[#B76E79]/15 sm:text-xs">
                          {members.length} {members.length === 1 ? 'membro' : 'membros'}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-[13px] font-medium text-[#6F6760] sm:text-sm">Chefe da família: <span className="font-semibold text-[#2D2A26]">{group.responsible_name || 'Não definido'}</span></p>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#A59B92] sm:text-[11px]">{group.side}</p>
                    </div>
                    <div className="flex shrink-0 gap-1.5" onClick={(event) => event.stopPropagation()}>
                      <button type="button" className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#F0EBE6] bg-white text-[#6F6760] shadow-soft transition hover:border-[#B76E79]/35 hover:bg-[#FAF8F5] hover:text-[#B76E79] sm:h-9 sm:w-9" onClick={() => start(group)} title="Editar família" aria-label="Editar família">
                        <Edit2 size={14} />
                      </button>
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#F0EBE6] bg-white text-[#6F6760] shadow-soft transition hover:border-[#B76E79]/35 hover:bg-[#FAF8F5] hover:text-[#2D2A26] sm:h-9 sm:w-9"
                        onClick={(event) => {
                          event.stopPropagation();
                          setActionOpen(actionOpen === group.id ? '' : group.id);
                        }}
                        title="Mais ações"
                        aria-label="Mais ações"
                        aria-expanded={actionOpen === group.id}
                      >
                        <MoreHorizontal size={16} />
                      </button>
                      {actionOpen === group.id && (
                        <div className="absolute right-3 top-14 z-50 w-48 overflow-hidden rounded-2xl border border-[#F0EBE6] bg-white shadow-float animate-scale-in">
                          <button type="button" className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold text-[#C46A6A] hover:bg-[#FEF2F2]" onClick={() => { setActionOpen(''); setDeletingGroup(group); }}>
                            <Trash2 size={15} /> Excluir família
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Stat label="Convidados" value={members.length} />
                    <Stat label="Confirmados" value={confirmed} tone="success" />
                    <Stat label="Pendentes" value={pending} tone="warning" />
                    <Stat label="Recusados" value={refused} tone="danger" />
                  </div>

                  <button
                    type="button"
                    className="mt-4 flex w-full items-center justify-between rounded-2xl border border-[#F0EBE6] bg-[#FAF8F5] px-3.5 py-2 text-[13px] font-bold text-[#2D2A26] transition hover:border-[#B76E79]/40 hover:bg-white sm:text-sm"
                    onClick={() => toggleExpanded(group.id)}
                    aria-expanded={isOpen}
                  >
                    <span>Ver membros ({members.length})</span>
                    <ChevronDown size={16} className={`text-[#6F6760] transition ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                {isOpen && (
                  <div className="border-t border-[#F0EBE6] bg-[#FAF8F5] p-3">
                    {orderedMembers.length ? (
                      <div className="space-y-2">
                        {orderedMembers.map((guest) => {
                          const head = isFamilyHead(guest, group);
                          const role = head ? 'Chefe da família' : group.responsible_name ? `Dependente de ${group.responsible_name}` : 'Individual dentro da família';
                          return (
                            <div key={guest.id} className={`rounded-2xl border bg-white p-2.5 ${head ? 'border-[#B76E79]/45 shadow-[0_10px_24px_rgba(216,167,160,0.14)]' : 'border-[#F0EBE6]'}`}>
                              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
                                <div className="flex min-w-0 gap-2.5">
                                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFF1F5] text-xs font-extrabold text-[#B76E79] ring-1 ring-[#FCE4EA]">
                                    {initials(guest.full_name)}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                                      <p className="min-w-0 truncate text-sm font-extrabold text-[#2D2A26]">{guest.full_name}</p>
                                      <StatusBadge status={guest.invite_status} />
                                    </div>
                                    <p className="mt-1 truncate text-xs font-semibold text-[#6F6760]">{role}</p>
                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                      <TypeBadge type={guest.guest_type} />
                                    </div>
                                    <div className="mt-2 grid gap-1 text-xs text-[#6F6760] sm:grid-cols-2">
                                      {guest.phone ? (
                                        <a className="inline-flex min-w-0 items-center gap-1 font-medium text-[#2D2A26] transition hover:text-[#B76E79]" href={buildWhatsAppChatLink(guest.phone)} target="_blank" rel="noreferrer">
                                          <Phone size={12} className="shrink-0" /><span className="truncate">{guest.phone}</span>
                                        </a>
                                      ) : (
                                        <span className="inline-flex items-center gap-1"><Phone size={12} />—</span>
                                      )}
                                      <span className="truncate">Acompanhantes: {Number(guest.companions ?? 0)}</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex shrink-0 flex-wrap gap-2 pl-11 sm:pl-0">
                                  <button type="button" disabled={guest.invite_status === 'confirmado'} className="btn-secondary min-h-8 px-2 text-xs text-[#5F8D6D]" onClick={() => requestConfirmGuest(guest)}>
                                    <CheckCircle2 size={14} /> Confirmar
                                  </button>
                                  <button type="button" disabled={guest.invite_status === 'recusado'} className="btn-secondary min-h-8 px-2 text-xs text-[#C46A6A]" onClick={() => requestRefuseGuest(guest)}>
                                    <XCircle size={14} /> Recusar
                                  </button>
                                  <button type="button" className="btn-secondary min-h-8 px-2 text-xs" onClick={() => navigate('/convidados')}>
                                    <Eye size={14} /> Detalhes
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed border-[#B76E79]/50 bg-white p-4 text-sm text-[#6F6760]">Nenhum convidado vinculado a esta família.</div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </section>
      ) : (
        <EmptyState icon={Users} title="Nenhuma família cadastrada" text="Crie grupos para filtrar convidados e acompanhar confirmações por família." />
      )}

      <Modal open={open} title={editing ? 'Editar família' : 'Nova família'} onClose={() => setOpen(false)}>
        <form className="space-y-4" onSubmit={submit}>
          <div className="grid gap-4 md:grid-cols-2">
            <FormInput label="Nome da família/grupo" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <FormSelect label="Lado" value={form.side} onChange={(e) => setForm({ ...form, side: e.target.value })} options={['noivo','noiva','ambos','amigos','trabalho','igreja','outros'].map((v) => ({ label: v, value: v }))} />
            <FormInput label="Responsável" value={form.responsible_name} onChange={(e) => setForm({ ...form, responsible_name: e.target.value })} />
            <FormInput label="Telefone do responsável" value={form.responsible_phone} onChange={(e) => setForm({ ...form, responsible_phone: e.target.value })} />
          </div>
          <FormTextarea label="Observações" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <button className="btn-primary">Salvar</button>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirming)}
        title="Confirmar presença?"
        description="Tem certeza que deseja confirmar a presença deste convidado?"
        confirmLabel="Sim, confirmar presença"
        variant="success"
        loading={statusSubmitting}
        details={confirming ? [
          { label: 'Convidado', value: confirming.full_name },
          { label: 'Família', value: familyNameForGuest(confirming) || 'Individual' },
          { label: 'Tipo', value: confirming.guest_type },
          { label: 'Origem', value: confirming.origin_group || 'Não informado' },
          { label: 'Status atual', value: confirming.invite_status }
        ] : undefined}
        onCancel={() => setConfirming(null)}
        onConfirm={confirmGuestPresence}
      />

      <ConfirmDialog
        open={Boolean(refusing)}
        title="Recusar presença?"
        description="Tem certeza que deseja marcar este convidado como recusado?"
        confirmLabel="Sim, recusar presença"
        variant="danger"
        loading={statusSubmitting}
        details={refusing ? [
          { label: 'Convidado', value: refusing.full_name },
          { label: 'Família', value: familyNameForGuest(refusing) || 'Individual' },
          { label: 'Tipo', value: refusing.guest_type },
          { label: 'Origem', value: refusing.origin_group || 'Não informado' },
          { label: 'Status atual', value: refusing.invite_status }
        ] : undefined}
        onCancel={() => setRefusing(null)}
        onConfirm={refuseGuestPresence}
      />

      <ConfirmDialog
        open={Boolean(deletingGroup)}
        title="Excluir família?"
        description="Essa ação pode remover informações importantes. Tem certeza que deseja continuar?"
        confirmLabel="Sim, excluir"
        variant="danger"
        loading={statusSubmitting}
        details={deletingGroup ? [
          { label: 'Família', value: deletingGroup.name },
          { label: 'Membros', value: membersByGroup.get(deletingGroup.id)?.length ?? 0 }
        ] : undefined}
        onCancel={() => setDeletingGroup(null)}
        onConfirm={confirmDeleteGroup}
      />
    </div>
  );
}
