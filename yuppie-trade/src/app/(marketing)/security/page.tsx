import type { Metadata } from "next";
import Link from "next/link";
import { CtaBand } from "@/components/marketing/CtaBand";
import { PageHero } from "@/components/marketing/PageHero";
import { TrustGrid } from "@/components/marketing/TrustGrid";
import { Card, Section, SectionHeading } from "@/components/ui/Section";

export const metadata: Metadata = {
  title: "Security & Trust",
  description: "How Yuppie Trade handles permissions, data, automation, and risk.",
};

const practices = [
  {
    title: "Authentication & sessions",
    items: [
      "Passwords hashed with a modern, slow algorithm — never stored in plain text.",
      "Secure, httpOnly session cookies with expiry; sessions can be signed out everywhere.",
      "Rate limiting on sign-in and other sensitive endpoints.",
    ],
  },
  {
    title: "Credentials & integrations",
    items: [
      "Broker tokens encrypted at rest and only ever used on our servers.",
      "Least-privilege scopes; no withdrawal permissions where the broker allows us to avoid them.",
      "You can revoke an integration from Yuppie Trade or directly from your broker at any time.",
    ],
  },
  {
    title: "Automation safeguards",
    items: [
      "Server-side risk checks run before every order, including AI-drafted strategies.",
      "Explicit confirmation before any strategy can trade a live account.",
      "Agents halt and move to Error on connection loss, rejected orders, or expired authorization.",
    ],
  },
  {
    title: "Accountability",
    items: [
      "An audit log of sign-ins, integration changes, strategy changes, and orders.",
      "Each customer's data is isolated and every request is authorized on the server.",
      "Secrets live in environment configuration, never in source code or the browser.",
    ],
  },
];

export default function SecurityPage() {
  return (
    <>
      <PageHero
        eyebrow="Security & trust"
        title="How we handle your accounts, data, and risk"
        description="Trading software should earn trust through design, not slogans. Here's exactly how Yuppie Trade is built."
      />

      <Section>
        <TrustGrid />
      </Section>

      <Section className="border-y border-line bg-card/30">
        <SectionHeading title="Our practices" description="These describe how the platform is being built. Features ship only when these controls are in place." />
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {practices.map((p) => (
            <Card key={p.title} className="p-6 sm:p-7">
              <h3 className="font-medium text-fg">{p.title}</h3>
              <ul className="mt-4 space-y-3">
                {p.items.map((i) => (
                  <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-muted">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-pos" aria-hidden />
                    {i}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </Section>

      <Section>
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold tracking-[-0.02em] text-fg">What we don&apos;t claim</h2>
            <p className="mt-4 leading-relaxed text-muted">
              We don&apos;t hold third-party security certifications today, and we aren&apos;t registered with
              any financial regulator. We will only state a certification or registration here once it has
              actually been obtained and can be verified.
            </p>
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-[-0.02em] text-fg">Report a vulnerability</h2>
            <p className="mt-4 leading-relaxed text-muted">
              If you believe you&apos;ve found a security issue, please{" "}
              <Link href="/contact?topic=security" className="text-fg underline underline-offset-2">
                contact us with the &ldquo;Security report&rdquo; topic
              </Link>
              . Please give us reasonable time to fix it before disclosing it publicly, and don&apos;t access
              other people&apos;s data while testing.
            </p>
          </div>
        </div>
      </Section>

      <CtaBand />
    </>
  );
}
