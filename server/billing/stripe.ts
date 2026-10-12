import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
  console.warn("[Stripe] STRIPE_SECRET_KEY não está configurada; configure-a antes de usar a cobrança.");
}

export const stripe = new Stripe(secretKey ?? "sk_test_unconfigured");
