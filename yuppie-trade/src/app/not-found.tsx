import { Logo } from "@/components/brand/Logo";
import { ButtonLink } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <main id="main" className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <Logo />
      <p className="mt-10 text-sm font-medium text-pos">404</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-[-0.02em] text-fg">Page not found</h1>
      <p className="mt-3 max-w-sm text-muted">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
      <div className="mt-8 flex gap-3">
        <ButtonLink href="/">Go home</ButtonLink>
        <ButtonLink href="/contact" variant="secondary">Contact support</ButtonLink>
      </div>
    </main>
  );
}
