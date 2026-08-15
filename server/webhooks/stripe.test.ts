import { describe, expect, it } from "vitest";
import { stripeStatus } from "./stripe";

describe("Stripe status mapping", () => {
  it("maps provider states to the subscription states accepted by the SaaS", () => {
    expect(stripeStatus("active")).toBe("active");
    expect(stripeStatus("trialing")).toBe("trialing");
    expect(stripeStatus("past_due")).toBe("past_due");
    expect(stripeStatus("canceled")).toBe("cancelled");
    expect(stripeStatus("unpaid")).toBe("cancelled");
  });
});
