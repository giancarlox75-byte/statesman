import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

const control =
  "w-full rounded-md border bg-bg px-3.5 text-[15px] text-fg placeholder:text-subtle transition-colors focus:border-pos/60 focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-pos/20";

export function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-fg">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-neg">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-sm text-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Input({ invalid, className, ...props }: ComponentProps<"input"> & { invalid?: boolean }) {
  return (
    <input
      className={cn(control, "h-11", invalid ? "border-neg/70" : "border-line", className)}
      aria-invalid={invalid || undefined}
      aria-describedby={props.id && invalid ? `${props.id}-error` : undefined}
      {...props}
    />
  );
}

export function Textarea({ invalid, className, ...props }: ComponentProps<"textarea"> & { invalid?: boolean }) {
  return (
    <textarea
      className={cn(control, "min-h-36 py-3", invalid ? "border-neg/70" : "border-line", className)}
      aria-invalid={invalid || undefined}
      aria-describedby={props.id && invalid ? `${props.id}-error` : undefined}
      {...props}
    />
  );
}

export function Select({ invalid, className, ...props }: ComponentProps<"select"> & { invalid?: boolean }) {
  return (
    <select
      className={cn(control, "h-11", invalid ? "border-neg/70" : "border-line", className)}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

export function FormNotice({ tone, children }: { tone: "info" | "success" | "error"; children: ReactNode }) {
  const styles = {
    info: "border-line bg-elevated text-muted",
    success: "border-pos/30 bg-pos/10 text-fg",
    error: "border-neg/30 bg-neg/10 text-fg",
  };
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("rounded-md border px-4 py-3 text-sm leading-relaxed", styles[tone])}>
      {children}
    </div>
  );
}
