import type { Metadata } from "next";
import { Logo, LogoMark } from "@/components/brand/Logo";
import { Badge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card, Container } from "@/components/ui/Section";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Field, FormNotice, Input } from "@/components/forms/Field";
import { Sparkline } from "@/components/ui/Sparkline";
import { sampleSeries } from "@/lib/sample-data";

export const metadata: Metadata = { title: "Design System", robots: { index: false } };

const colors = [
  ["Background", "bg-bg", "#0B0D10"],
  ["Card", "bg-card", "#13171E"],
  ["Elevated", "bg-elevated", "#1B212A"],
  ["Border", "bg-line", "#292F39"],
  ["Text", "bg-fg", "#FFFFFF"],
  ["Secondary text", "bg-muted", "#A8B0BC"],
  ["Positive", "bg-pos", "#39D98A"],
  ["Negative", "bg-neg", "#F06B75"],
];

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-line py-10">
      <h2 className="mb-6 text-sm font-medium uppercase tracking-[0.14em] text-subtle">{title}</h2>
      {children}
    </section>
  );
}

export default function DesignSystemPage() {
  return (
    <main id="main" className="flex-1">
      <Container className="py-16">
        <h1 className="text-4xl font-semibold tracking-[-0.025em]">Yuppie Trade design system</h1>
        <p className="mt-3 text-muted">Internal reference for tokens and components. Not linked from the public site.</p>

        <Block title="Logo">
          <div className="flex flex-wrap items-center gap-10">
            <Logo />
            <LogoMark className="h-16 w-16 text-fg" title="Yuppie Trade" />
            <div className="rounded-lg bg-fg p-4 text-bg"><LogoMark className="h-12 w-12" title="Yuppie Trade on light" /></div>
          </div>
        </Block>

        <Block title="Color">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {colors.map(([name, cls, hex]) => (
              <div key={name}>
                <div className={`h-16 rounded-md border border-line ${cls}`} />
                <p className="mt-2 text-sm text-fg">{name}</p>
                <p className="font-mono text-xs text-subtle">{hex}</p>
              </div>
            ))}
          </div>
        </Block>

        <Block title="Type">
          <p className="text-6xl font-semibold tracking-[-0.035em]">Display 60</p>
          <p className="mt-3 text-4xl font-semibold tracking-[-0.025em]">Heading 36</p>
          <p className="mt-3 text-xl font-medium">Title 20</p>
          <p className="mt-3 text-muted">Body 16 — secondary text for descriptions and supporting copy.</p>
          <p className="tabular mt-3 font-mono text-sm text-muted">$158,290.50 · +8.34% · 1,024 shares</p>
        </Block>

        <Block title="Buttons">
          <div className="flex flex-wrap gap-3">
            <Button>Primary</Button>
            <Button variant="accent">Accent</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button disabled>Disabled</Button>
            <ButtonLink href="/" size="sm" variant="secondary">Small link</ButtonLink>
          </div>
        </Block>

        <Block title="Badges & states">
          <div className="flex flex-wrap gap-2">
            <Badge dot>Draft</Badge>
            <Badge tone="info" dot>Testing</Badge>
            <Badge tone="positive" dot>Paper Trading</Badge>
            <Badge tone="positive" dot>Active</Badge>
            <Badge tone="warning" dot>Paused</Badge>
            <Badge tone="negative" dot>Error</Badge>
            <StatusBadge status="available" />
            <StatusBadge status="demo" />
            <StatusBadge status="in-development" />
            <StatusBadge status="planned" />
          </div>
        </Block>

        <Block title="Forms">
          <div className="grid max-w-xl gap-5">
            <Field id="ds-a" label="Default"><Input id="ds-a" placeholder="you@example.com" /></Field>
            <Field id="ds-b" label="With error" error="Enter a valid email address."><Input id="ds-b" invalid defaultValue="nope" /></Field>
            <FormNotice tone="info">Informational notice.</FormNotice>
            <FormNotice tone="success">Success notice.</FormNotice>
            <FormNotice tone="error">Error notice.</FormNotice>
          </div>
        </Block>

        <Block title="Cards & charts (sample data)">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="p-5">
              <p className="text-sm text-muted">Gain</p>
              <Sparkline data={sampleSeries(50, 4)} className="mt-3 h-20 w-full" />
            </Card>
            <Card className="p-5">
              <p className="text-sm text-muted">Loss</p>
              <Sparkline data={sampleSeries(50, 9, 100, -0.003)} positive={false} className="mt-3 h-20 w-full" />
            </Card>
          </div>
        </Block>
      </Container>
    </main>
  );
}
