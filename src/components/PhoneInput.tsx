/**
 * PhoneInput — wrapper de compatibilidade.
 * Re-exporta AppPhoneInput.
 * API original: { label: string; value: string; onChange: (value: string) => void }
 */
import AppPhoneInput from './ui/AppPhoneInput';

export default function PhoneInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return <AppPhoneInput label={label} value={value} onChange={onChange} />;
}
