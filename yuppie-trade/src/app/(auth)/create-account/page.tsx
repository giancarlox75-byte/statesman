import type { Metadata } from "next";
import { CreateAccountForm } from "@/components/forms/CreateAccountForm";
import { Card } from "@/components/ui/Section";

export const metadata: Metadata = { title: "Create Account" };

export default function CreateAccountPage() {
  return (
    <Card className="p-7 sm:p-9">
      <h1 className="text-2xl font-semibold tracking-[-0.02em] text-fg">Create your account</h1>
      <p className="mt-2 text-sm text-muted">
        Start with backtesting and paper trading. No broker connection needed.
      </p>
      <div className="mt-8">
        <CreateAccountForm />
      </div>
    </Card>
  );
}
