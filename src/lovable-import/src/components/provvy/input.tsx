import * as React from "react";
import { Search, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ValidationState = "default" | "error" | "success";

export interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  success?: string;
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  validation?: ValidationState;
}

export const TextField = React.forwardRef<HTMLInputElement, TextFieldProps>(
  ({ className, label, hint, error, success, leadingIcon, trailingIcon, validation, id, ...props }, ref) => {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;
    const state: ValidationState = error ? "error" : success ? "success" : validation ?? "default";
    const helper = error ?? success ?? hint;

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="mb-1.5 block text-[12.5px] font-medium text-foreground">
            {label}
          </label>
        )}
        <div
          className={cn(
            "flex h-9 items-center gap-2 rounded-lg border bg-card px-3 text-[13px] shadow-soft transition-colors",
            "focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20",
            state === "error" && "border-destructive focus-within:ring-destructive/25",
            state === "success" && "border-emerald-500 focus-within:ring-emerald-500/25",
            state === "default" && "border-border",
            props.disabled && "opacity-60 pointer-events-none",
            className
          )}
        >
          {leadingIcon && <span className="text-ink-soft [&_svg]:size-4">{leadingIcon}</span>}
          <input
            ref={ref}
            id={inputId}
            className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
            aria-invalid={state === "error"}
            aria-describedby={helper ? `${inputId}-helper` : undefined}
            {...props}
          />
          {state === "error" ? (
            <AlertCircle className="size-4 text-destructive" />
          ) : state === "success" ? (
            <CheckCircle2 className="size-4 text-emerald-500" />
          ) : (
            trailingIcon && <span className="text-ink-soft [&_svg]:size-4">{trailingIcon}</span>
          )}
        </div>
        {helper && (
          <p
            id={`${inputId}-helper`}
            className={cn(
              "mt-1.5 text-[11.5px]",
              state === "error" && "text-destructive",
              state === "success" && "text-emerald-600 dark:text-emerald-400",
              state === "default" && "text-ink-soft"
            )}
          >
            {helper}
          </p>
        )}
      </div>
    );
  }
);
TextField.displayName = "TextField";

export const SearchField = React.forwardRef<HTMLInputElement, Omit<TextFieldProps, "leadingIcon">>(
  (props, ref) => <TextField ref={ref} leadingIcon={<Search />} placeholder={props.placeholder ?? "Search…"} {...props} />
);
SearchField.displayName = "SearchField";
