import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { StageNotice } from "@/components/marketing/StageNotice";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <StageNotice />
      <div className="relative flex flex-1 flex-col">
        <div className="hero-backdrop pointer-events-none absolute inset-0 opacity-60" aria-hidden />
        <header className="relative mx-auto flex w-full max-w-[1200px] items-center justify-between px-4 py-6 sm:px-6 lg:px-8">
          <Logo />
          <Link href="/" className="flex items-center gap-1.5 text-sm text-muted hover:text-fg">
            <ArrowLeft size={15} aria-hidden /> Back to site
          </Link>
        </header>
        <main id="main" className="relative flex flex-1 items-start justify-center px-4 pb-16 pt-8 sm:pt-16">
          <div className="w-full max-w-md">{children}</div>
        </main>
        <footer className="relative flex flex-wrap justify-center gap-x-6 gap-y-2 px-4 pb-8 text-xs text-subtle">
          <Link href="/legal/privacy" className="hover:text-muted">Privacy</Link>
          <Link href="/legal/terms" className="hover:text-muted">Terms</Link>
          <Link href="/legal/risk-disclosure" className="hover:text-muted">Risk Disclosure</Link>
          <Link href="/contact" className="hover:text-muted">Support</Link>
        </footer>
      </div>
    </>
  );
}
