import * as React from "react";
import { Check, ChevronDown, X } from "lucide-react";
import {
  Select as SdSelect,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type SelectOption = { value: string; label: string; hint?: string };

export interface DropdownProps {
  label?: string;
  placeholder?: string;
  options: SelectOption[];
  value?: string;
  onValueChange?: (v: string) => void;
  error?: string;
  disabled?: boolean;
  className?: string;
}

export function Dropdown({ label, placeholder = "Select…", options, value, onValueChange, error, disabled, className }: DropdownProps) {
  const id = React.useId();
  return (
    <div className={cn("w-full", className)}>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-[12.5px] font-medium text-foreground">
          {label}
        </label>
      )}
      <SdSelect value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger
          id={id}
          className={cn(
            "h-9 rounded-lg border bg-card text-[13px] shadow-soft",
            error ? "border-destructive" : "border-border"
          )}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              <div className="flex flex-col">
                <span className="text-[13px]">{o.label}</span>
                {o.hint && <span className="text-[11.5px] text-ink-soft">{o.hint}</span>}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </SdSelect>
      {error && <p className="mt-1.5 text-[11.5px] text-destructive">{error}</p>}
    </div>
  );
}

export interface MultiSelectProps {
  label?: string;
  placeholder?: string;
  options: SelectOption[];
  value: string[];
  onChange: (v: string[]) => void;
  className?: string;
}

export function MultiSelect({ label, placeholder = "Select options…", options, value, onChange, className }: MultiSelectProps) {
  const id = React.useId();
  const [open, setOpen] = React.useState(false);
  const selected = options.filter((o) => value.includes(o.value));
  const toggle = (v: string) =>
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  return (
    <div className={cn("w-full", className)}>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-[12.5px] font-medium text-foreground">
          {label}
        </label>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            className="flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-lg border border-border bg-card px-2 py-1.5 text-left text-[13px] shadow-soft transition-colors focus:outline-none focus:ring-2 focus:ring-ring/20"
          >
            {selected.length === 0 ? (
              <span className="px-1 text-muted-foreground">{placeholder}</span>
            ) : (
              selected.map((s) => (
                <span
                  key={s.value}
                  className="inline-flex items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 text-[11.5px] font-medium"
                >
                  {s.label}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(s.value);
                    }}
                    aria-label={`Remove ${s.label}`}
                    className="text-ink-soft hover:text-foreground"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))
            )}
            <ChevronDown className="ml-auto size-4 text-ink-soft" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-1" align="start">
          <div className="max-h-56 overflow-auto">
            {options.map((o) => {
              const active = value.includes(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => toggle(o.value)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-secondary",
                    active && "bg-accent text-accent-foreground"
                  )}
                >
                  <span>{o.label}</span>
                  {active && <Check className="size-3.5" />}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
