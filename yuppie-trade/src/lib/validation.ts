import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address.").max(254);

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password."),
});

export const passwordSchema = z
  .string()
  .min(12, "Use at least 12 characters.")
  .max(128, "Use 128 characters or fewer.")
  .refine((v) => /[a-z]/i.test(v) && /\d/.test(v), "Include at least one letter and one number.");

export const createAccountSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(80),
  email: emailSchema,
  password: passwordSchema,
  acceptTerms: z.literal(true, { error: "You must accept the Terms and Risk Disclosure to continue." }),
});

export const contactTopics = ["general", "support", "pricing", "security", "privacy"] as const;

export const contactSchema = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(80),
  email: emailSchema,
  topic: z.enum(contactTopics),
  message: z.string().trim().min(10, "Tell us a little more (at least 10 characters).").max(4000),
});

export type FieldErrors = Partial<Record<string, string>>;

/** Flatten a Zod error to the first message per field. */
export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
