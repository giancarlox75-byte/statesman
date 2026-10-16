"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui/Button";
import { mainNav } from "@/config/site";
import { cn } from "@/lib/cn";

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-40 border-b border-transparent bg-bg/80 backdrop-blur-md supports-[backdrop-filter]:bg-bg/60">
      <div className="mx-auto flex h-20 max-w-[1280px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <nav
          aria-label="Main"
          className="flex h-14 items-center gap-2 rounded-xl border border-line bg-card/70 pl-5 pr-2"
        >
          <Logo />
          <ul className="ml-8 hidden items-center gap-1 lg:flex">
            {mainNav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={cn(
                    "rounded-md px-3.5 py-2 text-[15px] transition-colors",
                    isActive(item.href) ? "text-fg" : "text-muted hover:text-fg",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="hidden h-14 items-center gap-1 rounded-xl border border-line bg-card/70 p-1.5 lg:flex">
          <ButtonLink href="/sign-in" variant="ghost" size="sm" className="px-4 text-[15px]">
            Sign In
          </ButtonLink>
          <ButtonLink href="/create-account" variant="accent" size="sm" className="h-10 px-4 text-[15px]">
            Get Started
          </ButtonLink>
        </div>

        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-card text-fg lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {open && (
        <div id="mobile-menu" className="border-t border-line bg-bg lg:hidden">
          <ul className="mx-auto max-w-[1280px] space-y-1 px-4 py-4 sm:px-6">
            {mainNav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className="block rounded-md px-3 py-3 text-base text-muted hover:bg-card hover:text-fg aria-[current=page]:text-fg"
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li className="grid grid-cols-2 gap-2 pt-3">
              <ButtonLink href="/sign-in" variant="secondary">
                Sign In
              </ButtonLink>
              <ButtonLink href="/create-account" variant="accent">
                Get Started
              </ButtonLink>
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}
