export type FaqItem = { q: string; a: string };

export const faq: FaqItem[] = [
  {
    q: "Which brokers and exchanges are supported?",
    a: "None are connected yet. During early access you can explore a clearly labeled demo integration that uses simulated data. Our first planned integration is a paper-trading account with a US broker that offers an official API. We'll list each integration here only once it is built, tested, and available.",
  },
  {
    q: "What can the AI actually do?",
    a: "The AI Strategy Lab turns a plain-language idea into a structured strategy draft — entry and exit rules, sizing, and limits — that you can read and edit. It does not predict markets, it can misunderstand you, and it can produce strategies that lose money. Every draft is validated and must pass your risk limits before it can run, even in paper trading.",
  },
  {
    q: "How reliable is backtesting?",
    a: "Backtesting shows how a set of rules would have behaved on historical data under stated assumptions such as fees and slippage. It cannot account for everything — liquidity, gaps, and changing market conditions all matter. Backtested results do not guarantee future performance.",
  },
  {
    q: "What is paper trading?",
    a: "Paper trading runs your strategy against market data using simulated money. No real orders are placed. Every paper strategy is labeled as simulated throughout the product so it can't be confused with a live account.",
  },
  {
    q: "What do I need for live trading?",
    a: "Live trading is not available yet. When it is, you'll need an account with a supported broker, you'll authorize Yuppie Trade through the broker's official flow, and you'll explicitly confirm each strategy before it trades real money. We'll only enable live trading after completing security and regulatory reviews.",
  },
  {
    q: "How do subscriptions work?",
    a: "Pricing hasn't been announced and billing isn't active, so nobody is being charged. When subscriptions launch, plans and prices will be listed on the Pricing page before you're asked to pay anything.",
  },
  {
    q: "Can I cancel?",
    a: "Yes. When billing launches you'll be able to cancel from your account settings at any time. Cancellation stops future renewals; we'll publish the exact refund terms on the Pricing page and in the Terms of Service before charging anyone.",
  },
  {
    q: "What happens to my data?",
    a: "We collect only what we need to run the service. We never ask for your broker password, we store integration tokens encrypted on our servers, and we never send them to your browser. We don't sell personal data. See the Privacy Policy for details.",
  },
  {
    q: "How do I get support?",
    a: "Use the Contact & Support page. We aim to reply within two business days.",
  },
];
