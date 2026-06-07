/**
 * FormTextarea — wrapper de compatibilidade.
 * Re-exporta AppTextarea mantendo a API original:
 *   { label: string } & TextareaHTMLAttributes<HTMLTextAreaElement>
 */
import { TextareaHTMLAttributes } from 'react';
import AppTextarea from './ui/AppTextarea';

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
};

export default function FormTextarea({ label, ...props }: Props) {
  return <AppTextarea label={label} {...props} />;
}
