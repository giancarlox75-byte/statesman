import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { Container, Section, SectionHeading } from "@/components/ui/Section";
import { CapabilityGrid } from "@/components/marketing/CapabilityGrid";
import { CtaBand } from "@/components/marketing/CtaBand";
import { DashboardPreview } from "@/components/marketing/DashboardPreview";
import { Faq } from "@/components/marketing/Faq";
import { HeroVisual } from "@/components/marketing/HeroVisual";
import { PricingTable } from "@/components/marketing/PricingTable";
import { Steps } from "@/components/marketing/Steps";
import { TrustGrid } from "@/components/marketing/TrustGrid";
import Link from "next/link";

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="hero-backdrop pointer-events-none absolute inset-0" aria-hidden />
        <Container className="relative pt-16 sm:pt-24">
          <div className="grid items-center gap-10 lg:grid-cols-[1.45fr_0.55fr]">
            <div>
              <h1 className="text-[2.75rem] font-semibold leading-[1.04] tracking-[-0.035em] text-fg sm:text-6xl lg:text-[3.5rem] xl:text-[3.75rem]">
                Your strategy. Your rules.{" "}
                <br className="hidden sm:block" />
                Smarter execution.
              </h1>
              <p className="mt-6 max-w-[34rem] text-lg leading-relaxed text-muted sm:text-xl">
                Build, test, and automate trading strategies with intelligent tools designed to help you
                make informed decisions and stay in control.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <ButtonLink href="/platform" size="lg">
                  Explore the Platform
                </ButtonLink>
                <ButtonLink href="/how-it-works" size="lg" variant="secondary">
                  See How It Works
                </ButtonLink>
              </div>
            </div>
            <HeroVisual className="mx-auto hidden w-full max-w-[420px] lg:block" />
          </div>

          <div className="relative mt-16 sm:mt-20">
            <DashboardPreview />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-bg to-transparent" aria-hidden />
          </div>
        </Container>
      </section>

      {/* Capabilities */}
      <Section>
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <SectionHeading
            eyebrow="Platform"
            title="Four tools, one disciplined workflow"
            description="Each capability is labeled with its real status. We'd rather show you what's in progress than overpromise."
          />
          <Link href="/platform" className="flex shrink-0 items-center gap-1.5 text-sm text-muted hover:text-fg">
            Platform details <ArrowRight size={15} aria-hidden />
          </Link>
        </div>
        <div className="mt-12">
          <CapabilityGrid />
        </div>
      </Section>

      {/* How it works */}
      <Section className="border-y border-line bg-card/30">
        <SectionHeading
          eyebrow="How it works"
          title="From idea to automation — on your terms"
          description="Nothing trades with real money unless you've tested it, reviewed the risks, and explicitly turned it on."
        />
        <div className="mt-12">
          <Steps />
        </div>
      </Section>

      {/* Trust */}
      <Section>
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <SectionHeading
              eyebrow="Security & trust"
              title="Built to keep you in control"
              description="Automated trading can lose money quickly. We design every part of the product around permissions, visibility, and limits."
            />
            <p className="mt-6 text-sm leading-relaxed text-subtle">
              No software can guarantee profits or eliminate risk, and we won&apos;t claim otherwise.
            </p>
            <ButtonLink href="/security" variant="secondary" className="mt-8">
              Read our approach
            </ButtonLink>
          </div>
          <TrustGrid />
        </div>
      </Section>

      {/* Pricing */}
      <Section className="border-y border-line bg-card/30">
        <SectionHeading
          align="center"
          eyebrow="Pricing"
          title="Simple plans, announced before launch"
          description="Billing isn't active yet, and nobody is being charged. Plans and prices will be published here before anything is for sale."
        />
        <div className="mt-12">
          <PricingTable />
        </div>
      </Section>

      {/* FAQ */}
      <Section id="faq">
        <div className="grid gap-12 lg:grid-cols-[0.7fr_1.3fr]">
          <SectionHeading
            eyebrow="FAQ"
            title="Straight answers"
            description={
              <>
                Can&apos;t find what you need?{" "}
                <Link href="/contact" className="text-fg underline underline-offset-2">
                  Contact support
                </Link>
                .
              </>
            }
          />
          <Faq />
        </div>
      </Section>

      <CtaBand />
    </>
  );
}
