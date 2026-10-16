import { ChevronDown } from "lucide-react";
import { faq } from "@/config/faq";

export function Faq() {
  return (
    <div className="divide-y divide-line rounded-lg border border-line bg-card">
      {faq.map((item) => (
        <details key={item.q} className="group px-5 sm:px-6">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-left font-medium text-fg [&::-webkit-details-marker]:hidden">
            {item.q}
            <ChevronDown
              size={18}
              className="shrink-0 text-subtle transition-transform group-open:rotate-180"
              aria-hidden
            />
          </summary>
          <p className="-mt-1 pb-5 leading-relaxed text-muted">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
