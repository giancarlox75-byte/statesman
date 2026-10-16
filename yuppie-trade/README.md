# Yuppie Trade

AI-assisted trading software: build, test, and automate trading strategies with risk controls built in.

This folder is a standalone Next.js app. It shares nothing with the Statesman game in the repo root.

## Run it

Requires Node 20+.

```bash
cd yuppie-trade
npm install
npm run dev        # http://localhost:3000
npm test           # unit tests (Vitest)
npm run typecheck
npm run build      # production build
```

No environment variables are needed yet. See `.env.example` for what later stages add.

## Stack

| Concern | Choice |
|---|---|
| App + API | Next.js 16 (App Router) + TypeScript |
| Styling | Tailwind CSS v4 with brand tokens in `src/app/globals.css` |
| Type | Geist Sans / Geist Mono |
| Icons | Lucide |
| Validation | Zod (`src/lib/validation.ts`) |
| Tests | Vitest |

## Layout

```
src/
  app/
    (marketing)/     public pages with shared header/footer
    (auth)/          sign-in, create-account
    design-system/   internal component reference (noindex, unlinked)
  components/
    brand/           Logo (SVG Y mark + wordmark)
    ui/              Button, Badge, Card, Section, Sparkline, StatusBadge
    marketing/       Header, Footer, DashboardPreview, PricingTable, FAQ, …
    forms/           Field primitives + the three forms
  config/
    site.ts          name, nav, support + legal details (placeholders flagged)
    capabilities.ts  real status of each capability — the site reads from here
    plans.ts         pricing plans; prices null until set, billing off
    faq.ts           FAQ copy
  lib/               validation, sample data, helpers
```

## Honesty rules built into the code

- **Capability status** (`config/capabilities.ts`) is the only place a feature is marked Available / In development / Planned. Change it when something actually ships.
- **Pricing** shows "to be announced" while every price is `null`. The billing toggle only appears once both monthly and annual prices exist. Purchase buttons only appear when `billingEnabled` is true, and a test fails if that is enabled without prices.
- **Sample data** (`lib/sample-data.ts`) is deterministic and is only rendered inside components labeled "Sample data".
- **Gain/loss colors** are derived from the sign of the value, never hardcoded.

## Launch blockers (must fix before going public)

1. `site.support.email` is a placeholder. Until it's replaced, the contact form tells users their message was **not** sent.
2. `site.legal.entityName` and `jurisdiction` are placeholders.
3. The Privacy Policy, Terms, and Risk Disclosure are **drafts** and must be reviewed by a securities/fintech lawyer.
4. Sign-in and account creation validate input but do not create accounts yet (Stage 5). They say so plainly.
5. Prices are not set and billing is not implemented.

## Stage status

- [x] Stage 1: repository inspected, plan agreed
- [x] Stage 2: design system, logo, components, responsive navigation
- [x] Stage 3: all 12 public pages
- [ ] Stage 4: authenticated dashboard (demo data)
- [ ] Stage 5: auth, database, settings, integration management
- [ ] Stage 6: backtesting, paper trading, first broker integration (Alpaca paper)
- [ ] Stage 7: live trading, gated on security + legal review
- [ ] Stage 8: audits, accessibility pass, deployment docs

## Deploying (Vercel)

Create a **new** Vercel project from this repo and set **Root Directory** to `yuppie-trade`. The Statesman project in the repo root is unaffected.
