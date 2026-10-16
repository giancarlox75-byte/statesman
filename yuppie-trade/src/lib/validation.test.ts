import { describe, expect, it } from "vitest";
import { contactSchema, createAccountSchema, fieldErrors, signInSchema } from "./validation";

describe("validation", () => {
  it("normalizes email on sign-in", () => {
    const r = signInSchema.parse({ email: "  Me@Example.COM ", password: "x" });
    expect(r.email).toBe("me@example.com");
  });
  it("rejects weak passwords and unaccepted terms", () => {
    const r = createAccountSchema.safeParse({ name: "A", email: "a@b.co", password: "short", acceptTerms: false });
    expect(r.success).toBe(false);
    if (!r.success) {
      const e = fieldErrors(r.error);
      expect(e.password).toMatch(/12 characters/);
      expect(e.acceptTerms).toBeDefined();
    }
  });
  it("accepts a valid account", () => {
    expect(
      createAccountSchema.safeParse({ name: "Ann", email: "a@b.co", password: "correct horse 42", acceptTerms: true }).success,
    ).toBe(true);
  });
  it("rejects unknown contact topics", () => {
    expect(contactSchema.safeParse({ name: "A", email: "a@b.co", topic: "spam", message: "hello there!" }).success).toBe(false);
  });
});
