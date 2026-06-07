/**
 * FormSelect — wrapper de compatibilidade.
 *
 * Faz a bridge entre a API legada do select HTML nativo:
 *   onChange={(e) => setValue(e.target.value)}
 * e a API do Radix UI:
 *   onValueChange={(value) => setValue(value)}
 *
 * Todo código existente funciona sem alteração.
 */
import { SelectHTMLAttributes } from 'react';
import AppSelect from './ui/AppSelect';

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  options: { label: string; value: string }[];
};

export default function FormSelect({ label, options, onChange, value, disabled, name, className, ...rest }: Props) {
  function handleValueChange(newValue: string) {
    if (onChange) {
      // Cria um evento sintético compatível com ChangeEventHandler<HTMLSelectElement>
      const syntheticEvent = {
        target: { value: newValue, name: name ?? '' } as HTMLSelectElement,
        currentTarget: { value: newValue, name: name ?? '' } as HTMLSelectElement,
        bubbles: true,
        cancelable: true,
        defaultPrevented: false,
        eventPhase: 0,
        isTrusted: true,
        preventDefault: () => {},
        stopPropagation: () => {},
        type: 'change',
        nativeEvent: new Event('change'),
        isDefaultPrevented: () => false,
        isPropagationStopped: () => false,
        persist: () => {},
      } as unknown as React.ChangeEvent<HTMLSelectElement>;
      onChange(syntheticEvent);
    }
  }

  return (
    <AppSelect
      label={label}
      options={options}
      value={value as string | undefined}
      onValueChange={handleValueChange}
      disabled={disabled}
      name={name}
    />
  );
}
