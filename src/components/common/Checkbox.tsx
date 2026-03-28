import { cn } from "@/lib/utils";
import { ChangeEvent, ReactNode } from "react";

type CheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  id?: string;
  disabled?: boolean;
  className?: string;
};

export function Checkbox({ checked, onChange, label, id, disabled, className }: CheckboxProps) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "inline-flex items-center gap-2 text-sm text-foreground cursor-pointer select-none",
        disabled && "cursor-not-allowed opacity-70",
        className
      )}
    >
      <input
        id={id}
        type="checkbox"
        className="h-4 w-4 rounded border-border accent-primary"
        checked={checked}
        disabled={disabled}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.checked)}
      />
      {label && <span>{label}</span>}
    </label>
  );
}

