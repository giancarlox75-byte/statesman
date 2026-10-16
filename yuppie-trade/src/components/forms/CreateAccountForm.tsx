"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field, FormNotice, Input } from "./Field";
import { createAccountSchema, fieldErrors, type FieldErrors } from "@/lib/validation";

export function CreateAccountForm() {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [done, setDone] = useState(false);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = createAccountSchema.safeParse({
      name: form.get("name"),
      email: form.get("email"),
      password: form.get("password"),
      acceptTerms: form.get("acceptTerms") === "on",
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      setDone(false);
      return;
    }
    setErrors({});
    // Account creation ships in Stage 5. Until then nothing is transmitted.
    setDone(true);
  }

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-5">
      <Field id="name" label="Full name" error={errors.name}>
        <Input id="name" name="name" autoComplete="name" invalid={!!errors.name} />
      </Field>
      <Field id="email" label="Email" error={errors.email}>
        <Input id="email" name="email" type="email" autoComplete="email" invalid={!!errors.email} />
      </Field>
      <Field
        id="password"
        label="Password"
        error={errors.password}
        hint="At least 12 characters, including a letter and a number."
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          invalid={!!errors.password}
          aria-describedby={errors.password ? "password-error" : "password-hint"}
        />
      </Field>
      <div>
        <label className="flex items-start gap-3 text-sm leading-relaxed text-muted">
          <input
            type="checkbox"
            name="acceptTerms"
            className="mt-1 h-4 w-4 shrink-0 accent-[#39D98A]"
            aria-invalid={!!errors.acceptTerms || undefined}
            aria-describedby={errors.acceptTerms ? "acceptTerms-error" : undefined}
          />
          <span>
            I agree to the{" "}
            <Link href="/legal/terms" className="text-fg underline underline-offset-2">
              Terms of Service
            </Link>{" "}
            and have read the{" "}
            <Link href="/legal/risk-disclosure" className="text-fg underline underline-offset-2">
              Trading Risk Disclosure
            </Link>{" "}
            and{" "}
            <Link href="/legal/privacy" className="text-fg underline underline-offset-2">
              Privacy Policy
            </Link>
            .
          </span>
        </label>
        {errors.acceptTerms && (
          <p id="acceptTerms-error" className="mt-1.5 text-sm text-neg">
            {errors.acceptTerms}
          </p>
        )}
      </div>
      {done && (
        <FormNotice tone="info">
          Account creation opens with early access. Nothing you entered was sent or stored. Want to hear
          when it opens?{" "}
          <Link href="/contact?topic=general" className="text-fg underline underline-offset-2">
            Contact us
          </Link>
          .
        </FormNotice>
      )}
      <Button type="submit" variant="accent" className="w-full">
        Create Account
      </Button>
      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/sign-in" className="text-fg underline-offset-2 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
