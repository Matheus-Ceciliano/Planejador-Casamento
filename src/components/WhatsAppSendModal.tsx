import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  MessageSquare,
  Phone,
  SkipForward,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useWedding } from '../hooks/useWedding';
import { Guest, GuestGroup } from '../types';
import { retainModalLayer } from '../utils/modalLayer';
import {
  DEFAULT_MESSAGE_TEMPLATE,
  buildRsvpLink,
  buildWhatsAppMessage,
  generateRsvpToken,
  normalizePhoneNumber,
  sendViaWhatsAppLink,
} from '../utils/whatsappService';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type WhatsAppRecipient = {
  /** ID único para controle da fila */
  key: string;
  /** Nome exibido na fila */
  displayName: string;
  /** Telefone para envio */
  phone: string | null;
  /** Variáveis para substituição na mensagem */
  nome: string;
  familia: string | null;
  /** ID do grupo para atualizar rsvp_token + invite_sent_at */
  groupId: string | null;
  /** Token RSVP atual (pode ser null se ainda não gerado) */
  rsvpToken: string | null;
  /** IDs dos guests envolvidos (para marcar invite_sent_at) */
  guestIds: string[];
};

type Step = 'preview' | 'queue' | 'done';

type Props = {
  open: boolean;
  guests: Guest[];
  groups: GuestGroup[];
  selectedGuestIds: Set<string>;
  onClose: () => void;
  onUpdateGroup: (id: string, payload: Partial<GuestGroup>) => Promise<GuestGroup>;
  onUpdateGuest: (id: string, payload: Partial<Guest>) => Promise<Guest>;
};

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function formatDate(isoDate: string | null | undefined): string {
  if (!isoDate) return '';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
    new Date(isoDate)
  );
}

