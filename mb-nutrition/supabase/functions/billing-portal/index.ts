// billing-portal — portail client Stripe (carte, factures, résiliation) -> {url}.
// Secrets: STRIPE_SECRET_KEY, APP_URLS (return URL = body.returnUrl if allowed, else the first entry).
import { admin, caller, CORS, json } from "../_shared/http.ts";
import { stripe } from "../_shared/stripe.ts";
import { allowedUrl } from "../_shared/pure.mjs";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const user = await caller(req);
  if (!user) return json({ error: "auth" }, 401);

  let body: { returnUrl?: string } = {};
  try { body = await req.json(); } catch { /* default below */ }
  const back = allowedUrl(body.returnUrl, Deno.env.get("APP_URLS") ?? "");
  if (!back) return json({ error: "APP_URLS_manquant" }, 500);

  const { data: row, error } = await admin().from("subscriptions")
    .select("stripe_customer_id").eq("client_id", user.id).maybeSingle();
  if (error) return json({ error: "base_indisponible" }, 503);
  if (!row?.stripe_customer_id) return json({ error: "pas_de_client_stripe" }, 404);

  try {
    const s = await stripe.billingPortal.sessions.create({ customer: row.stripe_customer_id, return_url: back, locale: "fr" });
    return json({ url: s.url });
  } catch (e) {
    console.error("stripe", e instanceof Error ? e.message : e);
    return json({ error: "portail_indisponible" }, 502);
  }
});
