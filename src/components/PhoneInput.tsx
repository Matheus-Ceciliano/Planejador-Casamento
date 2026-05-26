import FormInput from './FormInput';

function maskPhone(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 10) return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').trim();
  return digits.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').trim();
}

export default function PhoneInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <FormInput label={label} value={value} onChange={(event) => onChange(maskPhone(event.target.value))} placeholder="(00) 00000-0000" />;
}
