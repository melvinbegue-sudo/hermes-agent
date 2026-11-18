// send-push — le coach envoie une notification à un client ou à tous -> {sent}. FCM HTTP v1 (Android + iOS via APNs).
// Secret: FCM_SERVICE_ACCOUNT (the whole Firebase service-account JSON). Body: {to: clientId | "all", title, body}.
import { admin, caller, CORS, json } from "../_shared/http.ts";
import { clip, fcmGone, fcmJwt } from "../_shared/pure.js";

let sa: { project_id: string; client_email: string; private_key: string; token_uri?: string } | null = null;
let cached = { token: "", exp: 0 }; // OAuth2 access token, reused while the function instance is warm

async function accessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (cached.token && cached.exp - 60 > now) return cached.token;
  sa ??= JSON.parse(Deno.env.get("FCM_SERVICE_ACCOUNT") ?? "");
  const r = await fetch(sa!.token_uri || "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: await fcmJwt(sa, now) }),
  });
  const t = await r.json();
  if (!r.ok || !t.access_token) throw new Error("oauth " + r.status);
  cached = { token: t.access_token, exp: now + (t.expires_in ?? 3600) };
  return cached.token;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const user = await caller(req);
  if (!user) return json({ error: "auth" }, 401);

  let input: { to?: string; title?: string; body?: string } = {};
  try { input = await req.json(); } catch { /* checked below */ }
  const to = String(input.to ?? ""), title = clip(input.title, 80), body = clip(input.body, 500);
  if (!(to === "all" || UUID.test(to)) || !title) return json({ error: "parametres" }, 400);

  const db = admin();
  const me = await db.from("profiles").select("role").eq("id", user.id).single();
  if (me.error || me.data.role !== "coach") return json({ error: "coach_uniquement" }, 403);

  // Only this coach's clients, whatever `to` says.
  let q = db.from("profiles").select("id").eq("coach_id", user.id);
  if (to !== "all") q = q.eq("id", to);
  const clients = await q;
  if (clients.error) return json({ error: "base_indisponible" }, 503);
  const ids = clients.data.map((c) => c.id);
  if (!ids.length) return json({ sent: 0 });
  const toks = await db.from("push_tokens").select("token").in("user_id", ids);
  if (toks.error) return json({ error: "base_indisponible" }, 503);
  if (!toks.data.length) return json({ sent: 0 });

  let bearer: string;
  try { bearer = await accessToken(); } catch (e) {
    console.error("fcm auth", e instanceof Error ? e.message : e);
    return json({ error: "fcm_indisponible" }, 502);
  }
  const url = `https://fcm.googleapis.com/v1/projects/${sa!.project_id}/messages:send`;
  const dead: string[] = [];
  // shortcut: one request per token, all at once — fine for ~100 clients; batch/throttle beyond a few thousand tokens.
  const results = await Promise.all(toks.data.map(async ({ token }) => {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { Authorization: "Bearer " + bearer, "Content-Type": "application/json" },
        body: JSON.stringify({ message: {
          token,
          notification: { title, body },
          data: { title, body },
          apns: { payload: { aps: { sound: "default" } } },
        } }),
      });
      if (r.ok) return true;
      if (fcmGone(await r.json().catch(() => null))) dead.push(token);
      return false;
    } catch { return false; }
  }));
  if (dead.length) await db.from("push_tokens").delete().in("token", dead);
  return json({ sent: results.filter(Boolean).length });
});
