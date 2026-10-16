import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * The Yuppie Trade mark: a geometric Y whose right arm rises into a green
 * arrowhead. Recreated as vector from the founder's logo artwork.
 */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={cn("h-8 w-8", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <path d="M2 8h9l10.5 10.5-4.5 4.5z" fill="currentColor" />
      <path d="M18 26 35 9l4 4-15 15v16h-6z" fill="currentColor" />
      <path d="M26.5 33.5 29.5 30.5V44h-3z" fill="currentColor" opacity="0.55" />
      <path d="M33.6 5.4 46 2l-3.4 12.4z" fill="#39D98A" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex flex-col leading-none", className)}>
      <span className="text-[15px] font-semibold tracking-[0.18em] text-fg">YUPPIE</span>
      <span className="mt-1 text-[8.5px] font-medium tracking-[0.62em] text-pos">TRADE</span>
    </span>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn("flex items-center gap-2.5 text-fg", className)}
      aria-label="Yuppie Trade home"
    >
      <LogoMark className="h-7 w-7" />
      <Wordmark />
    </Link>
  );
}
