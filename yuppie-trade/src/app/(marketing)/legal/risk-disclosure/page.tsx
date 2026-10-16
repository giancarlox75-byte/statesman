import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/marketing/LegalPage";

export const metadata: Metadata = { title: "Trading Risk Disclosure" };

export default function RiskDisclosurePage() {
  return (
    <LegalPage
      title="Trading Risk Disclosure"
      intro={
        <p>
          <strong className="font-medium text-fg">Trading involves substantial risk, and you can lose money — including, with some products, more than you invest.</strong>{" "}
          Read this disclosure carefully before using Yuppie Trade. If you&apos;re unsure whether trading is right for you, consult a licensed financial professional.
        </p>
      }
      sections={[
        {
          heading: "Market risk",
          body: <p>Prices can move quickly and unpredictably. Gaps, halts, low liquidity, and volatility can cause orders to fill at prices very different from those expected, or not at all.</p>,
        },
        {
          heading: "Leverage, margin, options, and crypto",
          body: <p>Margin and leveraged products amplify both gains and losses and can result in losses greater than your deposit. Options can expire worthless. Digital assets can be extremely volatile and may have limited regulatory protection.</p>,
        },
        {
          heading: "Backtesting and simulated results",
          body: (
            <ul>
              <li>Backtested and paper-trading results are hypothetical. They are prepared with the benefit of hindsight and do not reflect actual trading.</li>
              <li>They may not account for liquidity, slippage, fees, taxes, or the psychological pressure of real trading.</li>
              <li>Past performance — real or simulated — does not guarantee future results.</li>
            </ul>
          ),
        },
        {
          heading: "AI-generated strategies",
          body: <p>AI tools can misinterpret instructions, produce flawed logic, or generate strategies that lose money. AI output is not advice and is not reviewed by a licensed professional. You are responsible for reviewing every strategy before you use it.</p>,
        },
        {
          heading: "Automation and technology risk",
          body: <p>Automated trading depends on software, data feeds, internet connectivity, and third-party brokers. Any of these can fail, be delayed, or behave unexpectedly, and orders may be duplicated, delayed, or missed. Risk limits reduce but do not eliminate these risks. Monitor your accounts regularly.</p>,
        },
        {
          heading: "Third-party brokers",
          body: <p>Your orders are executed by your broker, not by Yuppie Trade. Broker outages, rejections, fees, and policies are outside our control.</p>,
        },
        {
          heading: "No guarantees",
          body: <p>Yuppie Trade does not guarantee profits, returns, or freedom from loss, and nothing on this site should be read as such a guarantee. Only trade with money you can afford to lose.</p>,
        },
        {
          heading: "Questions",
          body: <p><Link href="/contact" className="text-fg underline underline-offset-2">Contact us</Link> if anything here is unclear.</p>,
        },
      ]}
    />
  );
}
