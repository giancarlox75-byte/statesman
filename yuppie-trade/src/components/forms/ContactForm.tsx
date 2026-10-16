"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field, FormNotice, Input, Select, Textarea } from "./Field";
import { contactSchema, contactTopics, fieldErrors, type FieldErrors } from "@/lib/validation";
import { site } from "@/config/site";

const topicLabel: Record<(typeof contactTopics)[number], string> = {
  general: "General question",
  support: "Product support",
  pricing: "Pricing and plans",
  security: "Security report",
  privacy: "Privacy or data request",
};

export function ContactForm({ initialTopic, initialMessage }: { initialTopic?: string; initialMessage?: string }) {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<"idle" | "opened" | "unavailable">("idle");
  const topic = contactTopics.includes(initialTopic as never) ? initialTopic : "general";

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = contactSchema.safeParse(Object.fromEntries(new FormData(e.currentTarget)));
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      setStatus("idle");
      return;
    }
    setErrors({});
    if (site.support.placeholder) {
      setStatus("unavailable");
      return;
    }
    // Until a server-side ticketing endpoint exists (Stage 5), hand off to the user's mail client.
    const { name, email, topic: t, message } = parsed.data;
    const subject = encodeURIComponent(`[${topicLabel[t]}] from ${name}`);
    const body = encodeURIComponent(`${message}\n\n— ${name} <${email}>`);
    window.location.href = `mailto:${site.support.email}?subject=${subject}&body=${body}`;
    setStatus("opened");
  }

  return (
    <form noValidate onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="name" label="Name" error={errors.name}>
          <Input id="name" name="name" autoComplete="name" invalid={!!errors.name} />
        </Field>
        <Field id="email" label="Email" error={errors.email}>
          <Input id="email" name="email" type="email" autoComplete="email" invalid={!!errors.email} />
        </Field>
      </div>
      <Field id="topic" label="Topic" error={errors.topic}>
        <Select id="topic" name="topic" defaultValue={topic}>
          {contactTopics.map((t) => (
            <option key={t} value={t}>
              {topicLabel[t]}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="message" label="Message" error={errors.message}>
        <Textarea id="message" name="message" defaultValue={initialMessage} invalid={!!errors.message} />
      </Field>
      <p className="text-xs leading-relaxed text-subtle">
        Please don&apos;t include passwords, API keys, or full account numbers. We will never ask for them.
      </p>
      {status === "unavailable" && (
        <FormNotice tone="info">
          Our support inbox is still being set up, so this message was not sent. Please check back soon —
          we&apos;re sorry for the inconvenience.
        </FormNotice>
      )}
      {status === "opened" && (
        <FormNotice tone="success">
          Your email app should open with the message filled in. If it didn&apos;t, email us at{" "}
          <span className="text-fg">{site.support.email}</span>.
        </FormNotice>
      )}
      <Button type="submit" variant="primary">
        Send Message
      </Button>
    </form>
  );
}
