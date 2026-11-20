// delete-account — le client supprime son compte (RGPD art. 17) -> {ok:true}.
// Order: Stripe first (a failure there deletes nothing, the client retries), then photo files, Cal.com bookings,
// then the auth user (cascades to profile, days, weights, messages, consents…). Every step is safe to re-run.
// The coach account cannot delete itself here (it would orphan every client): 403.
// Stripe customer + invoices are kept on purpose: billing records must be kept 10 years (Code de commerce L123-22).
// Secrets: STRIPE_SECRET_KEY.
import { admin, caller, CORS, json } from "../_shared/http.ts";
import { stripe } from "../_shared/stripe.ts";
import { cancellable } from "../_shared/pure.mjs";

type DB = ReturnType<typeof admin>;

// Every object under prefix (storage list is one level deep: folders come back with id null).
async function files(db: DB, prefix: string): Promise<string[]> {
  const out: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.storage.from("photos").list(prefix, { limit: 1000, offset });
    if (error) throw error;
    for (const f of data) {
      const p = prefix + "/" + f.name;
      if (f.id === null) out.push(...await files(db, p)); else out.push(p);
    }
    if (data.length < 1000) return out;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const user = await caller(req);
  if (!user) return json({ error: "auth" }, 401); // also what an already-deleted account gets

  const db = admin();
  const me = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (me.error) return json({ error: "base_indisponible" }, 503);
  if (me.data?.role === "coach") return json({ error: "compte_coach" }, 403);

  // 1. Stop billing now (no proration credit). Customer from our row, else the user_id we put in Stripe metadata.
  try {
    const row = await db.from("subscriptions").select("stripe_customer_id").eq("client_id", user.id).maybeSingle();
    if (row.error) throw row.error;
    const customers = new Set<string>();
    if (row.data?.stripe_customer_id) customers.add(row.data.stripe_customer_id);
    for (const c of (await stripe.customers.search({ query: `metadata['user_id']:'${user.id}'` })).data) customers.add(c.id);
    for (const customer of customers) {
      const subs = (await stripe.subscriptions.list({ customer, status: "all", limit: 100 })).data;
      for (const id of cancellable(subs)) await stripe.subscriptions.cancel(id, { prorate: false });
    }
  } catch (e) {
    console.error("delete-account stripe", e instanceof Error ? e.message : e);
    return json({ error: "paiement_indisponible" }, 502);
  }

  try {
    // 2. Photo files (the photos table rows go with the cascade, the files would not).
    const paths = await files(db, user.id);
    for (let i = 0; i < paths.length; i += 1000) {
      const { error } = await db.storage.from("photos").remove(paths.slice(i, i + 1000));
      if (error) throw error;
    }
    // 3. Bookings: client_id is "on delete set null", which would keep the email and call times.
    for (const [col, v] of [["client_id", user.id], ["email", (user.email ?? "").toLowerCase()]]) {
      if (!v) continue;
      const { error } = await db.from("bookings").delete().eq(col, v);
      if (error) throw error;
    }
    // 4. The account itself. Cascades to every public.* row of this user.
    const { error } = await db.auth.admin.deleteUser(user.id);
    if (error && error.status !== 404) throw error;
    return json({ ok: true });
  } catch (e) {
    console.error("delete-account", e instanceof Error ? e.message : e);
    return json({ error: "suppression_incomplete" }, 500); // safe to retry
  }
});
