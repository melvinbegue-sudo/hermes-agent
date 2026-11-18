// create-checkout — Stripe Checkout (abonnement mensuel) pour le client connecté -> {url}.
// Secrets: STRIPE_SECRET_KEY, STRIPE_PRICE_ID, APP_URLS (comma-separated allowed return URLs; first = default).
import { admin, caller, CORS, json } from "../_shared/http.ts";
import { stripe } from "../_shared/stripe.ts";
import { allowedUrl } from "../_shared/pure.js";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const user = await caller(req);
  if (!user) return json({ error: "auth" }, 401);

  let body: { successUrl?: string; cancelUrl?: string } = {};
  try { body = await req.json(); } catch { /* defaults below */ }
  const allow = Deno.env.get("APP_URLS") ?? "";
  const success = allowedUrl(body.successUrl, allow), cancel = allowedUrl(body.cancelUrl, allow);
  if (!success || !cancel) return json({ error: "APP_URLS_manquant" }, 500);

  const db = admin();
  const { data: row, error } = await db.from("subscriptions")
    .select("stripe_customer_id, status").eq("client_id", user.id).maybeSingle();
  if (error) return json({ error: "base_indisponible" }, 503);
  if (row && ["active", "trialing", "past_due"].includes(row.status)) return json({ error: "deja_abonne" }, 409);

  try {
    let customer = row?.stripe_customer_id;
    if (!customer) {
      // Idempotency key: a double tap doesn't create two customers.
      customer = (await stripe.customers.create(
        { email: user.email, metadata: { user_id: user.id } },
        { idempotencyKey: "customer-" + user.id },
      )).id;
      const up = await db.from("subscriptions").upsert({ client_id: user.id, stripe_customer_id: customer }, { onConflict: "client_id" });
      if (up.error) return json({ error: "base_indisponible" }, 503);
    }
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer,
      client_reference_id: user.id,
      line_items: [{ price: Deno.env.get("STRIPE_PRICE_ID")!, quantity: 1 }],
      subscription_data: { metadata: { user_id: user.id } },
      allow_promotion_codes: true,
      locale: "fr",
      success_url: success,
      cancel_url: cancel,
    });
    return json({ url: session.url });
  } catch (e) {
    console.error("stripe", e instanceof Error ? e.message : e);
    return json({ error: "paiement_indisponible" }, 502);
  }
});
