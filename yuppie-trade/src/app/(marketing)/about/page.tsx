import type { Metadata } from "next";
import { CtaBand } from "@/components/marketing/CtaBand";
import { PageHero } from "@/components/marketing/PageHero";
import { Section } from "@/components/ui/Section";

export const metadata: Metadata = {
  title: "About",
  description: "Why Yuppie Trade exists and the principles we build by.",
};

const principles = [
  {
    title: "Honesty over hype",
    body: "No guaranteed returns, no invented statistics, no fake testimonials. If something is a demo, it says so.",
  },
  {
    title: "You stay in control",
    body: "Software should make your decisions sharper, not make them for you. Every automation has limits and an off switch.",
  },
  {
    title: "Test before you trade",
    body: "Backtesting and paper trading come first, by default. Real money comes last, and only with your explicit say-so.",
  },
  {
    title: "Precision in the details",
    body: "Clear states, clear units, clear labels. Ambiguity in trading software costs money.",
  },
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About"
        title="Serious tools for self-directed traders"
        description="Yuppie Trade is an early-stage software company building a disciplined way to design, test, and automate trading strategies."
      />
      <Section>
        <div className="grid gap-12 lg:grid-cols-[1fr_1fr]">
          <div className="space-y-5 text-lg leading-relaxed text-muted">
            <p>
              Automated trading tools tend to fall into two camps: professional platforms that demand a
              programming background, and consumer apps that promise easy money. We think there&apos;s room for
              something better in between.
            </p>
            <p>
              Yuppie Trade gives self-directed traders a structured workspace — AI help for drafting ideas,
              honest backtests, paper trading, and automation guarded by limits they set. We&apos;re building it
              in the open, one tested stage at a time.
            </p>
            <p className="text-base text-subtle">
              Yuppie Trade is a software provider. We are not a broker-dealer or investment adviser and we
              don&apos;t hold customer funds.
            </p>
          </div>
          <div className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2">
            {principles.map((p) => (
              <div key={p.title} className="bg-card p-6">
                <h2 className="font-medium text-fg">{p.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>
      <CtaBand />
    </>
  );
}
