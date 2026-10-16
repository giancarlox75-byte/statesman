import type { Metadata } from "next";
import { CtaBand } from "@/components/marketing/CtaBand";
import { Faq } from "@/components/marketing/Faq";
import { PageHero } from "@/components/marketing/PageHero";
import { PricingTable } from "@/components/marketing/PricingTable";
import { Section, SectionHeading } from "@/components/ui/Section";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Yuppie Trade plans. Pricing will be announced before billing begins.",
};

export default function PricingPage() {
  return (
    <>
      <PageHero
        eyebrow="Pricing"
        title="Clear plans. No surprises."
        description="Billing isn't active yet and nobody is being charged. Prices will be published here before any plan goes on sale, and you'll be able to cancel anytime."
      />
      <Section>
        <PricingTable />
        <p className="mx-auto mt-10 max-w-2xl text-center text-sm leading-relaxed text-subtle">
          Subscriptions pay for software access only. They don&apos;t include brokerage services, market
          data fees charged by your broker, or investment advice.
        </p>
      </Section>
      <Section className="border-t border-line">
        <div className="grid gap-12 lg:grid-cols-[0.7fr_1.3fr]">
          <SectionHeading title="Questions" description="Subscriptions, cancellation, and what's included." />
          <Faq />
        </div>
      </Section>
      <CtaBand />
    </>
  );
}