function buildRecipients(
  selectedIds: Set<string>,
  guests: Guest[],
  groups: GuestGroup[]
): WhatsAppRecipient[] {
  const groupMap = new Map(groups.map((g) => [g.id, g]));
  const selectedGuests = guests.filter((g) => selectedIds.has(g.id));

  function normalizeText(value: string | null | undefined) {
    return (value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  }

  function responsiblePhone(group: GuestGroup) {
    return (
      group.responsible_phone ||
      guests.find((guest) => guest.group_id === group.id && normalizeText(guest.full_name) === normalizeText(group.responsible_name))?.phone ||
      null
    );
  }

  // Group guests by family — if they have a group_id
  const familyMap = new Map<string, { group: GuestGroup; guests: Guest[] }>();
  const individualGuests: Guest[] = [];

  for (const guest of selectedGuests) {
    if (guest.group_id) {
      const group = groupMap.get(guest.group_id);
      if (group) {
        if (!familyMap.has(group.id)) {
          familyMap.set(group.id, { group, guests: [] });
        }
        familyMap.get(group.id)!.guests.push(guest);
      } else {
        individualGuests.push(guest);
      }
    } else {
      individualGuests.push(guest);
    }
  }

  const recipients: WhatsAppRecipient[] = [];

  // Family recipients (use responsible_phone, else first guest with phone)
  for (const { group, guests: guestList } of familyMap.values()) {
    const phone =
      responsiblePhone(group) ||
      guestList.find((g) => g.phone)?.phone ||
      guests.find((g) => g.group_id === group.id && g.phone)?.phone ||
      null;
    recipients.push({
      key: `group-${group.id}`,
      displayName: `Família ${group.name}`,
      phone,
      nome: `família ${group.name}`,
      familia: group.name,
      groupId: group.id,
      rsvpToken: group.rsvp_token,
      guestIds: guestList.map((g) => g.id),
    });
  }

  // Individual recipients (not in a family)
  for (const guest of individualGuests) {
    recipients.push({
      key: `guest-${guest.id}`,
      displayName: guest.full_name,
      phone: guest.phone,
      nome: guest.full_name,
      familia: null,
      groupId: null,
      rsvpToken: null,
      guestIds: [guest.id],
    });
  }

  return recipients;
}

// ─────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────

export default function WhatsAppSendModal({
  open,
  guests,
  groups,
  selectedGuestIds,
  onClose,
  onUpdateGroup,
  onUpdateGuest,
}: Props) {
  const { wedding } = useWedding();

  const [step, setStep] = useState<Step>('preview');
  const [template, setTemplate] = useState(DEFAULT_MESSAGE_TEMPLATE);
  const [queueIndex, setQueueIndex] = useState(0);
  const [sentCount, setSentCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [recipients, setRecipients] = useState<WhatsAppRecipient[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    return retainModalLayer();
  }, [open]);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setStep('preview');
      setQueueIndex(0);
      setSentCount(0);
      setSkippedCount(0);
      setRecipients(buildRecipients(selectedGuestIds, guests, groups));
    }
  }, [open, selectedGuestIds, guests, groups]);

  const noPhone = useMemo(
    () => recipients.filter((r) => !r.phone),
    [recipients]
  );
  const withPhone = useMemo(
    () => recipients.filter((r) => r.phone),
    [recipients]
  );

  const current = recipients[queueIndex] ?? null;

  // Build preview message for the current recipient
  function buildMessage(recipient: WhatsAppRecipient, token: string | null): string {
    const link = token ? buildRsvpLink(token) : `${window.location.origin}/rsvp (link em breve)`;
    return buildWhatsAppMessage(template, {
      nome: recipient.nome,
      familia: recipient.familia ?? recipient.nome,
      link_confirmacao: link,
      nome_noivo: wedding?.groom_name ?? 'Noivo',
      nome_noiva: wedding?.bride_name ?? 'Noiva',
      data_casamento: wedding?.wedding_date ? formatDate(wedding.wedding_date) : '',
    });
  }

  // Preview for first recipient with phone (in preview step)
  const previewRecipient = withPhone[0] ?? recipients[0] ?? null;
  const previewMessage = previewRecipient
    ? buildMessage(previewRecipient, previewRecipient.rsvpToken)
    : template;

  async function handleStartQueue() {
    setStep('queue');
    setQueueIndex(0);
  }

  async function handleOpenWhatsApp() {
    if (!current?.phone) return;

    // Ensure RSVP token exists for family recipients
    let token = current.rsvpToken;
    if (!token && current.groupId) {
      token = generateRsvpToken();
      try {
        await onUpdateGroup(current.groupId, { rsvp_token: token });
        setRecipients((prev) =>
          prev.map((r) => (r.key === current.key ? { ...r, rsvpToken: token } : r))
        );
      } catch {
        // Non-blocking — proceed with placeholder
      }
    }

    const message = buildMessage(current, token);
    sendViaWhatsAppLink(current.phone, message);

    // Mark invite as sent in DB
    const now = new Date().toISOString();
    try {
      if (current.groupId) {
        await onUpdateGroup(current.groupId, {
          invite_sent_at: current.rsvpToken ? undefined : now,
          last_invite_sent_at: now,
        });
      }
      for (const guestId of current.guestIds) {
        await onUpdateGuest(guestId, {
          invite_sent_at: now,
          invite_status: 'enviado',
        });
      }
    } catch {
      // Non-blocking
    }

    setSentCount((c) => c + 1);
  }

  function handleNext() {
    if (queueIndex >= recipients.length - 1) {
      setStep('done');
    } else {
      setQueueIndex((i) => i + 1);
    }
  }

  function handleSkip() {
    setSkippedCount((c) => c + 1);
    handleNext();
  }

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9998] flex items-stretch justify-center bg-slate-950/45 p-0 backdrop-blur-[8px] sm:items-center sm:p-4">
      <div className="relative z-[9999] flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-xl sm:h-auto sm:max-h-[92vh] sm:max-w-2xl sm:rounded-xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-[#E7E0D8] bg-[#FAF8F5] px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] sm:px-5 sm:py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#25D366]/15">
              <MessageSquare size={16} className="text-[#25D366]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#2D2A26] sm:text-base">
                {step === 'preview' && 'Enviar convites via WhatsApp'}
                {step === 'queue' && `Enviando — ${queueIndex + 1} de ${recipients.length}`}
                {step === 'done' && 'Envio concluído'}
              </h2>
              {step === 'queue' && (
                <p className="text-xs text-[#6F6760]">
                  {recipients[queueIndex]?.displayName}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            className="rounded-lg p-1.5 text-[#6F6760] hover:bg-[#E7E0D8] hover:text-[#2D2A26]"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto">

          {/* ── STEP 1: Preview ─────────────────────────────── */}
          {step === 'preview' && (
            <div className="space-y-4 p-4 sm:p-5">
              {/* Recipient list */}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-[#6F6760]">
                  {recipients.length} destinatário{recipients.length !== 1 ? 's' : ''}
                </p>
                <div className="mt-2 max-h-36 space-y-1.5 overflow-y-auto rounded-lg border border-[#E7E0D8] bg-[#FAF8F5] p-2.5">
                  {recipients.map((r) => (
                    <div key={r.key} className="flex items-center gap-2 text-sm">
                      <Phone size={13} className={r.phone ? 'text-[#25D366]' : 'text-rose-400'} />
                      <span className="font-medium text-[#2D2A26]">{r.displayName}</span>
                      {r.phone ? (
                        <span className="text-xs text-[#6F6760]">{r.phone}</span>
                      ) : (
                        <span className="text-xs font-semibold text-rose-500">sem telefone</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Warning: no phone */}
              {noPhone.length > 0 && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <span>
                    <strong>{noPhone.length}</strong> destinatário{noPhone.length !== 1 ? 's' : ''} sem telefone {noPhone.length !== 1 ? 'serão pulados' : 'será pulado'} automaticamente.
                  </span>
                </div>
              )}

              {/* Message template editor */}
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-[#6F6760]">
                  Mensagem (editável)
                </label>
                <textarea
                  ref={textareaRef}
                  className="w-full rounded-lg border border-[#E7E0D8] bg-white px-3 py-2.5 text-sm text-[#2D2A26] outline-none transition focus:border-[#B76E79] focus:ring-2 focus:ring-[#B76E79]/20"
                  rows={9}
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                />
                <p className="mt-1 text-xs text-[#6F6760]">
                  Variáveis disponíveis:{' '}
                  <code className="rounded bg-[#E7E0D8] px-1">{'{nome}'}</code>{' '}
                  <code className="rounded bg-[#E7E0D8] px-1">{'{familia}'}</code>{' '}
                  <code className="rounded bg-[#E7E0D8] px-1">{'{link_confirmacao}'}</code>{' '}
                  <code className="rounded bg-[#E7E0D8] px-1">{'{nome_noivo}'}</code>{' '}
                  <code className="rounded bg-[#E7E0D8] px-1">{'{nome_noiva}'}</code>{' '}
                  <code className="rounded bg-[#E7E0D8] px-1">{'{data_casamento}'}</code>
                </p>
              </div>

              {/* Preview */}
              {previewRecipient && (
                <div>
                  <p className="mb-1.5 text-xs font-bold uppercase tracking-widest text-[#6F6760]">
                    Prévia — {previewRecipient.displayName}
                  </p>
                  <div className="rounded-xl border border-[#E7E0D8] bg-[#FAF8F5] p-4">
                    <pre className="whitespace-pre-wrap text-sm leading-relaxed text-[#2D2A26]">
                      {previewMessage}
                    </pre>
                  </div>
                </div>
              )}

              {/* Disclaimer */}
              <div className="rounded-lg border border-[#E7E0D8] bg-white p-3 text-xs text-[#6F6760]">
                💬 O WhatsApp será aberto com a mensagem pronta para envio. Você precisará clicar em "Enviar" dentro do app.
              </div>
            </div>
          )}

          {/* ── STEP 2: Queue ───────────────────────────────── */}
          {step === 'queue' && current && (
            <div className="space-y-4 p-4 sm:p-5">
              {/* Progress bar */}
              <div>
                <div className="mb-1.5 flex items-center justify-between text-xs text-[#6F6760]">
                  <span>Mensagem {queueIndex + 1} de {recipients.length}</span>
                  <span>{sentCount} enviadas · {skippedCount} puladas</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[#E7E0D8]">
                  <div
                    className="h-full rounded-full bg-[#25D366] transition-all"
                    style={{ width: `${((queueIndex) / recipients.length) * 100}%` }}
                  />
                </div>
              </div>

              {/* Current recipient card */}
              <div className={`rounded-xl border p-4 ${current.phone ? 'border-[#25D366]/30 bg-[#25D366]/5' : 'border-amber-200 bg-amber-50'}`}>
                <div className="flex items-center gap-2.5">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-semibold ${current.phone ? 'bg-[#25D366]/20 text-[#1a9e4a]' : 'bg-amber-200 text-amber-700'}`}>
                    {current.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-[#2D2A26]">{current.displayName}</p>
                    {current.phone ? (
                      <p className="text-sm text-[#6F6760]">{current.phone}</p>
                    ) : (
                      <p className="text-sm font-semibold text-amber-600">Sem telefone cadastrado</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Message preview */}
              {current.phone && (
                <div className="rounded-xl border border-[#E7E0D8] bg-[#FAF8F5] p-4">
                  <p className="mb-2 text-xs font-bold uppercase tracking-widest text-[#6F6760]">Mensagem</p>
                  <pre className="whitespace-pre-wrap text-sm leading-relaxed text-[#2D2A26]">
                    {buildMessage(current, current.rsvpToken)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 3: Done ────────────────────────────────── */}
          {step === 'done' && (
            <div className="flex flex-col items-center justify-center px-4 py-12 text-center sm:p-12">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#25D366]/15">
                <CheckCircle2 size={32} className="text-[#25D366]" />
              </div>
              <h3 className="mt-4 text-xl font-semibold text-[#2D2A26]">Envio concluído!</h3>
              <p className="mt-2 text-[#6F6760]">
                <strong>{sentCount}</strong> {sentCount === 1 ? 'convite enviado' : 'convites enviados'}
                {skippedCount > 0 && ` · ${skippedCount} ${skippedCount === 1 ? 'pulado' : 'pulados'} (sem telefone)`}
              </p>
              <p className="mt-1 text-sm text-[#6F6760]">
                Os convidados foram marcados como "enviado" automaticamente.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-[#E7E0D8] bg-white px-4 pb-[calc(env(safe-area-inset-bottom)+0.6rem)] pt-3 sm:px-5 sm:py-4">
          {step === 'preview' && (
            <>
              <button
                type="button"
                className="btn-secondary border-[#E7E0D8] bg-white px-4 text-[#2D2A26]"
                onClick={onClose}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-primary bg-[#25D366] px-5 hover:bg-[#1da851]"
                onClick={handleStartQueue}
                disabled={recipients.length === 0}
              >
                <MessageSquare size={16} />
                Iniciar envio
              </button>
            </>
          )}

          {step === 'queue' && current && (
            <>
              <button
                type="button"
                className="btn-secondary border-[#E7E0D8] bg-white px-3 text-sm text-[#6F6760]"
                onClick={onClose}
              >
                Cancelar
              </button>
              <div className="flex gap-2">
                {!current.phone && (
                  <button
                    type="button"
                    className="btn-secondary border-amber-200 bg-amber-50 px-3 text-sm text-amber-700"
                    onClick={handleSkip}
                  >
                    <SkipForward size={15} />
                    Pular
                  </button>
                )}
                {current.phone && (
                  <>
                    <button
                      type="button"
                      className="btn-secondary border-[#E7E0D8] bg-white px-3 text-sm text-[#6F6760]"
                      onClick={handleSkip}
                    >
                      <SkipForward size={15} />
                      Pular
                    </button>
                    <button
                      type="button"
                      className="btn-primary bg-[#25D366] px-4 text-sm hover:bg-[#1da851]"
                      onClick={() => {
                        handleOpenWhatsApp();
                      }}
                    >
                      <MessageSquare size={15} />
                      Abrir WhatsApp
                    </button>
                  </>
                )}
                {/* Next button appears after "Abrir WhatsApp" is clicked or for no-phone items */}
                {(!current.phone) && (
                  <button
                    type="button"
                    className="btn-secondary border-[#E7E0D8] bg-white px-3 text-sm text-[#2D2A26]"
                    onClick={handleNext}
                  >
                    Próximo <ChevronRight size={14} />
                  </button>
                )}
              </div>
            </>
          )}

          {step === 'queue' && current?.phone && (
            <div className="flex w-full justify-end">
              <button
                type="button"
                className="btn-secondary border-[#E7E0D8] bg-white px-4 text-sm text-[#2D2A26]"
                onClick={handleNext}
              >
                Próximo <ChevronRight size={14} />
              </button>
            </div>
          )}

          {step === 'done' && (
            <button
              type="button"
              className="btn-primary ml-auto bg-[#B76E79] px-5"
              onClick={onClose}
            >
              Fechar
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
