import FormInput from './FormInput';

export default function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <FormInput label={label} type="date" value={value} onChange={(event) => onChange(event.target.value)} />;
}
