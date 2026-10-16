import type { ReactNode } from "react";
import { Container, SectionHeading } from "@/components/ui/Section";

export function PageHero({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden border-b border-line">
      <div className="hero-backdrop pointer-events-none absolute inset-0 opacity-70" aria-hidden />
      <Container className="relative py-16 sm:py-24">
        <SectionHeading as="h1" eyebrow={eyebrow} title={title} description={description} />
        {children}
      </Container>
    </section>
  );
}
