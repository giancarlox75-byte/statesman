import { FlaskConical, ShieldCheck, Sparkles, Workflow } from "lucide-react";
import { capabilities, type Capability } from "@/config/capabilities";
import { Card } from "@/components/ui/Section";
import { StatusBadge } from "@/components/ui/StatusBadge";

export const capabilityIcon: Record<Capability["id"], typeof Sparkles> = {
  "ai-strategies": Sparkles,
  backtesting: FlaskConical,
  "automated-execution": Workflow,
  "risk-controls": ShieldCheck,
};

export function CapabilityGrid({ detailed = false }: { detailed?: boolean }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {capabilities.map((c) => {
        const Icon = capabilityIcon[c.id];
        return (
          <Card key={c.id} className="p-6 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-md border border-line bg-elevated text-pos">
                <Icon size={19} aria-hidden />
              </span>
              <StatusBadge status={c.status} />
            </div>
            <h3 className="mt-5 text-lg font-medium text-fg">{c.title}</h3>
            <p className="mt-2 leading-relaxed text-muted">{c.summary}</p>
            {detailed && (
              <ul className="mt-5 space-y-2.5 border-t border-line pt-5">
                {c.details.map((d) => (
                  <li key={d} className="flex gap-2.5 text-sm leading-relaxed text-muted">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-subtle" aria-hidden />
                    {d}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        );
      })}
    </div>
  );
}
