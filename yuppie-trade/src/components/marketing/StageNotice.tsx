import Link from "next/link";
import { Info } from "lucide-react";
import { site } from "@/config/site";

export function StageNotice() {
  if (site.stage !== "early-access") return null;
  return (
    <div className="border-b border-line bg-card/60">
      <p className="mx-auto flex max-w-[1280px] items-center justify-center gap-2 px-4 py-2 text-center text-xs text-muted sm:text-[13px]">
        <Info size={14} className="shrink-0 text-subtle" aria-hidden />
        <span>
          Yuppie Trade is in early development. Product screens show sample data and live trading is not
          available.{" "}
          <Link href="/how-it-works#status" className="text-fg underline underline-offset-2">
            See what&apos;s ready
          </Link>
        </span>
      </p>
    </div>
  );
}
