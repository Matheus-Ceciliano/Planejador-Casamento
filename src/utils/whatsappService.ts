/**
 * whatsappService.ts
 *
 * Serviço de envio de convites via WhatsApp.
 * Atualmente usa links wa.me (sem API oficial).
 *
 * Estrutura preparada para futura integração com
 * WhatsApp Business API — basta adicionar sendViaWhatsAppBusinessApi().
 */

// ─────────────────────────────────────────────────────────────
// Phone helpers
// ─────────────────────────────────────────────────────────────

/**
 * Remove caracteres não numéricos e adiciona DDI 55 (Brasil) se ausente.
 */
export function normalizePhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  return digits.startsWith('55') ? digits : `55${digits}`;
}

// ─────────────────────────────────────────────────────────────
// RSVP token & link
// ─────────────────────────────────────────────────────────────

/**
 * Gera um token único usando crypto.randomUUID().
 * Seguro o suficiente para uso como token de RSVP.
 */
export function generateRsvpToken(): string {
  return crypto.randomUUID();
}

/**
 * Constrói o link de RSVP para uma família.
 * O site público ainda não existe, mas o link já fica salvo para uso futuro.
 */
export function buildRsvpLink(token: string): string {
  return `${window.location.origin}/rsvp/familia/${token}`;
}

// ─────────────────────────────────────────────────────────────
// Message builder
// ─────────────────────────────────────────────────────────────

export type MessageVars = {
  nome?: string;
  familia?: string;
  link_confirmacao?: string;
  nome_noivo?: string;
  nome_noiva?: string;
  data_casamento?: string;
};

/**
 * Substitui as variáveis {nome}, {familia}, etc. na mensagem template.
 */
export function buildWhatsAppMessage(template: string, vars: MessageVars): string {
  return template
    .replace(/\{nome\}/g, vars.nome ?? '')
    .replace(/\{familia\}/g, vars.familia ?? '')
    .replace(/\{link_confirmacao\}/g, vars.link_confirmacao ?? '')
    .replace(/\{nome_noivo\}/g, vars.nome_noivo ?? '')
    .replace(/\{nome_noiva\}/g, vars.nome_noiva ?? '')
    .replace(/\{data_casamento\}/g, vars.data_casamento ?? '');
}

// ─────────────────────────────────────────────────────────────
// Link builder
// ─────────────────────────────────────────────────────────────

/**
 * Monta o link wa.me com a mensagem codificada.
 * Abre o WhatsApp no mobile ou WhatsApp Web no desktop.
 */
export function buildWhatsAppLink(phone: string, message: string): string {
  const number = normalizePhoneNumber(phone);
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${number}?text=${encoded}`;
}

export function buildWhatsAppChatLink(phone: string): string {
  const number = normalizePhoneNumber(phone);
  return number ? `https://wa.me/${number}` : '';
}

/**
 * Abre o link do WhatsApp em nova aba.
 * Retorna o link gerado para log/referência.
 */
export function sendViaWhatsAppLink(phone: string, message: string): string {
  const link = buildWhatsAppLink(phone, message);
  window.open(link, '_blank', 'noopener,noreferrer');
  return link;
}

// ─────────────────────────────────────────────────────────────
// Default message template
// ─────────────────────────────────────────────────────────────

export const DEFAULT_MESSAGE_TEMPLATE = `Olá, {nome}! 💛

Com muita alegria, convidamos você para o nosso casamento.

Será um momento muito especial para nós e queremos muito ter você conosco.

Por favor, confirme sua presença pelo link abaixo:

{link_confirmacao}

Com carinho,
{nome_noiva} & {nome_noivo}`;

// ─────────────────────────────────────────────────────────────
// Future: WhatsApp Business API
// ─────────────────────────────────────────────────────────────
//
// async function sendViaWhatsAppBusinessApi(
//   phone: string,
//   templateName: string,
//   vars: MessageVars
// ): Promise<void> {
//   // Implementar quando a API oficial estiver disponível
//   throw new Error('WhatsApp Business API não implementada ainda.');
// }
