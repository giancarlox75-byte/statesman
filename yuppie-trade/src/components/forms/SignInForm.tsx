"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field, FormNotice, Input } from "./Field";
import { fieldErrors, signInSchema, type FieldErrors } from "@/lib/validation";

export function SignInForm() {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [done, setDone] = useState(false);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    const parsed = signInSchema.safeParse(data);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      setDone(false);
      return;
    }
    setErrors({});
    // Authentication ships in Stage 5. Until then nothing is transmitted.
    setDone(true);
  }

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-5">
      <Field id="email" label="Email" error={errors.email}>
        <Input id="email" name="email" type="email" autoComplete="email" invalid={!!errors.email} />
      </Field>
      <Field id="password" label="Password" error={errors.password}>
        <Input id="password" name="password" type="password" autoComplete="current-password" invalid={!!errors.password} />
      </Field>
      {done && (
        <FormNotice tone="info">
          Sign-in isn&apos;t open yet — accounts launch with early access. Nothing you entered was sent or
          stored. In the meantime, you can{" "}
          <Link href="/platform" className="text-fg underline underline-offset-2">
            explore the platform
          </Link>
          .
        </FormNotice>
      )}
      <Button type="submit" variant="primary" className="w-full">
        Sign In
      </Button>
      <p className="text-center text-sm text-muted">
        New to Yuppie Trade?{" "}
        <Link href="/create-account" className="text-fg underline-offset-2 hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}
