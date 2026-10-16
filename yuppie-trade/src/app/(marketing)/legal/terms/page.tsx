import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/marketing/LegalPage";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro="These terms govern your use of Yuppie Trade's website and software. By creating an account or using the service, you agree to them. Please also read the Trading Risk Disclosure and Privacy Policy."
      sections={[
        {
          heading: "The service",
          body: <p>Yuppie Trade provides software for designing, testing, and automating trading strategies. We are a technology provider. We are not a broker-dealer, investment adviser, or exchange; we don&apos;t hold your funds or securities; and we don&apos;t execute trades except by sending instructions you have configured to a broker you have connected.</p>,
        },
        {
          heading: "No investment advice",
          body: <p>Nothing in the service — including AI-generated content, backtests, examples, or educational material — is investment, financial, tax, or legal advice, or a recommendation to buy or sell any security. You are solely responsible for your trading decisions and for each strategy you run.</p>,
        },
        {
          heading: "Eligibility and accounts",
          body: <p>You must be at least 18 and able to form a binding contract. You&apos;re responsible for keeping your credentials secure and for activity under your account. Tell us promptly about any unauthorized use.</p>,
        },
        {
          heading: "Integrations and automation",
          body: (
            <ul>
              <li>Your relationship with any broker is governed by your agreement with that broker.</li>
              <li>Automated strategies may behave unexpectedly due to software errors, data errors, connectivity issues, broker outages, or market conditions.</li>
              <li>Live trading requires your explicit confirmation. You remain responsible for monitoring your accounts and for all orders placed through your integration.</li>
              <li>We may pause automation to protect you, the service, or third parties — for example after repeated errors or suspected unauthorized access.</li>
            </ul>
          ),
        },
        {
          heading: "AI features",
          body: <p>AI-generated strategies and explanations can be inaccurate, incomplete, or unsuitable. They are validated against your risk limits but are not reviewed by a human or a licensed professional. Review everything before using it.</p>,
        },
        {
          heading: "Subscriptions and billing",
          body: <p>Paid plans are not yet available. Before any charges begin, we&apos;ll publish prices, billing intervals, renewal, cancellation, and refund terms on the Pricing page and in these Terms.</p>,
        },
        {
          heading: "Acceptable use",
          body: <p>Don&apos;t misuse the service: no market manipulation or other unlawful trading, no attempts to access other users&apos; data, no reverse engineering or interfering with the service, and no use that violates your broker&apos;s terms or applicable law.</p>,
        },
        {
          heading: "Disclaimers",
          body: <p>The service is provided &ldquo;as is&rdquo; and &ldquo;as available,&rdquo; without warranties of any kind to the fullest extent permitted by law. We don&apos;t warrant that the service will be uninterrupted, error-free, or that any strategy will be profitable.</p>,
        },
        {
          heading: "Limitation of liability",
          body: <p>To the fullest extent permitted by law, Yuppie Trade is not liable for trading losses, lost profits, or indirect or consequential damages arising from use of the service. Final liability terms will be set with legal counsel before launch.</p>,
        },
        {
          heading: "Termination",
          body: <p>You can stop using the service and close your account at any time. We may suspend or terminate accounts that violate these terms. On termination, automation stops; positions at your broker are not closed automatically.</p>,
        },
        {
          heading: "Changes and contact",
          body: <p>We may update these terms and will notify account holders of material changes. Questions? <Link href="/contact" className="text-fg underline underline-offset-2">Contact us</Link>.</p>,
        },
      ]}
    />
  );
}
