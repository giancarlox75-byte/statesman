import { ButtonLink } from "@/components/ui/Button";
import { Container } from "@/components/ui/Section";

export function CtaBand({
  title = "See the platform for yourself",
  body = "Explore the product, read how it handles risk, and decide whether it fits the way you trade.",
}: {
  title?: string;
  body?: string;
}) {
  return (
    <section className="pb-24">
      <Container>
        <div className="flex flex-col items-start justify-between gap-6 rounded-xl border border-line bg-card px-6 py-10 sm:px-10 md:flex-row md:items-center">
          <div className="max-w-xl">
            <h2 className="text-2xl font-semibold tracking-[-0.02em] text-fg sm:text-3xl">{title}</h2>
            <p className="mt-3 text-muted">{body}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/platform" variant="primary">
              Explore the Platform
            </ButtonLink>
            <ButtonLink href="/contact" variant="secondary">
              Talk to us
            </ButtonLink>
          </div>
        </div>
      </Container>
    </section>
  );
}
