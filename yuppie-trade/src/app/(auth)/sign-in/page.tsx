import type { Metadata } from "next";
import { SignInForm } from "@/components/forms/SignInForm";
import { Card } from "@/components/ui/Section";

export const metadata: Metadata = { title: "Sign In" };

export default function SignInPage() {
  return (
    <Card className="p-7 sm:p-9">
      <h1 className="text-2xl font-semibold tracking-[-0.02em] text-fg">Sign in</h1>
      <p className="mt-2 text-sm text-muted">Welcome back. Sign in to your workspace.</p>
      <div className="mt-8">
        <SignInForm />
      </div>
    </Card>
  );
}
