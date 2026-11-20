// stripe-webhook — Stripe -> table subscriptions. Called by Stripe, not the app: deploy with --no-verify-jwt.
// Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET. Events: checkout.session.completed,
// customer.subscription.created/updated/deleted, invoice.payment_failed.
// Idempotent and order-proof: whatever the event, we re-read the customer's subscriptions from Stripe and write the
// current state, so retries, duplicates and out-of-order deliveries all converge.
import { admin, json } from "../_shared/http.ts";
import { Stripe, stripe } from "../_shared/stripe.ts";
import { clientByEmail, webhookRow } from "../_shared/pure.mjs";

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
    // Which client? Our row (create-checkout, or an earlier e-mail match), else the ids we put in Stripe metadata,
    // else the customer's e-mail (payment link sent by Melvin: no metadata). The upsert then stores stripe_customer_id.
    // shortcut: a client paying by link AND by in-web Checkout gets one row for the last customer seen; fine for one sub per client.
    const { data: row, error } = await db.from("subscriptions").select("client_id").eq("stripe_customer_id", customer).maybeSingle();
    if (error) throw error;
    // client_reference_id from the web payment link is the client code (MB-…), not a user id: only a uuid counts.
    const ref = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(obj.client_reference_id ?? "") ? obj.client_reference_id : null;
    let clientId: string | null = row?.client_id ?? ref ?? obj.metadata?.user_id ?? null;
    if (!clientId) {
      const c = await stripe.customers.retrieve(customer);
      const live = !("deleted" in c && c.deleted);
      clientId = live ? c.metadata?.user_id ?? null : null;
      const email: string | null = live ? c.email ?? obj.customer_details?.email ?? null : null;
      if (!clientId && email) {
        const q = await db.from("profiles").select("id, role, email")
          .ilike("email", email.trim().replace(/[\\%_]/g, "\\$&")).limit(5); // escaped: exact, case-insensitive
        if (q.error) throw q.error;
        clientId = clientByEmail(email, q.data);
      }
    }
    let hasProfile = false, subs: unknown[] = [];
    if (clientId) {
      const p = await db.from("profiles").select("id").eq("id", clientId).maybeSingle();
      if (p.error) throw p.error;
      hasProfile = !!p.data;
    }
    if (hasProfile) subs = (await stripe.subscriptions.list({ customer, status: "all", limit: 20 })).data;
    const d = webhookRow({ clientId, hasProfile, customer, subs });
    if (d.ignored) return json({ ignored: d.ignored });
    const up = await db.from("subscriptions").upsert(d.row, { onConflict: "client_id" });
    if (up.error?.code === "23503") return json({ ignored: "deleted_client" }); // profile deleted between the two queries
    if (up.error) throw up.error;
    return json({ ok: true });
  } catch (e) {
    console.error("stripe-webhook", event.type, e instanceof Error ? e.message : e);
    return json({ error: "retry" }, 500); // Stripe retries with backoff
  }
});
