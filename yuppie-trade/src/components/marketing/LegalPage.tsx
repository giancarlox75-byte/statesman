import type { ReactNode } from "react";
import { FileWarning } from "lucide-react";
import { Container } from "@/components/ui/Section";
import { site } from "@/config/site";

export type LegalSection = { heading: string; body: ReactNode };

export function LegalPage({ title, intro, sections }: { title: string; intro: ReactNode; sections: LegalSection[] }) {
  return (
    <Container className="py-16 sm:py-20">
      <article className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-semibold tracking-[-0.025em] text-fg">{title}</h1>
        <div className="mt-6 flex gap-3 rounded-md border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-fg">
          <FileWarning size={18} className="mt-0.5 shrink-0 text-warn" aria-hidden />
          <p>
            <strong className="font-medium">{site.legal.documentsStatus}</strong> Operator: {site.legal.entityName}.
            Governing jurisdiction: {site.legal.jurisdiction}.
          </p>
        </div>
        <div className="mt-8 text-lg leading-relaxed text-muted">{intro}</div>
        <nav aria-label="Contents" className="mt-10 rounded-lg border border-line bg-card p-5">
          <p className="text-sm font-medium text-fg">Contents</p>
          <ol className="mt-3 grid gap-1.5 text-sm text-muted sm:grid-cols-2">
            {sections.map((s, i) => (
              <li key={s.heading}>
                <a href={`#s${i + 1}`} className="hover:text-fg">
                  {i + 1}. {s.heading}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <div className="mt-12 space-y-10">
          {sections.map((s, i) => (
            <section key={s.heading} id={`s${i + 1}`} className="scroll-mt-28">
              <h2 className="text-xl font-medium text-fg">
                {i + 1}. {s.heading}
              </h2>
              <div className="mt-3 space-y-3 leading-relaxed text-muted [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-2">
                {s.body}
              </div>
            </section>
          ))}
        </div>
      </article>
    </Container>
  );
}
