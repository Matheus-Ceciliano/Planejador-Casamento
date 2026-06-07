import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Edit2,
  Filter,
  HelpCircle,
  LayoutGrid,
  MoreVertical,
  Plus,
  Search,
  Table2,
  Trash2,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  XCircle,
  Phone,
  X
} from 'lucide-react';
import { Fragment, FormEvent, ReactNode, useEffect, useRef, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import ConfirmDialog from '../components/ConfirmDialog';
import Modal from '../components/Modal';
import { useWeddingTable } from '../hooks/useWeddingTable';
import { Guest, GuestGroup } from '../types';
import { buildWhatsAppChatLink } from '../utils/whatsappService';

// ─── Types ──────────────────────────────────────────────────────────────────────

type PrimaryFilter = 'all' | 'confirmed' | 'pending' | 'refused';
type ViewMode = 'cards' | 'table';

type SecondaryFilters = {
  families:    boolean;
  individuals: boolean;
};

type RegistrationStep = 'choose' | 'individual' | 'family';

type DependentEntry = {
  id: string;
  name: string;
  phone: string;
  guest_type: string;
};

type GuestFormData = {
  full_name:       string;
  phone:           string;
  group_id:        string;
  guest_type:      string;
  invite_status:   string;
  food_restriction: string;
  notes:           string;
};

// ─── Constants ──────────────────────────────────────────────────────────────────

const GUEST_TYPES = [
  { label: 'Adulto',             value: 'adulto'   },
  { label: 'Criança',            value: 'criança'  },
  { label: 'Convidado Especial', value: 'especial' },
];

const BLANK: GuestFormData = {
  full_name: '', phone: '', group_id: '', guest_type: 'adulto',
  invite_status: 'pendente', food_restriction: '', notes: '',
};

const SEC_BLANK: SecondaryFilters = {
  families: false, individuals: false,
};

function newDep(): DependentEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: '', phone: '', guest_type: 'adulto',
  };
}

// ─── Utilities ──────────────────────────────────────────────────────────────────

function maskPhone(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0,2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
}

function norm(v: string | null | undefined) {
  return (v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
}

function isPending(s: string) { return !['confirmado','recusado'].includes(s); }

function guestTypeLabel(type: string) {
  return GUEST_TYPES.find(item => item.value === type)?.label ?? type;
}

function isResponsible(row: Guest, group?: GuestGroup | null) {
  return Boolean(group?.responsible_name && norm(row.full_name) === norm(group.responsible_name));
}

function guestRoleLabel(row: Guest, group?: GuestGroup | null) {
  return group ? (isResponsible(row, group) ? 'Responsável' : 'Dependente') : 'Responsável';
}

function resolveGuestPhone(row: Guest, group: GuestGroup | null | undefined, allGuests: Guest[]) {
  if (row.phone) return { phone: row.phone, fallback: false };
  if (!group || isResponsible(row, group)) return { phone: null, fallback: false };
  const responsiblePhone =
    group.responsible_phone ||
    allGuests.find(guest => guest.group_id === group.id && isResponsible(guest, group))?.phone ||
    null;
  return { phone: responsiblePhone, fallback: Boolean(responsiblePhone) };
}

function initials(name: string) {
  const p = name.trim().split(' ').filter(Boolean);
  if (p.length >= 2) return (p[0][0] + p[p.length-1][0]).toUpperCase();
  return name.trim().charAt(0).toUpperCase() || '?';
}

function familyName(responsible: string) {
  const p = responsible.trim().split(' ').filter(Boolean);
  return `Família ${p.length > 1 ? p[p.length-1] : p[0] ?? ''}`;
}

// ─── Primitive UI (module-level — stable references) ────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === 'confirmado')
    return <span className="inline-flex items-center gap-1 rounded-full bg-[#5F8D6D]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#5F8D6D] ring-1 ring-[#5F8D6D]/20"><span className="h-1.5 w-1.5 rounded-full bg-[#5F8D6D]"/>Confirmado</span>;
  if (status === 'recusado')
    return <span className="inline-flex items-center gap-1 rounded-full bg-[#C46A6A]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#C46A6A] ring-1 ring-[#C46A6A]/20"><span className="h-1.5 w-1.5 rounded-full bg-[#C46A6A]"/>Recusado</span>;
  return <span className="inline-flex items-center gap-1 rounded-full bg-[#D4A373]/12 px-2.5 py-0.5 text-[11px] font-semibold text-[#B07C45] ring-1 ring-[#D4A373]/25"><span className="h-1.5 w-1.5 rounded-full bg-[#D4A373]"/>Pendente</span>;
}

function KpiCard({ label, value, icon, tone, active, onClick }: {
  label: string; value: number | string; icon: ReactNode;
  tone: 'neutral'|'success'|'warning'|'danger'; active: boolean; onClick: () => void;
}) {
  const t = {
    neutral: { ring:'border-event-rose bg-event-rose',       icon:'bg-stone-100 text-stone-500',    val:'text-event-text' },
    success: { ring:'border-[#5F8D6D] bg-[#5F8D6D]',       icon:'bg-[#5F8D6D]/10 text-[#5F8D6D]', val:'text-[#5F8D6D]' },
    warning: { ring:'border-[#D4A373] bg-[#D4A373]',       icon:'bg-[#D4A373]/12 text-[#B07C45]', val:'text-[#B07C45]' },
    danger:  { ring:'border-[#C46A6A] bg-[#C46A6A]',       icon:'bg-[#C46A6A]/10 text-[#C46A6A]', val:'text-[#C46A6A]' },
  }[tone];
  return (
    <button type="button" onClick={onClick}
      className={`flex items-center gap-3 rounded-xl border p-3 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
        active ? `${t.ring} text-white shadow-md` : 'border-stone-200 bg-white hover:border-stone-300'
      }`}>
      <span className={`inline-flex rounded-lg p-2 ${active ? 'bg-white/20 text-white' : t.icon}`}>{icon}</span>
      <div>
        <p className={`text-xl font-bold leading-none ${active ? 'text-white' : t.val}`}>{value}</p>
        <p className={`mt-0.5 text-xs font-medium ${active ? 'text-white/80' : 'text-stone-500'}`}>{label}</p>
      </div>
    </button>
  );
}

