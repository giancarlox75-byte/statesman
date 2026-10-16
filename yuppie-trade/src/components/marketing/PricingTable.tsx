"use client";

import { useState } from "react";
import { Check, Clock } from "lucide-react";
import {
  billingEnabled,
  formatPrice,
  hasBothIntervals,
  hasPublishedPricing,
  plans,
  type BillingInterval,
} from "@/config/plans";
import { ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";

export function PricingTable() {
  const [interval, setInterval] = useState<BillingInterval>("monthly");
  const published = hasPublishedPricing();
  const showToggle = hasBothIntervals();

  return (
    <div>
      {showToggle && (
        <div className="mb-10 flex justify-center">
          <div role="radiogroup" aria-label="Billing interval" className="inline-flex rounded-lg border border-line bg-card p-1">
            {(["monthly", "annual"] as const).map((i) => (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={interval === i}
                onClick={() => setInterval(i)}
                className={cn(
                  "rounded-md px-4 py-2 text-sm capitalize transition-colors",
                  interval === i ? "bg-elevated text-fg" : "text-muted hover:text-fg",
                )}
              >
                {i}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((plan) => {
          const price = plan.price[interval];
          return (
            <div
              key={plan.id}
              className={cn(
                "flex flex-col rounded-xl border bg-card p-7",
                plan.highlighted ? "border-pos/40 shadow-[0_0_0_1px_rgb(57_217_138/0.15)]" : "border-line",
              )}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-fg">{plan.name}</h3>
                {plan.highlighted && <Badge tone="positive">Most flexible</Badge>}
              </div>
              <p className="mt-2 min-h-12 text-sm leading-relaxed text-muted">{plan.description}</p>

              <div className="mt-6 border-t border-line pt-6">
                {published && price !== null ? (
                  <p className="tabular">
                    <span className="text-4xl font-semibold tracking-tight text-fg">{formatPrice(price)}</span>
                    <span className="ml-1 text-sm text-muted">/ month{interval === "annual" && ", billed annually"}</span>
                  </p>
                ) : (
                  <p>
                    <span className="text-2xl font-semibold tracking-tight text-fg">Pricing to be announced</span>
                    <span className="mt-1 block text-sm text-subtle">Not yet available for purchase</span>
                  </p>
                )}
              </div>

              <ul className="mt-6 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-2.5 text-sm text-muted">
                    <Check size={16} className="mt-0.5 shrink-0 text-pos" aria-hidden />
                    {f}
                  </li>
                ))}
                {plan.upcoming?.map((f) => (
                  <li key={f} className="flex gap-2.5 text-sm text-subtle">
                    <Clock size={16} className="mt-0.5 shrink-0" aria-hidden />
                    <span>
                      {f} <span className="text-xs">(in development)</span>
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-auto pt-8">
                {billingEnabled ? (
                  <ButtonLink href={`/create-account?plan=${plan.id}`} variant={plan.highlighted ? "accent" : "secondary"} className="w-full">
                    Choose {plan.name}
                  </ButtonLink>
                ) : (
                  <ButtonLink
                    href={`/contact?topic=pricing&plan=${plan.id}`}
                    variant={plan.highlighted ? "accent" : "secondary"}
                    className="w-full"
                  >
                    Ask about {plan.name}
                  </ButtonLink>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
