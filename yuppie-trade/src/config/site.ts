/**
 * Site-wide settings. Values marked `placeholder: true` MUST be replaced
 * before public launch — see "Launch blockers" in the README.
 */
export const site = {
  name: "Yuppie Trade",
  tagline: "Your strategy. Your rules. Smarter execution.",
  description:
    "Build, test, and automate trading strategies with intelligent tools designed to help you make informed decisions and stay in control.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",

  support: {
    email: "support@yuppietrade.com",
    placeholder: true,
    responseTime: "We aim to reply within two business days.",
  },
  legal: {
    entityName: "Yuppie Trade (legal entity to be confirmed)",
    jurisdiction: "to be confirmed",
    placeholder: true,
    documentsStatus: "Draft — pending review by qualified legal counsel. Not yet in effect.",
  },

  /** Product stage. Drives the site-wide notice and CTA wording. */
  stage: "early-access" as "early-access" | "live",
} as const;

export const mainNav = [
  { label: "Platform", href: "/platform" },
  { label: "How It Works", href: "/how-it-works" },
  { label: "Pricing", href: "/pricing" },
  { label: "Security", href: "/security" },
] as const;

export const footerNav = [
  {
    title: "Product",
    links: [
      { label: "Platform", href: "/platform" },
      { label: "How It Works", href: "/how-it-works" },
      { label: "Pricing", href: "/pricing" },
      { label: "Security & Trust", href: "/security" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact & Support", href: "/contact" },
      { label: "FAQ", href: "/#faq" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", href: "/legal/privacy" },
      { label: "Terms of Service", href: "/legal/terms" },
      { label: "Trading Risk Disclosure", href: "/legal/risk-disclosure" },
    ],
  },
] as const;
