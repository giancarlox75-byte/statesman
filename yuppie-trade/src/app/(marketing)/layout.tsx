import { SiteFooter } from "@/components/marketing/SiteFooter";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { StageNotice } from "@/components/marketing/StageNotice";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <StageNotice />
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
