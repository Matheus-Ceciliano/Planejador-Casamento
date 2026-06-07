import { CheckCircle2, ChevronDown, Edit2, Eye, Phone, Plus, Trash2, Users, XCircle } from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import EmptyState from '../components/EmptyState';
import FormInput from '../components/FormInput';
import FormSelect from '../components/FormSelect';
import FormTextarea from '../components/FormTextarea';
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
    neutral: 'text-[#2D2A26]',
    success: 'text-[#5F8D6D]',
    warning: 'text-[#B07C45]',
    danger: 'text-[#C46A6A]'
  }[tone];

  return (
    <div className="rounded-lg bg-[#FAF8F5] px-3 py-2">
      <p className={`text-lg font-semibold leading-none ${toneClass}`}>{value}</p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-[#6F6760]">{label}</p>
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
  const [form, setForm] = useState(blank);

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Famílias e grupos</h1>
          <p className="mt-1 text-sm text-stone-500">Organize convidados por núcleos familiares, mantendo confirmações individuais.</p>
        </div>
        <button className="btn-primary" onClick={() => start()}><Plus size={16} />Nova família</button>
      </div>

      {groups.rows.length ? (
        <section className="grid gap-4 xl:grid-cols-2">
          {groups.rows.map((group) => {
            const members = membersByGroup.get(group.id) ?? [];
            const orderedMembers = orderMembers(members, group);
            const confirmed = members.filter((guest) => guest.invite_status === 'confirmado').length;
            const refused = members.filter((guest) => guest.invite_status === 'recusado').length;
            const pending = members.filter((guest) => isPendingStatus(guest.invite_status)).length;
            const isOpen = expanded.has(group.id);

            return (
              <article key={group.id} className="rounded-lg border border-[#E7E0D8] bg-white shadow-[0_16px_38px_rgba(58,43,39,0.06)]">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#6F6760]">{group.side}</p>
                      <h2 className="mt-1 break-words text-lg font-semibold text-[#2D2A26]">{group.name}</h2>
                      <p className="mt-1 text-sm text-[#6F6760]">Chefe: <span className="font-medium text-[#2D2A26]">{group.responsible_name || 'Não definido'}</span></p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button type="button" className="btn-secondary h-9 px-3" onClick={() => start(group)} title="Editar família" aria-label="Editar família">
                        <Edit2 size={15} />
                      </button>
                      <button type="button" className="btn-secondary h-9 px-3 text-[#C46A6A]" onClick={() => groups.remove(group.id)} title="Excluir família" aria-label="Excluir família">
                        <Trash2 size={15} />
                      </button>
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
                    className="mt-4 flex w-full items-center justify-between rounded-lg border border-[#E7E0D8] bg-[#FAF8F5] px-3 py-2 text-sm font-semibold text-[#2D2A26] transition hover:border-[#B76E79]"
                    onClick={() => toggleExpanded(group.id)}
                    aria-expanded={isOpen}
                  >
                    <span>Ver membros ({members.length})</span>
                    <ChevronDown size={16} className={`text-[#6F6760] transition ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                </div>

                {isOpen && (
                  <div className="border-t border-[#E7E0D8] bg-[#FAF8F5] p-3">
                    {orderedMembers.length ? (
                      <div className="space-y-2">
                        {orderedMembers.map((guest) => {
                          const head = isFamilyHead(guest, group);
                          const role = head ? 'Chefe da família' : group.responsible_name ? `Dependente de ${group.responsible_name}` : 'Individual dentro da família';
                          return (
                            <div key={guest.id} className={`rounded-lg border bg-white p-3 ${head ? 'border-[#B76E79] shadow-[0_10px_24px_rgba(216,167,160,0.16)]' : 'border-[#E7E0D8]'}`}>
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="break-words text-sm font-semibold text-[#2D2A26]">{guest.full_name}</p>
                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${head ? 'bg-[#B76E79]/20 text-[#B76E79]' : 'bg-[#E7E0D8] text-[#6F6760]'}`}>{role}</span>
                                  </div>
                                  <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <TypeBadge type={guest.guest_type} />
                                    <StatusBadge status={guest.invite_status} />
                                  </div>
                                  <div className="mt-2 grid gap-1 text-xs text-[#6F6760] sm:grid-cols-2">
                                    {guest.phone ? (
                                      <a className="inline-flex items-center gap-1 font-medium text-[#2D2A26] transition hover:text-[#B76E79]" href={buildWhatsAppChatLink(guest.phone)} target="_blank" rel="noreferrer">
                                        <Phone size={12} />{guest.phone}
                                      </a>
                                    ) : (
                                      <span className="inline-flex items-center gap-1"><Phone size={12} />—</span>
                                    )}
                                    <span>Acompanhantes: {Number(guest.companions ?? 0)}</span>
                                  </div>
                                </div>
                                <div className="flex shrink-0 flex-wrap gap-2">
                                  <button type="button" className="btn-secondary h-8 px-2 text-xs text-[#5F8D6D]" onClick={() => guests.update(guest.id, { invite_status: 'confirmado' })}>
                                    <CheckCircle2 size={14} /> Confirmar
                                  </button>
                                  <button type="button" className="btn-secondary h-8 px-2 text-xs text-[#C46A6A]" onClick={() => guests.update(guest.id, { invite_status: 'recusado' })}>
                                    <XCircle size={14} /> Recusar
                                  </button>
                                  <button type="button" className="btn-secondary h-8 px-2 text-xs" onClick={() => navigate('/convidados')}>
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
    </div>
  );
}
