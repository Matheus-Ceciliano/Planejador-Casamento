import { InputHTMLAttributes } from 'react';
import { moneyInput, parseMoney } from '../utils/format';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  label: string;
  value: number;
  onValueChange: (value: number) => void;
};

export default function CurrencyInput({ label, value, onValueChange, ...props }: Props) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <input
        className="input"
        inputMode="numeric"
        value={moneyInput(value)}
        onChange={(event) => onValueChange(parseMoney(event.target.value))}
        {...props}
      />
    </label>
  );
}
