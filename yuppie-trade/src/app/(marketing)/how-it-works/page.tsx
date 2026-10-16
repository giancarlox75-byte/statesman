import type { Metadata } from "next";
import { capabilities } from "@/config/capabilities";
import { CtaBand } from "@/components/marketing/CtaBand";
import { PageHero } from "@/components/marketing/PageHero";
import { Steps } from "@/components/marketing/Steps";
import { Card, Section, SectionHeading } from "@/components/ui/Section";
import { StatusBadge } from "@/components/ui/StatusBadge";

export const metadata: Metadata = {
  title: "How It Works",
  description: "Connect, build, test, and review — the four-step Yuppie Trade workflow.",
};

const safeguards = [
  {
    title: "Paper first, always",
    body: "New strategies start in Draft and can only move to Paper Trading after validation. Live trading needs a separate, explicit confirmation.",
  },
  {
    title: "AI is a drafting tool",
    body: "AI suggestions are treated as untrusted input. They're checked against a strict format and your risk limits before anything runs.",
  },
  {
    title: "Limits apply before orders",
    body: "Maximum position size, daily loss limits, and order caps are checked before an order is sent — not after.",
  },
  {
    title: "Safe shutdown",
    body: "If a connection drops, a session expires, or an order is rejected, the agent moves to Error and stops placing new orders until you review it.",
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <PageHero
        eyebrow="How it works"
        title="Four steps from idea to automation"
        description="A deliberate workflow that keeps testing ahead of trading, and keeps you in control throughout."
      />

      <Section>
        <Steps />
      </Section>

      <Section className="border-y border-line bg-card/30">
        <SectionHeading title="Safeguards at every step" />
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {safeguards.map((s) => (
            <Card key={s.title} className="p-6">
              <h3 className="font-medium text-fg">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
            </Card>
          ))}
        </div>
      </Section>

      <Section id="status">
        <SectionHeading
          title="What's ready today"
          description="Yuppie Trade is in early development. Here's the honest status of each capability."
        />
        <div className="mt-10 overflow-hidden rounded-lg border border-line">
          {capabilities.map((c) => (
            <div
              key={c.id}
              className="flex flex-col gap-2 border-b border-line bg-card px-5 py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium text-fg">{c.title}</p>
                <p className="text-sm text-muted">{c.summary}</p>
              </div>
              <div className="shrink-0">
                <StatusBadge status={c.status} />
              </div>
            </div>
          ))}
        </div>
      </Section>

      <CtaBand />
    </>
  );
}
