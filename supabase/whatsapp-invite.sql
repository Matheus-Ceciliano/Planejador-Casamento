-- ============================================================
-- Migration: WhatsApp Invite — campos RSVP e controle de envio
-- ============================================================
-- Adiciona campos de RSVP e controle de envio às tabelas
-- guest_groups e guests. Usa IF NOT EXISTS para ser idempotente.
-- RLS herdado das policies já existentes em schema.sql.
--
-- Novos campos em guest_groups:
--   rsvp_token        — token único por família para link de confirmação
--   invite_sent_at    — primeira vez que o convite foi enviado à família
--   last_invite_sent_at — última vez que o convite foi enviado à família
--
-- Novos campos em guests:
--   rsvp_token        — token único individual para link de confirmação
--   invite_sent_at    — quando o convite foi enviado a este convidado
-- ============================================================

alter table public.guest_groups
  add column if not exists rsvp_token        text unique,
  add column if not exists invite_sent_at    timestamptz,
  add column if not exists last_invite_sent_at timestamptz;

alter table public.guests
  add column if not exists rsvp_token text unique,
  add column if not exists invite_sent_at timestamptz;

-- Índice para buscas por token (usado na futura página pública de RSVP)
create unique index if not exists guest_groups_rsvp_token_idx
  on public.guest_groups (rsvp_token)
  where rsvp_token is not null;

create unique index if not exists guests_rsvp_token_idx
  on public.guests (rsvp_token)
  where rsvp_token is not null;
