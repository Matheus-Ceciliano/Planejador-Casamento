/**
 * CurrencyInput — wrapper de compatibilidade.
 * Re-exporta AppCurrencyInput mantendo a API original:
 *   { label: string; value: number; onValueChange: (value: number) => void }
 */
import { InputHTMLAttributes } from 'react';
import AppCurrencyInput, { AppCurrencyInputProps } from './ui/AppCurrencyInput';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  label: string;
  hint?: AppCurrencyInputProps['hint'];
  error?: AppCurrencyInputProps['error'];
  value: number;
  onValueChange: (value: number) => void;
};

export default function CurrencyInput({ label, value, onValueChange, ...props }: Props) {
  return <AppCurrencyInput label={label} value={value} onValueChange={onValueChange} {...props} />;
}
