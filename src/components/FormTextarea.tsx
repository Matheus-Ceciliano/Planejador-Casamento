import { TextareaHTMLAttributes } from 'react';

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
};

export default function FormTextarea({ label, ...props }: Props) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <textarea className="input min-h-24 resize-y" {...props} />
    </label>
  );
}