function FamilyGroupHeader({ name, count, open = true, onToggle }: { name: string; count: number; open?: boolean; onToggle?: () => void }) {
  return (
    <button type="button" onClick={onToggle}
      className="flex w-full items-center justify-between rounded-lg border border-stone-200 bg-white px-3 py-2 text-left shadow-sm transition hover:border-stone-300 hover:bg-stone-50">
      <span className="flex min-w-0 items-center gap-2">
        {open ? <ChevronDown size={16} className="shrink-0 text-stone-400"/> : <ChevronRight size={16} className="shrink-0 text-stone-400"/>}
        <Users size={14} className="shrink-0 text-stone-400"/>
        <span className="truncate text-sm font-semibold text-stone-700">{name}</span>
      </span>
      <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-semibold text-stone-500">{count}</span>
    </button>
  );
}

// ─── GuestCard ───────────────────────────────────────────────────────────────────

function GuestActionMenu({ row, open, onToggle, onEdit, onDelete, onRefuse, onConfirm }: {
  row: Guest; open: boolean; onToggle: () => void;
  onEdit:(r:Guest)=>void; onDelete:(r:Guest)=>void;
  onRefuse:(r:Guest)=>void; onConfirm:(id:string)=>void;
}) {
  const ok  = row.invite_status === 'confirmado';
  const bad = row.invite_status === 'recusado';

  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef    = useRef<HTMLDivElement>(null);

  // Fechar ao clicar/tocar fora do menu
  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent | TouchEvent) {
      const target = (e as MouseEvent).target as Node | null;
      if (
        menuRef.current    && !menuRef.current.contains(target) &&
        triggerRef.current && !triggerRef.current.contains(target)
      ) {
        onToggle();
      }
    }
    document.addEventListener('mousedown', handleOutside, true);
    document.addEventListener('touchstart', handleOutside, true);
    return () => {
      document.removeEventListener('mousedown', handleOutside, true);
      document.removeEventListener('touchstart', handleOutside, true);
    };
  }, [open, onToggle]);

  // Calcular posição do menu via getBoundingClientRect (evita corte por overflow)
  function getMenuStyle(): React.CSSProperties {
    if (!triggerRef.current) return { position: 'fixed', top: 0, right: 16 };
    const rect = triggerRef.current.getBoundingClientRect();
    const MENU_H   = 160; // altura estimada do menu
    const MENU_W   = 168;
    const viewH    = window.innerHeight;
    const viewW    = window.innerWidth;
    // Espaço abaixo e acima
    const spaceBelow = viewH - rect.bottom;
    const openAbove  = spaceBelow < MENU_H + 16 && rect.top > MENU_H;
    // Posição horizontal: alinhar à direita do trigger; não ultrapassar a margem esquerda
    const right = Math.max(8, viewW - rect.right);
    return {
      position: 'fixed',
      right,
      top: openAbove ? undefined : rect.bottom + 6,
      bottom: openAbove ? viewH - rect.top + 6 : undefined,
      width: MENU_W,
      zIndex: 9999,
    };
  }

  function closeAndRun(action: () => void) {
    onToggle();
    action();
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        className="flex h-7 w-7 items-center justify-center rounded-md text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
        aria-label="Ações do convidado"
        aria-expanded={open}
      >
        <MoreVertical size={15}/>
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          style={getMenuStyle()}
          onClick={(e) => e.stopPropagation()}
          className="rounded-xl border border-stone-200 bg-white p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.14)] ring-1 ring-black/5"
        >
          <button type="button" disabled={ok}
            onClick={() => closeAndRun(() => onConfirm(row.id))}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-xs font-semibold text-stone-700 transition hover:bg-emerald-50 hover:text-emerald-700 disabled:cursor-default disabled:opacity-40"
          >
            <CheckCircle2 size={13}/> Confirmar
          </button>
          <button type="button" disabled={bad}
            onClick={() => closeAndRun(() => onRefuse(row))}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-xs font-semibold text-stone-700 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-default disabled:opacity-40"
          >
            <XCircle size={13}/> Recusar
          </button>
          <button type="button"
            onClick={() => closeAndRun(() => onEdit(row))}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-xs font-semibold text-stone-700 transition hover:bg-stone-50"
          >
            <Edit2 size={13}/> Editar
          </button>
          <div className="my-1 h-px bg-stone-100" />
          <button type="button"
            onClick={() => closeAndRun(() => onDelete(row))}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-xs font-semibold text-red-500 transition hover:bg-red-50"
          >
            <Trash2 size={13}/> Excluir
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}

