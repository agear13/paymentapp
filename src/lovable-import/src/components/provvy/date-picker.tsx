import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface DatePickerProps {
  label?: string;
  value?: Date;
  onChange?: (d?: Date) => void;
  placeholder?: string;
  className?: string;
}

export function DatePicker({ label, value, onChange, placeholder = "Pick a date", className }: DatePickerProps) {
  const id = React.useId();
  return (
    <div className={cn("w-full", className)}>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-[12.5px] font-medium">
          {label}
        </label>
      )}
      <Popover>
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            className={cn(
              "inline-flex h-9 w-full items-center gap-2 rounded-lg border border-border bg-card px-3 text-left text-[13px] shadow-soft transition-colors hover:bg-secondary/40 focus:outline-none focus:ring-2 focus:ring-ring/20",
              !value && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="size-4 text-ink-soft" />
            {value ? format(value, "PPP") : placeholder}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={value}
            onSelect={onChange}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
