/**
 * FormInput — wrapper de compatibilidade.
 * Re-exporta AppInput mantendo a API original:
 *   { label: string } & InputHTMLAttributes<HTMLInputElement>
 *
 * Todo código existente que importa FormInput ganha o novo visual premium
 * automaticamente, sem precisar alterar nenhuma linha.
 */
import { InputHTMLAttributes } from 'react';
import AppInput from './ui/AppInput';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

export default function FormInput({ label, ...props }: Props) {
  return <AppInput label={label} {...props} />;
}
