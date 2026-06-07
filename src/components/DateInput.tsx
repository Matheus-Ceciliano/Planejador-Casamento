/**
 * DateInput — wrapper de compatibilidade.
 * Re-exporta AppDateInput.
 * API original: { label: string; value: string; onChange: (value: string) => void }
 */
import AppDateInput from './ui/AppDateInput';

export default function DateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <AppDateInput
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
