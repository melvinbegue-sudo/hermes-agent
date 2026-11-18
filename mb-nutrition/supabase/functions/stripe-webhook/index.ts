// stripe-webhook — Stripe -> table subscriptions. Called by Stripe, not the app: deploy with --no-verify-jwt.
// Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET. Events: checkout.session.completed,
// customer.subscription.created/updated/deleted, invoice.payment_failed.
// Idempotent and order-proof: whatever the event, we re-read the customer's subscriptions from Stripe and write the
// current state, so retries, duplicates and out-of-order deliveries all converge.
import { admin, json } from "../_shared/http.ts";
import { Stripe, stripe } from "../_shared/stripe.ts";
import { normStatus, periodEnd, pickSub } from "../_shared/pure.mjs";

const crypto = Stripe.createSubtleCryptoProvider();
const HANDLED = new Set([
  "checkout.session.completed", "customer.subscription.created", "customer.subscription.updated",
  "customer.subscription.deleted", "invoice.payment_failed",
]);

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const raw = await req.text();
  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, req.headers.get("Stripe-Signature") ?? "",
      Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "", undefined, crypto);
  } catch {
    return json({ error: "signature" }, 400);
  }
  if (!HANDLED.has(event.type)) return json({ ignored: event.type });

  // deno-lint-ignore no-explicit-any
  const obj = event.data.object as any;
  const customer: string | null = typeof obj.customer === "string" ? obj.customer : obj.customer?.id ?? null;
  if (!customer) return json({ ignored: "no_customer" });

  const db = admin();
  try {
    // Which client? Our row (written by create-checkout), else the ids we put in Stripe metadata.
    const { data: row, error } = await db.from("subscriptions").select("client_id").eq("stripe_customer_id", customer).maybeSingle();
    if (error) throw error;
    let clientId: string | null = row?.client_id ?? obj.client_reference_id ?? obj.metadata?.user_id ?? null;
    if (!clientId) {
      const c = await stripe.customers.retrieve(customer);
      clientId = "deleted" in c && c.deleted ? null : c.metadata?.user_id ?? null;
    }
    if (!clientId) return json({ ignored: "unknown_customer" }); // not one of ours: 200 so Stripe stops retrying

    const subs = await stripe.subscriptions.list({ customer, status: "all", limit: 20 });
    const sub = pickSub(subs.data);
    // comp is not in the payload: a webhook never touches the coach's grant.
    const up = await db.from("subscriptions").upsert({
      client_id: clientId,
      stripe_customer_id: customer,
      stripe_subscription_id: sub?.id ?? null,
      status: sub ? normStatus(sub.status) : "none",
      current_period_end: sub ? periodEnd(sub) : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "client_id" });
    if (up.error) throw up.error;
    return json({ ok: true });
  } catch (e) {
    console.error("stripe-webhook", event.type, e instanceof Error ? e.message : e);
    return json({ error: "retry" }, 500); // Stripe retries with backoff
  }
});
