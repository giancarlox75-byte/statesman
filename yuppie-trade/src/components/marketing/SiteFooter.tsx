import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { Container } from "@/components/ui/Section";
import { footerNav, site } from "@/config/site";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line bg-bg">
      <Container className="py-14">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="max-w-xs">
            <Logo />
            <p className="mt-4 text-sm leading-relaxed text-muted">
              Tools to build, test, and automate trading strategies — with you in control.
            </p>
          </div>
          {footerNav.map((group) => (
            <div key={group.title}>
              <h2 className="text-sm font-medium text-fg">{group.title}</h2>
              <ul className="mt-4 space-y-3">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-muted transition-colors hover:text-fg">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 space-y-3 border-t border-line pt-8 text-xs leading-relaxed text-subtle">
          <p>
            Trading involves substantial risk of loss and is not suitable for every investor. Backtested
            and simulated results are hypothetical and do not guarantee future performance. AI-generated
            strategies can be wrong and can lose money. Yuppie Trade provides software tools and does not
            provide investment, tax, or legal advice. Read the{" "}
            <Link href="/legal/risk-disclosure" className="underline underline-offset-2 hover:text-muted">
              Trading Risk Disclosure
            </Link>
            .
          </p>
          <p>
            © {new Date().getFullYear()} {site.name}. All rights reserved.
          </p>
        </div>
      </Container>
    </footer>
  );
}
