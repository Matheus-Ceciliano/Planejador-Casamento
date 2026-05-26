import { SelectHTMLAttributes } from 'react';

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  options: { label: string; value: string }[];
};

export default function FormSelect({ label, options, ...props }: Props) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <select className="input" {...props}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label.charAt(0).toUpperCase() + option.label.slice(1)}
          </option>
        ))}
      </select>
    </label>
  );
}
