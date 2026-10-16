import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/marketing/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro="This policy explains what personal information Yuppie Trade collects, why, and the choices you have. We collect the minimum needed to provide the service, and we don't sell personal information."
      sections={[
        {
          heading: "Information we collect",
          body: (
            <ul>
              <li>Account information: name, email address, and a hashed password.</li>
              <li>Integration data: authorization tokens issued by brokers you connect, and the account, position, and order data those brokers return.</li>
              <li>Strategy data: strategies, settings, risk limits, backtests, and prompts you send to the AI Strategy Lab.</li>
              <li>Usage and device data: log entries, IP address, browser type, and security events.</li>
              <li>Messages you send to support.</li>
            </ul>
          ),
        },
        {
          heading: "What we never collect",
          body: <p>We do not ask for or store your broker password where an official authorization flow is available. We do not request withdrawal permissions where a broker allows us to avoid them.</p>,
        },
        {
          heading: "How we use information",
          body: (
            <ul>
              <li>To provide, secure, and improve the service.</li>
              <li>To run strategies, backtests, and paper or live trading you configure.</li>
              <li>To communicate about your account, security, and service changes.</li>
              <li>To meet legal obligations and enforce our Terms.</li>
            </ul>
          ),
        },
        {
          heading: "AI processing",
          body: <p>When you use the AI Strategy Lab, the text you submit and relevant strategy context are sent to our AI model provider to generate a response. We do not send your broker credentials. We will list our AI and infrastructure providers in this policy before launch.</p>,
        },
        {
          heading: "Sharing",
          body: <p>We share information only with service providers who process it on our behalf under contract (such as hosting, database, email, and AI providers), with brokers you choose to connect, when required by law, or as part of a business transfer. We do not sell personal information or share it for cross-context behavioral advertising.</p>,
        },
        {
          heading: "Security",
          body: <p>We encrypt sensitive data in transit and at rest, restrict access on a need-to-know basis, and keep an audit log of security-relevant activity. No system is perfectly secure; see our <Link href="/security" className="text-fg underline underline-offset-2">Security page</Link>.</p>,
        },
        {
          heading: "Retention",
          body: <p>We keep information while your account is active and for as long as needed to provide the service, resolve disputes, and meet legal or record-keeping obligations. Specific retention periods will be listed here before launch.</p>,
        },
        {
          heading: "Your rights and choices",
          body: <p>Depending on where you live, you may have the right to access, correct, delete, or export your personal information, and to object to or restrict certain processing. You can disconnect integrations at any time. To make a request, <Link href="/contact?topic=privacy" className="text-fg underline underline-offset-2">contact us</Link>.</p>,
        },
        {
          heading: "Cookies",
          body: <p>We use strictly necessary cookies to keep you signed in and secure. We don&apos;t currently use advertising cookies. If that changes, we&apos;ll update this policy and ask for consent where required.</p>,
        },
        {
          heading: "Children",
          body: <p>Yuppie Trade is not intended for anyone under 18, and we don&apos;t knowingly collect information from them.</p>,
        },
        {
          heading: "Changes and contact",
          body: <p>We&apos;ll post changes here and notify account holders of material changes. Questions? <Link href="/contact?topic=privacy" className="text-fg underline underline-offset-2">Contact us</Link>.</p>,
        },
      ]}
    />
  );
}
