import type { ChangeEvent } from "react";
import { Label } from "@/components/ui/label";

interface TimePickerDropdownProps {
  /** Orario nel formato "HH:MM". */
  value: string;
  onChange: (time: string) => void;
  label?: string;
  id?: string;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"));
const MINUTES = ["00", "15", "30", "45"];

const selectClass =
  "mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground " +
  "focus:outline-none focus:ring-2 focus:ring-ring";

/**
 * Selettore orario con due menu a tendina (ore e minuti a intervalli di 15).
 * Evita il popup orologio nativo di Android che rompe il layout.
 */
export function TimePickerDropdown({ value, onChange, label, id }: TimePickerDropdownProps) {
  const [rawHour, rawMinute] = (value || "08:00").split(":");
  const hour = HOURS.includes(rawHour ?? "") ? (rawHour as string) : "08";
  const minute = MINUTES.includes(rawMinute ?? "")
    ? (rawMinute as string)
    : // arrotonda ai 15 minuti più vicini in difetto
      MINUTES[Math.min(3, Math.floor(Number(rawMinute ?? 0) / 15) || 0)];

  const onHour = (e: ChangeEvent<HTMLSelectElement>) => onChange(`${e.target.value}:${minute}`);
  const onMinute = (e: ChangeEvent<HTMLSelectElement>) => onChange(`${hour}:${e.target.value}`);

  const hourId = id ? `${id}-ore` : undefined;
  const minuteId = id ? `${id}-minuti` : undefined;

  return (
    <div className="w-full">
      {label && (
        <Label htmlFor={hourId} className="text-sm">
          {label}
        </Label>
      )}
      <div className="flex items-end gap-2">
        <select
          id={hourId}
          aria-label={label ? `${label} — ore` : "Ore"}
          inputMode="none"
          value={hour}
          onChange={onHour}
          className={selectClass}
        >
          {HOURS.map((h) => (
            <option key={h} value={h}>
              {h} h
            </option>
          ))}
        </select>
        <span aria-hidden className="pb-2 font-semibold text-muted-foreground">
          :
        </span>
        <select
          id={minuteId}
          aria-label={label ? `${label} — minuti` : "Minuti"}
          inputMode="none"
          value={minute}
          onChange={onMinute}
          className={selectClass}
        >
          {MINUTES.map((m) => (
            <option key={m} value={m}>
              {m} min
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
