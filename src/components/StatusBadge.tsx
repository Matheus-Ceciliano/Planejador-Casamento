const map: Record<string, string> = {
  confirmado: 'bg-olivew/15 text-olivew',
  pago: 'bg-olivew/15 text-olivew',
  contratado: 'bg-olivew/15 text-olivew',
  recusado: 'bg-red-50 text-red-600',
  vencido: 'bg-red-50 text-red-600',
  atrasada: 'bg-red-50 text-red-600',
  pendente: 'bg-champagne text-stone-700',
  enviado: 'bg-blue-50 text-blue-600',
  favorito: 'bg-rosew-100 text-rosew-500'
};

export default function StatusBadge({ status }: { status: string }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${map[status] ?? 'bg-stone-100 text-stone-600'}`}>{status}</span>;
}
