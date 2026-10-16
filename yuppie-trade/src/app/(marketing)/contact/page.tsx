import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Mail, ShieldAlert } from "lucide-react";
import { ContactForm } from "@/components/forms/ContactForm";
import { PageHero } from "@/components/marketing/PageHero";
import { Card, Section } from "@/components/ui/Section";
import { plans } from "@/config/plans";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: "Contact & Support",
  description: "Get help with Yuppie Trade or send us a question.",
};

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string; plan?: string }>;
}) {
  const { topic, plan } = await searchParams;
  const planName = plans.find((p) => p.id === plan)?.name;
  const initialMessage = planName ? `I'd like to hear when the ${planName} plan is available.` : undefined;

  return (
    <>
      <PageHero
        eyebrow="Contact & support"
        title="How can we help?"
        description={`Questions about the product, pricing, security, or your data — we read every message. ${site.support.responseTime}`}
      />
      <Section>
        <div className="grid gap-10 lg:grid-cols-[1.4fr_0.8fr]">
          <Card className="p-6 sm:p-8">
            <h2 className="mb-6 text-xl font-medium text-fg">Send a message</h2>
            <ContactForm initialTopic={topic} initialMessage={initialMessage} />
          </Card>
          <div className="space-y-4">
            <Card className="p-6">
              <Mail size={18} className="text-pos" aria-hidden />
              <h2 className="mt-3 font-medium text-fg">Email</h2>
              {site.support.placeholder ? (
                <p className="mt-1 text-sm text-muted">Our support address will be published here at launch.</p>
              ) : (
                <a href={`mailto:${site.support.email}`} className="mt-1 block text-sm text-muted hover:text-fg">
                  {site.support.email}
                </a>
              )}
            </Card>
            <Card className="p-6">
              <BookOpen size={18} className="text-pos" aria-hidden />
              <h2 className="mt-3 font-medium text-fg">Common questions</h2>
              <p className="mt-1 text-sm text-muted">
                Integrations, AI limits, backtesting, and billing are covered in the{" "}
                <Link href="/#faq" className="text-fg underline underline-offset-2">
                  FAQ
                </Link>
                .
              </p>
            </Card>
            <Card className="p-6">
              <ShieldAlert size={18} className="text-pos" aria-hidden />
              <h2 className="mt-3 font-medium text-fg">We&apos;ll never ask for</h2>
              <p className="mt-1 text-sm text-muted">
                Your broker password, API secrets, or a transfer of funds. Anyone who does isn&apos;t us.
              </p>
            </Card>
          </div>
        </div>
      </Section>
    </>
  );
}
