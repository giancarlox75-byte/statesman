export const steps = [
  {
    title: "Connect a supported integration",
    body: "Link a supported broker through its official authorization flow — or start with the demo integration, which needs no account at all. We never ask for your broker password.",
  },
  {
    title: "Build or configure a strategy",
    body: "Set entry and exit rules, position sizing, and limits yourself, or describe an idea and let the AI Strategy Lab draft rules you can review and edit.",
  },
  {
    title: "Test with history or paper trading",
    body: "Run a backtest against historical data with fees and slippage stated up front, then paper trade with simulated money to see how it behaves in current markets.",
  },
  {
    title: "Review the risks, then decide",
    body: "Check the results, the limits, and what could go wrong. Where supported, you can activate automation — with a clear confirmation step and a stop button that's always one click away.",
  },
];

export function Steps() {
  return (
    <ol className="grid gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-2 lg:grid-cols-4">
      {steps.map((s, i) => (
        <li key={s.title} className="bg-card p-6 sm:p-7">
          <span className="tabular flex h-8 w-8 items-center justify-center rounded-md border border-line bg-elevated text-sm font-medium text-pos">
            {i + 1}
          </span>
          <h3 className="mt-5 font-medium text-fg">{s.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
        </li>
      ))}
    </ol>
  );
}
