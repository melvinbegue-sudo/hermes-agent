// Stripe SDK (Deno resolves the fetch-based "worker" build). Secret: STRIPE_SECRET_KEY.
import Stripe from "npm:stripe@23.1.0";

export const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "");
export { Stripe };
