// Stripe SDK (Deno resolves the fetch-based "worker" build). Secret: STRIPE_SECRET_KEY.
import Stripe from "npm:stripe@23.1.0";
import type { SupabaseClient, User } from "npm:@supabase/supabase-js@2.119.0";

export const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "");
export { Stripe };

// The caller's Stripe customer id: from our row, else created once and stored. null = database down.
export async function customerFor(db: SupabaseClient, user: User, known?: string | null): Promise<string | null> {
  if (known) return known;
  // Idempotency key: a double tap doesn't create two customers.
  const id = (await stripe.customers.create(
    { email: user.email, metadata: { user_id: user.id } },
    { idempotencyKey: "customer-" + user.id },
  )).id;
  const up = await db.from("subscriptions").upsert({ client_id: user.id, stripe_customer_id: id }, { onConflict: "client_id" });
  return up.error ? null : id;
}
