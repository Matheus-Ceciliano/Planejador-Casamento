import { InputHTMLAttributes } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export default function FormInput({ label, ...props }: Props) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input className="input" {...props} />
    </label>
  );
}
