// create-subscription — abonnement payé dans l'appli (PaymentSheet : carte, Apple Pay, Google Pay).
// -> {clientSecret, customerId, ephemeralKey, subscriptionId, publishableKey}. The sub starts `incomplete`; paying the
// first invoice's PaymentIntent makes it active, and stripe-webhook (customer.subscription.updated) unlocks the app.
// Secrets: STRIPE_SECRET_KEY, STRIPE_PRICE_ID, STRIPE_PUBLISHABLE_KEY.
import { admin, caller, CORS, json } from "../_shared/http.ts";
import { customerFor, Stripe, stripe } from "../_shared/stripe.ts";
import { sheetPlan } from "../_shared/pure.mjs";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const user = await caller(req);
  if (!user) return json({ error: "auth" }, 401);
  const price = Deno.env.get("STRIPE_PRICE_ID"), publishableKey = Deno.env.get("STRIPE_PUBLISHABLE_KEY");
  if (!price || !publishableKey) return json({ error: "config_manquante" }, 500); // app falls back to Checkout

  const db = admin();
  const { data: row, error } = await db.from("subscriptions")
    .select("stripe_customer_id, status").eq("client_id", user.id).maybeSingle();
  if (error) return json({ error: "base_indisponible" }, 503);
  if (row && ["active", "trialing", "past_due"].includes(row.status)) return json({ error: "deja_abonne" }, 409);

  try {
    const customer = await customerFor(db, user, row?.stripe_customer_id);
    if (!customer) return json({ error: "base_indisponible" }, 503);
    // Stripe is the truth (the webhook may lag): live sub -> 409, unpaid one -> reuse its PaymentIntent.
    const subs = (await stripe.subscriptions.list({ customer, status: "all", limit: 20,
      expand: ["data.latest_invoice.confirmation_secret"] })).data;
    const plan = sheetPlan(subs, price);
    if (plan.conflict) return json({ error: "deja_abonne" }, 409);
    const sub = plan.reuse ?? await stripe.subscriptions.create({
      customer,
      items: [{ price }],
      payment_behavior: "default_incomplete",
      payment_settings: { save_default_payment_method: "on_subscription" }, // renewals charge the same card / wallet
      metadata: { user_id: user.id },
      expand: ["latest_invoice.confirmation_secret"],
    });
    // deno-lint-ignore no-explicit-any
    const clientSecret = (sub.latest_invoice as any)?.confirmation_secret?.client_secret;
    if (!clientSecret) return json({ error: "paiement_indisponible" }, 502);
    const key = await stripe.ephemeralKeys.create({ customer }, { apiVersion: Stripe.API_VERSION });
    return json({ clientSecret, customerId: customer, ephemeralKey: key.secret, subscriptionId: sub.id, publishableKey });
  } catch (e) {
    console.error("stripe", e instanceof Error ? e.message : e);
    return json({ error: "paiement_indisponible" }, 502);
  }
});
