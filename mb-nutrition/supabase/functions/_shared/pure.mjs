// Pure helpers shared by the Edge Functions. Plain JS (WebCrypto only) so node:test can import it too
// (tests/backend.test.mjs). No Deno / npm imports here.

// Stripe subscription status -> our status (ARCHITECTURE.md billing.status). past_due stays: Stripe retries, then cancels.
export function normStatus(s) {
  if (s === "active" || s === "trialing" || s === "past_due") return s;
  if (s === "canceled" || s === "unpaid" || s === "incomplete_expired" || s === "paused") return "canceled";
  return "none"; // incomplete (first payment not done) or unknown
}

// The subscription that matters among a customer's subscriptions: a live one first, else the newest.
export function pickSub(subs) {
  const list = (subs || []).slice().sort((a, b) => (b.created || 0) - (a.created || 0));
  return list.find((s) => ["active", "trialing", "past_due"].includes(s.status)) || list[0] || null;
}

// Since Stripe API 2025-03-31 the period end lives on the items.
export function periodEnd(sub) {
  const t = sub?.items?.data?.[0]?.current_period_end ?? sub?.current_period_end;
  return t ? new Date(t * 1000).toISOString() : null;
}

// stripe-webhook decision: who the customer is + whether their profile still exists + their Stripe subs
// -> {row} to upsert into subscriptions, or {ignored} (200, so Stripe stops retrying).
// The row never carries comp: a webhook must not wipe the coach's free-access grant.
export function webhookRow({ clientId, hasProfile, customer, subs, now = new Date() }) {
  if (!clientId) return { ignored: "unknown_customer" }; // not one of ours
  if (!hasProfile) return { ignored: "deleted_client" }; // account deleted while Stripe still bills: FK would fail forever
  const sub = pickSub(subs);
  return { row: {
    client_id: clientId,
    stripe_customer_id: customer,
    stripe_subscription_id: sub?.id ?? null,
    status: sub ? normStatus(sub.status) : "none",
    current_period_end: sub ? periodEnd(sub) : null,
    cancel_at_period_end: !!(sub?.cancel_at_period_end || sub?.cancel_at), // newer API versions may set cancel_at instead
    updated_at: now.toISOString(),
  } };
}

// Redirect URL from the app, accepted only if its origin is in the allowlist; else the first allowed URL.
export function allowedUrl(url, allow) {
  const list = String(allow || "").split(",").map((s) => s.trim()).filter(Boolean);
  try {
    const u = new URL(url);
    if ((u.protocol === "https:" || u.protocol === "http:") && list.some((a) => new URL(a).origin === u.origin)) return u.href;
  } catch { /* falls back */ }
  return list[0] || null;
}

export const clip = (v, n) => String(v ?? "").trim().slice(0, n);

const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");

// Cal.com: header x-cal-signature-256 = hex HMAC-SHA256(raw body, webhook secret).
export async function verifyCal(raw, sig, secret) {
  if (!secret || !sig) return false;
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const want = hex(await crypto.subtle.sign("HMAC", key, enc.encode(raw)));
  const got = String(sig).trim().toLowerCase().replace(/^sha256=/, "");
  if (got.length !== want.length) return false;
  let d = 0;
  for (let i = 0; i < want.length; i++) d |= want.charCodeAt(i) ^ got.charCodeAt(i); // constant time
  return d === 0;
}

// Cal.com webhook body -> booking row + the uid it replaces (reschedule). null if not a booking event.
// Assumed shape (Cal.com docs, not reachable when written): {triggerEvent, payload:{uid, startTime, endTime,
// attendees:[{email}], location, metadata:{videoCallUrl}, rescheduleUid?}}.
export function calBooking(body) {
  const ev = body?.triggerEvent, p = body?.payload;
  if (!p?.uid || !["BOOKING_CREATED", "BOOKING_RESCHEDULED", "BOOKING_CANCELLED"].includes(ev)) return null;
  const loc = typeof p.location === "string" && /^https:\/\//.test(p.location) ? p.location : null;
  const meet = typeof p.metadata?.videoCallUrl === "string" && /^https:\/\//.test(p.metadata.videoCallUrl) ? p.metadata.videoCallUrl : loc;
  return {
    row: {
      cal_uid: String(p.uid),
      email: clip(p.attendees?.[0]?.email, 320).toLowerCase() || null,
      starts_at: new Date(p.startTime).toISOString(),
      ends_at: new Date(p.endTime || p.startTime).toISOString(),
      status: ev === "BOOKING_CANCELLED" ? "cancelled" : "booked",
      meeting_url: meet,
    },
    replaces: ev === "BOOKING_RESCHEDULED" && p.rescheduleUid && p.rescheduleUid !== p.uid ? String(p.rescheduleUid) : null,
  };
}

// ---------- FCM HTTP v1 ----------
const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64urlStr = (s) => b64url(enc.encode(s));

export function fcmClaims(sa, now) {
  return { iss: sa.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: sa.token_uri || "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 };
}

// RS256 JWT for the OAuth2 jwt-bearer grant, signed with the service account's private key (PKCS#8 PEM).
export async function fcmJwt(sa, now = Math.floor(Date.now() / 1000)) {
  const der = Uint8Array.from(atob(sa.private_key.replace(/-----[^-]+-----|\s/g, "")), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const head = b64urlStr(JSON.stringify({ alg: "RS256", typ: "JWT" })) + "." + b64urlStr(JSON.stringify(fcmClaims(sa, now)));
  return head + "." + b64url(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(head)));
}

// FCM said this token is dead -> delete it. INVALID_ARGUMENT also covers bad payloads, so it must name the token.
export function fcmGone(err) {
  const e = err?.error || {};
  if ((e.details || []).some((d) => d.errorCode === "UNREGISTERED")) return true; // not a bare 404: wrong project id also 404s
  return e.status === "INVALID_ARGUMENT" && /token/i.test(e.message || "");
}
