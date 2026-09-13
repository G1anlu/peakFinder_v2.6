import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

interface NumberFieldProps {
  id?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Valore applicato quando il campo resta vuoto (default: min). */
  fallback?: number;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
}

/**
 * Campo numerico compatibile con le tastiere touch: durante la digitazione
 * il campo può restare vuoto (backspace) e il valore viene normalizzato
 * solo quando si esce dal campo.
 */
export function NumberField({
  id,
  value,
  onChange,
  min = 0,
  max,
  step,
  fallback,
  placeholder,
  className,
  ...rest
}: NumberFieldProps) {
  const [text, setText] = useState(value === 0 && placeholder ? "" : String(value));
  const [focused, setFocused] = useState(false);

  // Allinea il testo al valore esterno quando l'utente non sta digitando.
  useEffect(() => {
    if (!focused) setText(value === 0 && placeholder ? "" : String(value));
  }, [value, focused, placeholder]);

  const clamp = (n: number) => {
    let out = n;
    if (min !== undefined && out < min) out = min;
    if (max !== undefined && out > max) out = max;
    return out;
  };

  return (
    <Input
      id={id}
      type="number"
      inputMode="decimal"
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      className={className}
      value={text}
      aria-label={rest["aria-label"]}
      onFocus={() => setFocused(true)}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        if (raw.trim() === "") return; // campo temporaneamente vuoto: nessun reset
        const parsed = Number(raw.replace(",", "."));
        if (!Number.isNaN(parsed)) onChange(parsed);
      }}
      onBlur={() => {
        setFocused(false);
        const parsed = Number(text.replace(",", "."));
        const safe =
          text.trim() === "" || Number.isNaN(parsed) ? (fallback ?? min ?? 0) : clamp(parsed);
        setText(safe === 0 && placeholder ? "" : String(safe));
        onChange(safe);
      }}
    />
  );
}
