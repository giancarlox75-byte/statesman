import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "positive" | "negative" | "warning" | "info";

const tones: Record<Tone, string> = {
  neutral: "border-line bg-elevated text-muted",
  positive: "border-pos/30 bg-pos/10 text-pos",
  negative: "border-neg/30 bg-neg/10 text-neg",
  warning: "border-warn/30 bg-warn/10 text-warn",
  info: "border-[#6b8cff]/30 bg-[#6b8cff]/10 text-[#9db1ff]",
};

export function Badge({
  tone = "neutral",
  dot,
  className,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium",
        tones[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}
