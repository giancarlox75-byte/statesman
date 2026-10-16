/**
 * Pricing plans. Prices are `null` until the founder sets them AND billing
 * is implemented. While `billingEnabled` is false, no plan can be purchased
 * and the UI shows "Pricing to be announced".
 */
export type BillingInterval = "monthly" | "annual";

export type Plan = {
  id: "starter" | "pro" | "automation";
  name: string;
  description: string;
  /** Price per month in USD, by billing interval. null = not yet set. */
  price: Record<BillingInterval, number | null>;
  features: string[];
  /** Features that depend on capabilities not yet shipped. */
  upcoming?: string[];
  highlighted?: boolean;
};

export const billingEnabled = false;

export const plans: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    description: "Learn the platform and test ideas without risking capital.",
    price: { monthly: null, annual: null },
    features: [
      "Strategy builder",
      "Backtesting on daily historical data",
      "Paper trading with one strategy",
      "Activity log",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    description: "For active traders developing and comparing several strategies.",
    price: { monthly: null, annual: null },
    features: [
      "Everything in Starter",
      "AI Strategy Lab drafts",
      "Intraday backtesting",
      "Paper trading with up to 10 strategies",
      "Custom risk limits per strategy",
    ],
    highlighted: true,
  },
  {
    id: "automation",
    name: "Automation",
    description: "Connect a supported broker and automate eligible strategies.",
    price: { monthly: null, annual: null },
    features: ["Everything in Pro", "Priority support"],
    upcoming: [
      "Live execution through supported brokers",
      "Account-level kill switch and limits",
    ],
  },
];

export function hasPublishedPricing(list: Plan[] = plans): boolean {
  return list.some((p) => p.price.monthly !== null || p.price.annual !== null);
}

export function hasBothIntervals(list: Plan[] = plans): boolean {
  return list.some((p) => p.price.monthly !== null) && list.some((p) => p.price.annual !== null);
}

export function formatPrice(amount: number | null): string {
  if (amount === null) return "TBA";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}