function GuestCard({ row, group, familyLabel, allGuests, actionOpen = false, onToggleActions = () => {}, onOpenDetails, onEdit, onDelete, onRefuse, onConfirm }: {
  row: Guest; group?: GuestGroup | null; familyLabel: string|null; allGuests: Guest[];
  actionOpen?: boolean; onToggleActions?: () => void;
  onOpenDetails:(r:Guest)=>void;
  onEdit:(r:Guest)=>void; onDelete:(r:Guest)=>void;
  onRefuse:(r:Guest)=>void; onConfirm:(id:string)=>void;
}) {
  const ok  = row.invite_status === 'confirmado';
  const bad = row.invite_status === 'recusado';
  const role = guestRoleLabel(row, group);
  const displayPhone = resolveGuestPhone(row, group, allGuests);
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={()=>onOpenDetails(row)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpenDetails(row);
        }
      }}
      className={`cursor-pointer rounded-lg border bg-white shadow-sm transition hover:border-stone-300 hover:bg-stone-50/60 hover:shadow-md ${
      ok ? 'border-emerald-200' : bad ? 'border-red-200' : 'border-stone-200'
    }`}>
      <div className="p-2.5">
        <div className="flex items-start gap-2.5">
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
            ok ? 'bg-emerald-100 text-emerald-700' : bad ? 'bg-red-100 text-red-600' : 'bg-stone-100 text-stone-600'
          }`}>{initials(row.full_name)}</div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-start justify-between gap-2">
              <p className="truncate text-sm font-semibold leading-5 text-event-text" title={row.full_name}>{row.full_name}</p>
              <StatusBadge status={row.invite_status}/>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] leading-4 text-stone-500">
              <span className="rounded-full bg-stone-100 px-2 py-0.5 font-semibold text-stone-600">{guestTypeLabel(row.guest_type)}</span>
              <span className="rounded-full bg-white px-2 py-0.5 font-medium text-stone-500 ring-1 ring-stone-200">{role}</span>
            </div>
          </div>
          <div className="shrink-0" onClick={(event) => event.stopPropagation()}>
            <GuestActionMenu row={row} open={actionOpen} onToggle={onToggleActions}
              onEdit={onEdit} onDelete={onDelete} onRefuse={onRefuse} onConfirm={onConfirm}/>
          </div>
        </div>
        <div className="mt-2 grid gap-1 text-[11px] leading-4 text-stone-500">
          <p className="truncate"><span className="font-semibold text-stone-600">Família:</span> {familyLabel ?? 'Individual'}</p>
          {displayPhone.phone && (
            <a
              className="inline-flex min-w-0 items-center gap-1 text-stone-500 transition hover:text-event-text"
              href={buildWhatsAppChatLink(displayPhone.phone)}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
            >
              <Phone size={10} className="shrink-0 text-stone-400"/>
              <span className="truncate">{displayPhone.phone}{displayPhone.fallback ? ' · responsável' : ''}</span>
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

function GuestTable({ sections, groupById, allGuests, onEdit, onDelete, onRefuse, onConfirm }: {
  sections: { key: string; label: string; group?: GuestGroup; rows: Guest[] }[];
  groupById: Map<string, string>;
  allGuests: Guest[];
  onEdit:(r:Guest)=>void; onDelete:(r:Guest)=>void;
  onRefuse:(r:Guest)=>void; onConfirm:(id:string)=>void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] table-fixed text-sm">
          <thead className="bg-stone-50 text-[11px] font-semibold uppercase tracking-wide text-stone-500">
            <tr>
              <th className="w-[43%] px-3 py-2.5 text-left sm:w-[32%] lg:w-[28%]">Nome</th>
              <th className="hidden w-[14%] px-3 py-2.5 text-left sm:table-cell lg:w-[12%]">Tipo</th>
              <th className="hidden w-[18%] px-3 py-2.5 text-left lg:table-cell">Família</th>
              <th className="hidden w-[16%] px-3 py-2.5 text-left xl:table-cell">Telefone</th>
              <th className="w-[24%] px-3 py-2.5 text-left sm:w-[16%] lg:w-[14%]">Status</th>
              <th className="w-[33%] px-3 py-2.5 text-right sm:w-[38%] md:w-[30%] lg:w-[28%] xl:w-[22%]">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {sections.map(section => (
              <Fragment key={section.key}>
                <tr className="bg-stone-50/60">
                  <td colSpan={6} className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-stone-500">
                    {section.label} <span className="font-medium normal-case tracking-normal text-stone-400">· {section.rows.length} convidado{section.rows.length !== 1 ? 's' : ''}</span>
                  </td>
                </tr>
                {section.rows.map(row => {
                  const responsible = isResponsible(row, section.group);
                  const ok = row.invite_status === 'confirmado';
                  const bad = row.invite_status === 'recusado';
                  const displayPhone = resolveGuestPhone(row, section.group, allGuests);

                  return (
                    <tr key={row.id} className="h-11 transition-colors hover:bg-stone-50/80">
                      <td className="px-3 py-1.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold leading-5 text-event-text" title={row.full_name}>{row.full_name}</p>
                          <p className="truncate text-[11px] font-medium leading-4 text-stone-400">
                            {section.group ? (responsible ? 'Responsável' : 'Dependente') : 'Responsável'}
                          </p>
                        </div>
                      </td>
                      <td className="hidden px-3 py-1.5 sm:table-cell">
                        <span className="inline-flex max-w-full rounded-md bg-stone-100 px-2 py-0.5 text-[11px] font-semibold text-stone-600">
                          <span className="truncate">{guestTypeLabel(row.guest_type)}</span>
                        </span>
                      </td>
                      <td className="hidden px-3 py-1.5 text-xs text-stone-500 lg:table-cell">
                        <span className="block truncate">{groupById.get(row.group_id ?? '') ?? 'Individual'}</span>
                      </td>
                      <td className="hidden px-3 py-1.5 text-xs text-stone-500 xl:table-cell">
                        {displayPhone.phone ? (
                          <a className="block truncate font-medium text-stone-600 transition hover:text-event-text" href={buildWhatsAppChatLink(displayPhone.phone)} target="_blank" rel="noreferrer">
                            {displayPhone.phone}{displayPhone.fallback ? ' · resp.' : ''}
                          </a>
                        ) : '-'}
                      </td>
                      <td className="px-3 py-1.5"><StatusBadge status={row.invite_status}/></td>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center justify-end gap-1">
                          <button type="button" disabled={ok} onClick={()=>onConfirm(row.id)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-default disabled:text-stone-300 disabled:hover:bg-transparent"
                            aria-label="Confirmar convidado">
                            <CheckCircle2 size={15}/>
                          </button>
                          <button type="button" disabled={bad} onClick={()=>onRefuse(row)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-red-500 transition hover:bg-red-50 disabled:cursor-default disabled:text-stone-300 disabled:hover:bg-transparent"
                            aria-label="Recusar convidado">
                            <XCircle size={15}/>
                          </button>
                          <button type="button" onClick={()=>onEdit(row)}
                            className="inline-flex h-8 items-center justify-center gap-1 rounded-lg px-2 text-xs font-semibold text-stone-700 transition hover:bg-stone-100"
                            aria-label="Editar convidado">
                            <Edit2 size={14}/> Editar
                          </button>
                          <button type="button" onClick={()=>onDelete(row)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-red-500 transition hover:bg-red-50"
                            aria-label="Excluir convidado">
                            <Trash2 size={15}/>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">{label}</p>
      <div className="mt-1 min-w-0 text-sm font-medium text-stone-700">{value || '-'}</div>
    </div>
  );
}

function GuestDetailsModal({ guest, group, familyMembers, allGuests, onClose, onEdit, onDelete, onRefuse, onConfirm }: {
  guest: Guest | null;
  group?: GuestGroup | null;
  familyMembers: Guest[];
  allGuests: Guest[];
  onClose: () => void;
  onEdit:(r:Guest)=>void; onDelete:(r:Guest)=>void;
  onRefuse:(r:Guest)=>void; onConfirm:(id:string)=>void;
}) {
  if (!guest) return null;
  const familyLabel = group?.name ?? 'Individual';
  const role = guestRoleLabel(guest, group);
  const displayPhone = resolveGuestPhone(guest, group, allGuests);

  return (
    <Modal open={Boolean(guest)} title="Detalhes do convidado" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3 rounded-lg border border-stone-200 bg-stone-50 p-3">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-event-text">{guest.full_name}</p>
            <p className="mt-1 text-xs text-stone-500">{familyLabel} · {role}</p>
          </div>
          <StatusBadge status={guest.invite_status}/>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <DetailItem label="Nome completo" value={guest.full_name}/>
          <DetailItem label="Tipo" value={guestTypeLabel(guest.guest_type)}/>
          <DetailItem label="Papel na família" value={role}/>
          <DetailItem label="Família vinculada" value={familyLabel}/>
          <DetailItem
            label="Telefone"
            value={displayPhone.phone ? (
              <a className="inline-flex max-w-full items-center gap-1 text-stone-700 hover:text-event-text" href={buildWhatsAppChatLink(displayPhone.phone)} target="_blank" rel="noreferrer">
                <Phone size={13} className="shrink-0 text-stone-400"/>
                <span className="truncate">{displayPhone.phone}{displayPhone.fallback ? ' · telefone do responsável' : ''}</span>
              </a>
            ) : '-'}
          />
          <DetailItem label="Status" value={<StatusBadge status={guest.invite_status}/>}/>
          <DetailItem label="Observações" value={<span className="whitespace-pre-wrap break-words">{guest.notes || '-'}</span>}/>
        </div>

        <section className="rounded-lg border border-stone-200 bg-white">
          <div className="border-b border-stone-100 px-3 py-2">
            <h3 className="text-sm font-semibold text-event-text">Membros da família</h3>
          </div>
          <div className="divide-y divide-stone-100">
            {familyMembers.map(member => (
              <div key={member.id} className="grid grid-cols-[minmax(0,1.2fr)_auto] gap-2 px-3 py-2 sm:grid-cols-[minmax(0,1.4fr)_0.8fr_0.8fr_auto]">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-event-text">{member.full_name}</p>
                  <p className="text-[11px] text-stone-400 sm:hidden">{guestRoleLabel(member, group)} · {guestTypeLabel(member.guest_type)}</p>
                </div>
                <p className="hidden truncate text-xs font-medium text-stone-500 sm:block">{guestRoleLabel(member, group)}</p>
                <p className="hidden truncate text-xs font-medium text-stone-500 sm:block">{guestTypeLabel(member.guest_type)}</p>
                <StatusBadge status={member.invite_status}/>
              </div>
            ))}
          </div>
        </section>

        <div className="flex flex-wrap justify-end gap-2 border-t border-stone-100 pt-4">
          <button type="button" disabled={guest.invite_status === 'confirmado'} onClick={()=>onConfirm(guest.id)}
            className="btn-secondary h-8 px-3 text-xs text-emerald-700 disabled:opacity-45">
            <CheckCircle2 size={14}/> Confirmar
          </button>
          <button type="button" disabled={guest.invite_status === 'recusado'} onClick={()=>onRefuse(guest)}
            className="btn-secondary h-8 px-3 text-xs text-red-600 disabled:opacity-45">
            <XCircle size={14}/> Recusar
          </button>
          <button type="button" onClick={()=>onEdit(guest)} className="btn-secondary h-8 px-3 text-xs">
            <Edit2 size={14}/> Editar
          </button>
          <button type="button" onClick={()=>onDelete(guest)} className="btn-secondary h-8 px-3 text-xs text-red-600">
            <Trash2 size={14}/> Excluir
          </button>
        </div>
      </div>
    </Modal>
  );
}

function GuestEmptyState({ onAdd }: { onAdd: ()=>void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-stone-300 bg-white px-6 py-16 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-stone-100"><UserPlus size={24} className="text-stone-400"/></div>
      <h3 className="mt-4 text-base font-semibold text-event-text">Nenhum convidado encontrado</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-stone-500">Comece adicionando seus convidados para acompanhar confirmações e famílias.</p>
      <button type="button" onClick={onAdd} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-event-rose px-4 py-2 text-sm font-medium text-white hover:bg-[#9F5965]">
        <Plus size={15}/> Adicionar primeiro convidado
      </button>
    </div>
  );
}

// ─── ChooseRegistrationType ──────────────────────────────────────────────────────

function ChooseRegistrationType({ onIndividual, onFamily }: { onIndividual:()=>void; onFamily:()=>void }) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-stone-500">Como deseja cadastrar?</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          { label:'Convidado Individual', sub:'Uma pessoa, com nome, telefone e confirmação individual.', icon:<UserPlus size={18}/>, action: onIndividual },
          { label:'Família', sub:'Responsável + dependentes ilimitados. Agrupamento automático.', icon:<Users size={18}/>, action: onFamily },
        ].map(({ label, sub, icon, action }) => (
          <button key={label} type="button" onClick={action}
            className="group flex flex-col items-start gap-3 rounded-xl border-2 border-stone-200 bg-white p-5 text-left transition hover:border-event-rose hover:bg-stone-50">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-stone-100 transition group-hover:bg-event-rose group-hover:text-white text-stone-500">
              {icon}
            </div>
            <div>
              <p className="font-semibold text-event-text">{label}</p>
              <p className="mt-1 text-xs text-stone-500">{sub}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── EditGuestForm — LOCAL STATE (fixes input focus bug) ─────────────────────────

function EditGuestForm({ initial, groups, onSave, onClose }: {
  initial: GuestFormData;
  groups: GuestGroup[];
  onSave: (f: GuestFormData) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<GuestFormData>(() => ({ ...initial }));
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try { await onSave(form); }
    finally { setSaving(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label">Nome completo *</span>
          <input className="input" required value={form.full_name}
            onChange={e => setForm(f=>({...f, full_name: e.target.value}))} placeholder="Ex: João Silva"/>
        </label>
        <label className="block">
          <span className="label">Telefone</span>
          <input className="input" inputMode="tel" value={form.phone}
            onChange={e => setForm(f=>({...f, phone: maskPhone(e.target.value)}))} placeholder="(00) 00000-0000"/>
        </label>
        <label className="block">
          <span className="label">Tipo</span>
          <select className="input" value={form.guest_type} onChange={e => setForm(f=>({...f, guest_type: e.target.value}))}>
            {GUEST_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="label">Status</span>
          <select className="input" value={form.invite_status} onChange={e => setForm(f=>({...f, invite_status: e.target.value}))}>
            <option value="pendente">Pendente</option>
            <option value="confirmado">Confirmado</option>
            <option value="recusado">Recusado</option>
          </select>
        </label>
        <label className="block">
          <span className="label">Família / Grupo</span>
          <select className="input" value={form.group_id} onChange={e => setForm(f=>({...f, group_id: e.target.value}))}>
            <option value="">Sem família</option>
            {groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </label>
        <label className="col-span-full block">
          <span className="label">Restrição alimentar</span>
          <input className="input" value={form.food_restriction}
            onChange={e => setForm(f=>({...f, food_restriction: e.target.value}))} placeholder="Ex: Vegetariano..."/>
        </label>
        <label className="col-span-full block">
          <span className="label">Observações</span>
          <textarea className="input min-h-20 resize-y" value={form.notes}
            onChange={e => setForm(f=>({...f, notes: e.target.value}))}/>
        </label>
      </div>
      <div className="flex justify-end gap-2 border-t border-stone-100 pt-4">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
        <button type="submit" disabled={saving} className="btn-primary bg-event-rose hover:bg-[#9F5965] disabled:opacity-50">
          {saving ? 'Salvando...' : 'Salvar alterações'}
        </button>
      </div>
    </form>
  );
}

// ─── IndividualGuestForm — LOCAL STATE ───────────────────────────────────────────

function IndividualGuestForm({ groups, onSave, onClose, onBack }: {
  groups: GuestGroup[];
  onSave: (f: GuestFormData) => Promise<void>;
  onClose: () => void;
  onBack: () => void;
}) {
  const [form, setForm] = useState<GuestFormData>(() => ({ ...BLANK }));
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try { await onSave(form); }
    finally { setSaving(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <button type="button" onClick={onBack} className="text-xs text-stone-400 hover:text-stone-600">← Voltar</button>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label">Nome completo *</span>
          <input className="input" required autoFocus value={form.full_name}
            onChange={e => setForm(f=>({...f, full_name: e.target.value}))} placeholder="Ex: João Silva"/>
        </label>
        <label className="block">
          <span className="label">Telefone</span>
          <input className="input" inputMode="tel" value={form.phone}
            onChange={e => setForm(f=>({...f, phone: maskPhone(e.target.value)}))} placeholder="(00) 00000-0000"/>
        </label>
        <label className="block">
          <span className="label">Tipo</span>
          <select className="input" value={form.guest_type} onChange={e => setForm(f=>({...f, guest_type: e.target.value}))}>
            {GUEST_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="label">Família / Grupo</span>
          <select className="input" value={form.group_id} onChange={e => setForm(f=>({...f, group_id: e.target.value}))}>
            <option value="">Sem família</option>
            {groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </label>
        <label className="col-span-full block">
          <span className="label">Observações</span>
          <textarea className="input min-h-20 resize-y" value={form.notes}
            onChange={e => setForm(f=>({...f, notes: e.target.value}))}/>
        </label>
      </div>
      <div className="flex justify-end gap-2 border-t border-stone-100 pt-4">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
        <button type="submit" disabled={saving} className="btn-primary bg-event-rose hover:bg-[#9F5965] disabled:opacity-50">
          <UserPlus size={14}/>{saving ? 'Salvando...' : 'Adicionar convidado'}
        </button>
      </div>
    </form>
  );
}

// ─── FamilyForm — LOCAL STATE ────────────────────────────────────────────────────

function FamilyForm({ onSave, onClose, onBack }: {
  onSave: (responsible: {name:string; phone:string}, dependents: DependentEntry[]) => Promise<void>;
  onClose: () => void;
  onBack: () => void;
}) {
  const [resp, setResp]   = useState({ name: '', phone: '' });
  const [deps, setDeps]   = useState<DependentEntry[]>([]);
  const [saving, setSaving] = useState(false);

  function addDep()           { setDeps(prev => [...prev, newDep()]); }
  function removeDep(id:string){ setDeps(prev => prev.filter(d => d.id !== id)); }
  function updateDep(id: string, field: keyof DependentEntry, val: string) {
    setDeps(prev => prev.map(d =>
      d.id === id ? { ...d, [field]: field === 'phone' ? maskPhone(val) : val } : d
    ));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!resp.name.trim()) return;
    setSaving(true);
    try { await onSave(resp, deps); }
    finally { setSaving(false); }
  }

  const preview = resp.name.trim() ? familyName(resp.name) : 'Família';
  const total   = 1 + deps.filter(d => d.name.trim()).length;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <button type="button" onClick={onBack} className="text-xs text-stone-400 hover:text-stone-600">← Voltar</button>

      {/* Responsável */}
      <section className="space-y-3 rounded-xl border border-stone-200 bg-stone-50 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500">Responsável</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="label">Nome completo *</span>
            <input className="input bg-white" required autoFocus value={resp.name}
              onChange={e => setResp(r=>({...r, name: e.target.value}))} placeholder="Ex: João Silva"/>
          </label>
          <label className="block">
            <span className="label">Telefone</span>
            <input className="input bg-white" inputMode="tel" value={resp.phone}
              onChange={e => setResp(r=>({...r, phone: maskPhone(e.target.value)}))} placeholder="(00) 00000-0000"/>
          </label>
        </div>
      </section>

      {/* Dependentes */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
          Dependentes ({deps.length})
        </h3>

        {deps.length > 0 && (
          <div className="space-y-2">
            {deps.map((dep, i) => (
              <div key={dep.id} className="grid grid-cols-[1fr_auto] gap-2 rounded-xl border border-stone-200 bg-stone-50 p-3">
                <div className="grid gap-2 sm:grid-cols-3">
                  <label className="block sm:col-span-2">
                    <span className="label">Nome completo</span>
                    <input className="input bg-white" placeholder={`Dependente ${i+1}`}
                      value={dep.name} onChange={e => updateDep(dep.id,'name',e.target.value)}/>
                  </label>
                  <label className="block">
                    <span className="label">Tipo</span>
                    <select className="input bg-white" value={dep.guest_type}
                      onChange={e => updateDep(dep.id,'guest_type',e.target.value)}>
                      {GUEST_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </label>
                  <label className="block sm:col-span-3">
                    <span className="label">Telefone (opcional)</span>
                    <input className="input bg-white" inputMode="tel" placeholder="(00) 00000-0000"
                      value={dep.phone} onChange={e => updateDep(dep.id,'phone',e.target.value)}/>
                  </label>
                </div>
                <button type="button" onClick={()=>removeDep(dep.id)}
                  className="mt-5 flex h-8 w-8 self-start items-center justify-center rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600">
                  <X size={14}/>
                </button>
              </div>
            ))}
          </div>
        )}

        <button type="button" onClick={addDep}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-stone-300 py-3 text-xs font-semibold text-stone-500 hover:border-stone-400 hover:bg-stone-50 hover:text-stone-700">
          <Plus size={14}/> Adicionar dependente
        </button>
      </section>

      {/* Preview */}
      {resp.name.trim() && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-xs font-semibold text-emerald-700">Será criada automaticamente: <strong>{preview}</strong></p>
          <p className="mt-1 text-xs text-emerald-600">{total} membro{total!==1?'s':''} cadastrado{total!==1?'s':''}</p>
        </div>
      )}

      <div className="flex justify-end gap-2 border-t border-stone-100 pt-4">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
        <button type="submit" disabled={saving || !resp.name.trim()}
          className="btn-primary bg-event-rose hover:bg-[#9F5965] disabled:opacity-50">
          <Users size={14}/>{saving ? 'Salvando...' : 'Criar família'}
        </button>
      </div>
    </form>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────────

export default function Guests() {
  const guests = useWeddingTable<Guest>('guests', 'full_name');
  const groups = useWeddingTable<GuestGroup>('guest_groups', 'name');

  // Modal state
  const [open, setOpen]         = useState(false);
  const [editing, setEditing]   = useState<Guest | null>(null);
  const [regStep, setRegStep]   = useState<RegistrationStep>('choose');
  const [detailGuestId, setDetailGuestId] = useState<string | null>(null);

  // Confirm dialogs
  const [deleting, setDeleting] = useState<Guest | null>(null);
  const [refusing, setRefusing] = useState<Guest | null>(null);

  // Filters
  const [search, setSearch]     = useState('');
  const [primary, setPrimary]   = useState<PrimaryFilter>('all');
  const [groupFilter, setGroupFilter] = useState('');
  const [sec, setSec]           = useState<SecondaryFilters>({ ...SEC_BLANK });
  const [showSec, setShowSec]   = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  const secRef = useRef<HTMLDivElement>(null);

  // Close secondary filters when clicking outside
  useEffect(() => {
    if (!showSec) return;
    function handle(e: MouseEvent) {
      if (secRef.current && !secRef.current.contains(e.target as Node)) setShowSec(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [showSec]);

  // Lookup maps
  const groupById = useMemo(() => new Map(groups.rows.map(g=>[g.id,g.name])), [groups.rows]);
  const groupByIdFull = useMemo(() => new Map(groups.rows.map(g=>[g.id,g])), [groups.rows]);

  // Stats
  const stats = useMemo(() => ({
    total:     guests.rows.length,
    confirmed: guests.rows.filter(g=>g.invite_status==='confirmado').length,
    pending:   guests.rows.filter(g=>isPending(g.invite_status)).length,
    refused:   guests.rows.filter(g=>g.invite_status==='recusado').length,
  }), [guests.rows]);

  const activeSecCount = Object.values(sec).filter(Boolean).length;

  // Filtered
  const filtered = useMemo(() => {
    return guests.rows.filter(g => {
      const fName = groupById.get(g.group_id ?? '') ?? '';
      const s = norm(search);
      if (s && !norm(`${g.full_name} ${g.phone ?? ''} ${fName}`).includes(s)) return false;
      if (groupFilter && g.group_id !== groupFilter) return false;
      if (primary === 'confirmed' && g.invite_status !== 'confirmado') return false;
      if (primary === 'pending'   && !isPending(g.invite_status)) return false;
      if (primary === 'refused'   && g.invite_status !== 'recusado') return false;
      if (sec.families    && !g.group_id)  return false;
      if (sec.individuals &&  g.group_id)  return false;
      return true;
    });
  }, [guests.rows, search, groupFilter, primary, sec, groupById]);

  // Grouped
  const grouped = useMemo(() => {
    const ids = new Set(filtered.map(g=>g.id));
    const withFamily: { group: GuestGroup; members: Guest[] }[] = [];
    const noFamily: Guest[] = [];
    for (const grp of groups.rows) {
      const members = guests.rows
        .filter(g => g.group_id===grp.id && ids.has(g.id))
        .sort((a,b) => {
          const aH = grp.responsible_name && norm(a.full_name)===norm(grp.responsible_name);
          const bH = grp.responsible_name && norm(b.full_name)===norm(grp.responsible_name);
          if (aH && !bH) return -1;
          if (!aH && bH) return 1;
          return a.full_name.localeCompare(b.full_name,'pt-BR',{sensitivity:'base'});
        });
      if (members.length) withFamily.push({ group: grp, members });
    }
    for (const g of filtered) if (!g.group_id) noFamily.push(g);
    return { withFamily, noFamily };
  }, [filtered, groups.rows, guests.rows]);

  function toggleGroup(id: string) {
    setExpandedGroups(prev => ({ ...prev, [id]: !(prev[id] ?? false) }));
    setOpenActionId(null);
  }

  const tableSections = useMemo(() => {
    const sections: { key: string; label: string; group?: GuestGroup; rows: Guest[] }[] = grouped.withFamily.map(({ group, members }) => ({
      key: group.id,
      label: group.name,
      group,
      rows: members,
    }));
    if (grouped.noFamily.length) {
      sections.push({
        key: '__individuals',
        label: 'Individuais',
        rows: grouped.noFamily,
      });
    }
    return sections;
  }, [grouped]);

  // Modal helpers
  function openNew()  { setDetailGuestId(null); setEditing(null); setRegStep('choose'); setOpen(true); }
  function openEdit(row: Guest) { setDetailGuestId(null); setEditing(row); setOpen(true); }
  function closeModal() { setOpen(false); setEditing(null); }

  // Save handlers (passed to self-contained form components)
  async function handleSaveEdit(form: GuestFormData) {
    if (!editing) return;
    await guests.update(editing.id, {
      ...form,
      group_id: form.group_id || null,
      companions: 0,
    } as Partial<Guest>);
    closeModal();
  }

  async function handleSaveIndividual(form: GuestFormData) {
    await guests.create({
      ...form,
      group_id: form.group_id || null,
      companions: 0,
      gift_received: false,
    } as Partial<Guest>);
    closeModal();
  }

  async function handleSaveFamily(resp: {name:string;phone:string}, deps: DependentEntry[]) {
    const grpName = familyName(resp.name);
    const newGroup = await groups.create({
      name:             grpName,
      side:             '',
      responsible_name: resp.name.trim(),
      responsible_phone: resp.phone || null,
      notes:            null,
    } as Partial<GuestGroup>);

    await guests.create({
      full_name: resp.name.trim(), phone: resp.phone||null,
      group_id: newGroup.id, guest_type:'adulto', invite_status:'pendente',
      companions:0, food_restriction:null, notes:null, gift_received:false,
    } as Partial<Guest>);

    for (const dep of deps) {
      if (!dep.name.trim()) continue;
      await guests.create({
        full_name: dep.name.trim(), phone: dep.phone||null,
        group_id: newGroup.id, guest_type: dep.guest_type, invite_status:'pendente',
        companions:0, food_restriction:null, notes:null, gift_received:false,
      } as Partial<Guest>);
    }
    closeModal();
  }

  async function handleConfirm(id: string) {
    await guests.update(id, { invite_status: 'confirmado' });
  }

  async function handleConfirmDelete() {
    if (!deleting) return;
    await guests.remove(deleting.id);
    if (detailGuestId === deleting.id) setDetailGuestId(null);
    setDeleting(null);
  }

  async function handleConfirmRefuse() {
    if (!refusing) return;
    await guests.update(refusing.id, { invite_status: 'recusado' });
    setRefusing(null);
  }

  // Modal title
  const modalTitle = editing
    ? `Editar — ${editing.full_name}`
    : regStep==='choose' ? 'Novo Cadastro'
    : regStep==='individual' ? 'Convidado Individual'
    : 'Cadastrar Família';

  const editInitial: GuestFormData = editing ? {
    full_name: editing.full_name,
    phone: editing.phone ?? '',
    group_id: editing.group_id ?? '',
    guest_type: editing.guest_type,
    invite_status: editing.invite_status,
    food_restriction: editing.food_restriction ?? '',
    notes: editing.notes ?? '',
  } : { ...BLANK };

  const detailGuest = useMemo(
    () => guests.rows.find(guest => guest.id === detailGuestId) ?? null,
    [detailGuestId, guests.rows]
  );
  const detailGroup = detailGuest?.group_id ? groupByIdFull.get(detailGuest.group_id) ?? null : null;
  const detailFamilyMembers = useMemo(() => {
    if (!detailGuest) return [];
    if (!detailGuest.group_id) return [detailGuest];
    return guests.rows
      .filter(guest => guest.group_id === detailGuest.group_id)
      .sort((a,b) => {
        const aH = detailGroup?.responsible_name && norm(a.full_name) === norm(detailGroup.responsible_name);
        const bH = detailGroup?.responsible_name && norm(b.full_name) === norm(detailGroup.responsible_name);
        if (aH && !bH) return -1;
        if (!aH && bH) return 1;
        return a.full_name.localeCompare(b.full_name,'pt-BR',{sensitivity:'base'});
      });
  }, [detailGuest, detailGroup, guests.rows]);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 text-event-text">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title text-event-text">Convidados</h1>
          <p className="mt-1 text-sm text-stone-500">Gerencie convidados, famílias e confirmações.</p>
        </div>
        <button type="button" onClick={openNew}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-event-rose px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#9F5965]">
          <Plus size={15}/> Novo Convidado
        </button>
      </div>

      {/* ── Main KPIs ── */}
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard label="Total de Convidados" value={stats.total} icon={<Users size={16}/>} tone="neutral"
          active={primary==='all'} onClick={()=>setPrimary('all')}/>
        <KpiCard label="Confirmados" value={stats.confirmed} icon={<UserCheck size={16}/>} tone="success"
          active={primary==='confirmed'} onClick={()=>setPrimary('confirmed')}/>
        <KpiCard label="Pendentes" value={stats.pending} icon={<HelpCircle size={16}/>} tone="warning"
          active={primary==='pending'} onClick={()=>setPrimary('pending')}/>
        <KpiCard label="Recusados" value={stats.refused} icon={<UserMinus size={16}/>} tone="danger"
          active={primary==='refused'} onClick={()=>setPrimary('refused')}/>
      </section>

      {/* ── Search + Filter bar ── */}
      <section className="flex flex-col gap-2 rounded-xl border border-stone-200 bg-white p-2.5 shadow-sm lg:flex-row lg:items-center">
        {/* Search */}
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={15}/>
          <input
            className="w-full rounded-lg border border-stone-200 bg-stone-50 py-1.5 pl-9 pr-8 text-sm text-event-text outline-none transition placeholder:text-stone-400 focus:border-stone-400 focus:bg-white focus:ring-2 focus:ring-stone-200"
            value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Buscar convidado, telefone ou família..."/>
          {search && (
            <button type="button" onClick={()=>setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-stone-400 hover:text-stone-600">
              <X size={13}/>
            </button>
          )}
        </div>

        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] lg:flex lg:items-center lg:justify-end">
          <label className="relative">
            <select className="h-8 w-full appearance-none rounded-lg border border-stone-200 bg-white pl-3 pr-8 text-xs font-medium text-stone-600 outline-none transition hover:border-stone-300 focus:border-stone-400 focus:ring-2 focus:ring-stone-200"
              value={groupFilter} onChange={e=>setGroupFilter(e.target.value)}>
              <option value="">Família</option>
              {groups.rows.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
            </select>
            <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400"/>
          </label>

          <div className="flex h-8 rounded-lg border border-stone-200 bg-stone-50 p-0.5">
            <button type="button" onClick={()=>setViewMode('cards')}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition ${
                viewMode==='cards' ? 'bg-white text-event-text shadow-sm' : 'text-stone-500 hover:text-stone-700'
              }`}>
              <LayoutGrid size={13}/> Cards
            </button>
            <button type="button" onClick={()=>setViewMode('table')}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold transition ${
                viewMode==='table' ? 'bg-white text-event-text shadow-sm' : 'text-stone-500 hover:text-stone-700'
              }`}>
              <Table2 size={13}/> Tabela
            </button>
          </div>

          <div className="relative" ref={secRef}>
            <button type="button" onClick={()=>setShowSec(v=>!v)}
              className={`relative flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition ${
                activeSecCount>0 || showSec
                  ? 'border-event-rose bg-event-rose text-white'
                  : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300'
              }`}>
              <Filter size={11}/>
              Filtros Avançados
              {activeSecCount>0 && (
                <span className="ml-0.5 rounded-full bg-white/25 px-1.5 text-[10px] font-bold leading-5 text-white">
                  {activeSecCount}
                </span>
              )}
              <ChevronDown size={11} className={`transition-transform ${showSec?'rotate-180':''}`}/>
            </button>

            {showSec && (
              <div className="absolute right-0 top-[calc(100%+0.5rem)] z-20 w-52 rounded-xl border border-stone-200 bg-white p-3 shadow-lg">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-stone-400">Filtros adicionais</p>
                {([
                  { key:'families'    as keyof SecondaryFilters, label:'Apenas Famílias'    },
                  { key:'individuals' as keyof SecondaryFilters, label:'Apenas Individuais' },
                ] as const).map(({ key, label }) => (
                  <label key={key} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-sm text-stone-700 hover:bg-stone-50">
                    <input type="checkbox" className="h-4 w-4 rounded accent-stone-800"
                      checked={sec[key]} onChange={e=>setSec(s=>({...s,[key]:e.target.checked}))}/>
                    {label}
                  </label>
                ))}
                {activeSecCount>0 && (
                  <button type="button" onClick={()=>setSec({...SEC_BLANK})}
                    className="mt-2 w-full rounded-lg py-1.5 text-xs text-stone-500 hover:bg-stone-50 hover:text-stone-700">
                    Limpar filtros
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Result count */}
      <p className="text-xs text-stone-400">
        {filtered.length===0 ? 'Nenhum convidado encontrado'
          : `${filtered.length} convidado${filtered.length!==1?'s':''}`}
      </p>

      {/* ── Guest list ── */}
      {filtered.length > 0 ? (
        viewMode === 'table' ? (
          <GuestTable
            sections={tableSections}
            groupById={groupById}
            allGuests={guests.rows}
            onEdit={openEdit}
            onDelete={setDeleting}
            onRefuse={setRefusing}
            onConfirm={handleConfirm}/>
        ) : (
        <div className="space-y-8">
          {grouped.withFamily.map(({group, members}) => {
            const openGroup = expandedGroups[group.id] ?? false;
            return (
            <div key={group.id} className="space-y-3">
              <FamilyGroupHeader name={group.name} count={members.length} open={openGroup} onToggle={()=>toggleGroup(group.id)}/>
              {openGroup && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {members.map(row => (
                  <GuestCard key={row.id} row={row}
                    group={group}
                    familyLabel={groupById.get(row.group_id??'')??null}
                    allGuests={guests.rows}
                    actionOpen={openActionId===row.id}
                    onToggleActions={()=>setOpenActionId(openActionId===row.id ? null : row.id)}
                    onOpenDetails={(guest)=>setDetailGuestId(guest.id)}
                    onEdit={openEdit} onDelete={setDeleting}
                    onRefuse={setRefusing} onConfirm={handleConfirm}/>
                ))}
              </div>
              )}
            </div>
            );
          })}
          {grouped.noFamily.length > 0 && (() => {
            const openGroup = expandedGroups.__individuals ?? true;
            return (
            <div className="space-y-3">
              <FamilyGroupHeader name="Individuais" count={grouped.noFamily.length} open={openGroup} onToggle={()=>toggleGroup('__individuals')}/>
              {openGroup && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {grouped.noFamily.map(row => (
                  <GuestCard key={row.id} row={row}
                    group={null}
                    familyLabel={null}
                    allGuests={guests.rows}
                    actionOpen={openActionId===row.id}
                    onToggleActions={()=>setOpenActionId(openActionId===row.id ? null : row.id)}
                    onOpenDetails={(guest)=>setDetailGuestId(guest.id)}
                    onEdit={openEdit} onDelete={setDeleting}
                    onRefuse={setRefusing} onConfirm={handleConfirm}/>
                ))}
              </div>
              )}
            </div>
            );
          })()}
        </div>
        )
      ) : (
        <GuestEmptyState onAdd={openNew}/>
      )}

      {/* ── Modal ── */}
      <Modal open={open} title={modalTitle} onClose={closeModal}>
        {editing ? (
          <EditGuestForm
            initial={editInitial}
            groups={groups.rows}
            onSave={handleSaveEdit}
            onClose={closeModal}/>
        ) : regStep==='choose' ? (
          <ChooseRegistrationType
            onIndividual={()=>setRegStep('individual')}
            onFamily={()=>setRegStep('family')}/>
        ) : regStep==='individual' ? (
          <IndividualGuestForm
            groups={groups.rows}
            onSave={handleSaveIndividual}
            onClose={closeModal}
            onBack={()=>setRegStep('choose')}/>
        ) : (
          <FamilyForm
            onSave={handleSaveFamily}
            onClose={closeModal}
            onBack={()=>setRegStep('choose')}/>
        )}
      </Modal>

      {/* ── Confirm delete ── */}
      <GuestDetailsModal
        guest={detailGuest}
        group={detailGroup}
        familyMembers={detailFamilyMembers}
        allGuests={guests.rows}
        onClose={()=>setDetailGuestId(null)}
        onEdit={openEdit}
        onDelete={setDeleting}
        onRefuse={setRefusing}
        onConfirm={handleConfirm}/>

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Excluir convidado"
        message={`Deseja excluir ${deleting?.full_name??'este convidado'}? Esta ação não pode ser desfeita.`}
        onCancel={()=>setDeleting(null)}
        onConfirm={handleConfirmDelete}/>

      {/* ── Confirm refuse ── */}
      <ConfirmDialog
        open={Boolean(refusing)}
        title="Marcar como recusado"
        message={`Deseja marcar ${refusing?.full_name??'este convidado'} como recusado?`}
        onCancel={()=>setRefusing(null)}
        onConfirm={handleConfirmRefuse}/>
    </div>
  );
}
