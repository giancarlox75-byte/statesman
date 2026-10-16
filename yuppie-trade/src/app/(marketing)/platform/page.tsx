import type { Metadata } from "next";
import { Bot, FlaskConical, History, LayoutGrid, Plug, Settings, Sparkles } from "lucide-react";
import { CapabilityGrid } from "@/components/marketing/CapabilityGrid";
import { CtaBand } from "@/components/marketing/CtaBand";
import { DashboardPreview } from "@/components/marketing/DashboardPreview";
import { PageHero } from "@/components/marketing/PageHero";
import { Badge } from "@/components/ui/Badge";
import { Card, Section, SectionHeading } from "@/components/ui/Section";

export const metadata: Metadata = {
  title: "Platform",
  description: "AI-assisted strategies, backtesting, automated execution, and risk controls — and the status of each.",
};

const areas = [
  { icon: LayoutGrid, name: "Overview", body: "Integration status, active and paused strategies, recent activity, and alerts in one place." },
  { icon: Sparkles, name: "AI Strategy Lab", body: "Turn a plain-language idea into structured rules you can read, edit, and validate." },
  { icon: Bot, name: "My Agents", body: "Every strategy has a clear state: Draft, Testing, Paper Trading, Active, Paused, or Error." },
  { icon: FlaskConical, name: "Backtesting", body: "Run strategies on historical data with fees, slippage, and data range shown with the result." },
  { icon: History, name: "Trade History", body: "A searchable log of every simulated and live order, clearly separated." },
  { icon: Plug, name: "Integrations", body: "Connect supported brokers through their official authorization. A demo integration is available now." },
  { icon: Settings, name: "Settings", body: "Account, security, notifications, and default risk limits." },
];

const states = [
  { name: "Draft", tone: "neutral", body: "Being edited. Never trades." },
  { name: "Testing", tone: "info", body: "Running a backtest on historical data." },
  { name: "Paper Trading", tone: "positive", body: "Trading simulated money against market data." },
  { name: "Active", tone: "positive", body: "Live and placing real orders. Requires explicit confirmation." },
  { name: "Paused", tone: "warning", body: "Stopped by you or by a risk limit. Open positions are left as-is unless you close them." },
  { name: "Error", tone: "negative", body: "Something failed — a lost connection or rejected order. Automation halts until reviewed." },
] as const;

export default function PlatformPage() {
  return (
    <>
      <PageHero
        eyebrow="Platform"
        title="Everything you need to develop a strategy — and nothing that hides the risk"
        description="Yuppie Trade brings strategy design, testing, and automation into one workspace, with risk controls built into every step."
      />

      <Section>
        <SectionHeading title="Capabilities" description="Statuses are kept current. Anything not yet available is labeled." />
        <div className="mt-10">
          <CapabilityGrid detailed />
        </div>
      </Section>

      <Section className="border-y border-line bg-card/30">
        <SectionHeading
          title="The workspace"
          description="A compact sidebar, a focused overview, and dedicated screens for each stage of a strategy's life. The preview below uses sample data."
        />
        <div className="mt-10">
          <DashboardPreview />
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {areas.map(({ icon: Icon, name, body }) => (
            <div key={name} className="flex gap-3.5">
              <Icon size={18} className="mt-0.5 shrink-0 text-pos" aria-hidden />
              <div>
                <h3 className="font-medium text-fg">{name}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section>
        <SectionHeading
          title="Every agent has one clear state"
          description="You should never have to guess whether a strategy is simulated or trading real money."
        />
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {states.map((s) => (
            <Card key={s.name} className="p-5">
              <Badge tone={s.tone} dot>
                {s.name}
              </Badge>
              <p className="mt-3 text-sm leading-relaxed text-muted">{s.body}</p>
            </Card>
          ))}
        </div>
      </Section>

      <CtaBand title="Questions about the platform?" body="Tell us how you trade and we'll tell you honestly whether Yuppie Trade fits." />
    </>
  );
}
