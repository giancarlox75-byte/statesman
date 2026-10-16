/**
 * Single source of truth for what the product can actually do today.
 * Marketing copy reads status from here so the site can't overclaim.
 * Update a status only when the capability ships and is tested.
 */
export type CapabilityStatus = "available" | "demo" | "in-development" | "planned";

export const statusLabel: Record<CapabilityStatus, string> = {
  available: "Available",
  demo: "Demo preview",
  "in-development": "In development",
  planned: "Planned",
};

export type Capability = {
  id: "ai-strategies" | "backtesting" | "automated-execution" | "risk-controls";
  title: string;
  summary: string;
  details: string[];
  status: CapabilityStatus;
};

export const capabilities: Capability[] = [
  {
    id: "ai-strategies",
    title: "AI-Assisted Strategies",
    summary:
      "Describe an idea in plain language and get a structured strategy draft you can inspect, edit, and test.",
    details: [
      "Drafts are structured rules — entries, exits, position sizing — not black boxes.",
      "Every draft is validated before it can be tested, and can never skip your risk limits.",
      "AI output can be wrong. You review and approve everything it suggests.",
    ],
    status: "in-development",
  },
  {
    id: "backtesting",
    title: "Backtesting",
    summary:
      "Evaluate a strategy against historical data with fees, slippage, and other assumptions stated up front.",
    details: [
      "Configurable commission and slippage assumptions shown alongside every result.",
      "Drawdown, win rate, and exposure — not just total return.",
      "Past results don't predict future performance. We say so on every report.",
    ],
    status: "in-development",
  },
  {
    id: "automated-execution",
    title: "Automated Execution",
    summary:
      "Route eligible strategy signals to a supported integration — paper trading first, live only when you authorize it.",
    details: [
      "Paper trading is the default for every new strategy.",
      "Uses broker-issued authorization, never your broker password.",
      "Live execution stays disabled until security and compliance reviews are complete.",
    ],
    status: "planned",
  },
  {
    id: "risk-controls",
    title: "Risk Controls",
    summary:
      "Set position, loss, and order limits, review every action, and stop automation instantly.",
    details: [
      "Daily loss limits, maximum position size, and order caps per strategy.",
      "One-click pause and stop, with clear labels for paper versus live.",
      "A full activity log of every signal, order, and change.",
    ],
    status: "in-development",
  },
];
