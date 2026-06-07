const map: Record<string, string> = {
  confirmado:  'bg-[#F0FDF4] text-[#16A34A]',
  pago:        'bg-[#F0FDF4] text-[#16A34A]',
  contratado:  'bg-[#F0FDF4] text-[#16A34A]',
  recusado:    'bg-[#FEF2F2] text-[#DC2626]',
  vencido:     'bg-[#FEF2F2] text-[#DC2626]',
  atrasada:    'bg-[#FEF2F2] text-[#DC2626]',
  pendente:    'bg-[#FFFBEB] text-[#D97706]',
  enviado:     'bg-[#EFF6FF] text-[#2563EB]',
  favorito:    'bg-[#FFF1F5] text-[#E11D48]',
  'em negociação': 'bg-[#FFFBEB] text-[#D97706]',
  cancelado:   'bg-[#F4F4F5] text-[#71717A]',
};

export default function StatusBadge({ status }: { status: string }) {
  const classes = map[status?.toLowerCase()] ?? 'bg-[#F4F4F5] text-[#71717A]';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${classes}`}>
      {status}
    </span>
  );
}
