import { describe, expect, it } from "vitest";
import { billingEnabled, formatPrice, hasBothIntervals, hasPublishedPricing, plans } from "./plans";
import { capabilities } from "./capabilities";

describe("plans", () => {
  it("cannot enable billing without published prices", () => {
    if (billingEnabled) expect(hasPublishedPricing()).toBe(true);
  });
  it("detects published pricing and intervals", () => {
    expect(hasPublishedPricing([])).toBe(false);
    const p = { ...plans[0], price: { monthly: 20, annual: null } };
    expect(hasPublishedPricing([p])).toBe(true);
    expect(hasBothIntervals([p])).toBe(false);
    expect(hasBothIntervals([{ ...p, price: { monthly: 20, annual: 16 } }])).toBe(true);
  });
  it("formats prices", () => {
    expect(formatPrice(null)).toBe("TBA");
    expect(formatPrice(29)).toBe("$29");
    expect(formatPrice(29.5)).toBe("$29.50");
  });
});

describe("capabilities", () => {
  it("covers the four spec capabilities exactly once", () => {
    expect(capabilities.map((c) => c.id).sort()).toEqual(
      ["ai-strategies", "automated-execution", "backtesting", "risk-controls"],
    );
  });
  it("does not mark live execution available while it is unbuilt", () => {
    expect(capabilities.find((c) => c.id === "automated-execution")?.status).not.toBe("available");
  });
});
