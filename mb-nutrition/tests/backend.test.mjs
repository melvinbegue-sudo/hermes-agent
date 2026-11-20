// node --test mb-nutrition/tests/backend.test.mjs — pure helpers used by the Edge Functions (supabase/functions/_shared/pure.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac, generateKeyPairSync, createVerify } from "node:crypto";
import { allowedUrl, calBooking, cancellable, clip, fcmGone, fcmJwt, normStatus, periodEnd, pickSub, sheetPlan, verifyCal, webhookRow } from "../supabase/functions/_shared/pure.mjs";

test("Stripe status -> access status", () => {
  for (const s of ["active", "trialing", "past_due"]) assert.equal(normStatus(s), s);
  for (const s of ["canceled", "unpaid", "incomplete_expired", "paused"]) assert.equal(normStatus(s), "canceled");
  assert.equal(normStatus("incomplete"), "none");
  assert.equal(normStatus(undefined), "none");
});

test("pickSub prefers a live subscription over a newer dead one; periodEnd reads items", () => {
  const live = { id: "a", status: "active", created: 1 }, dead = { id: "b", status: "canceled", created: 2 };
  assert.equal(pickSub([dead, live]).id, "a");
  assert.equal(pickSub([{ id: "c", status: "canceled", created: 1 }, dead]).id, "b");
  assert.equal(pickSub([]), null);
  assert.equal(periodEnd({ items: { data: [{ current_period_end: 1767225600 }] } }), "2026-01-01T00:00:00.000Z");
  assert.equal(periodEnd({}), null);
});

test("webhookRow: ignore unknown / deleted clients; row never carries comp", () => {
  const now = new Date("2026-11-18T10:00:00Z");
  const sub = { id: "sub_1", status: "active", created: 1, cancel_at_period_end: true, items: { data: [{ current_period_end: 1767225600 }] } };
  assert.deepEqual(webhookRow({ clientId: null, hasProfile: false, customer: "cus_1", subs: [sub], now }), { ignored: "unknown_customer" });
  assert.deepEqual(webhookRow({ clientId: "u1", hasProfile: false, customer: "cus_1", subs: [sub], now }), { ignored: "deleted_client" });
  const { row } = webhookRow({ clientId: "u1", hasProfile: true, customer: "cus_1", subs: [sub], now });
  assert.deepEqual(row, { client_id: "u1", stripe_customer_id: "cus_1", stripe_subscription_id: "sub_1", status: "active",
    current_period_end: "2026-01-01T00:00:00.000Z", cancel_at_period_end: true, updated_at: "2026-11-18T10:00:00.000Z" });
  assert.equal("comp" in row, false);
  const none = webhookRow({ clientId: "u1", hasProfile: true, customer: "cus_1", subs: [], now }).row;
  assert.equal(none.status, "none");
  assert.equal(none.cancel_at_period_end, false);
  assert.equal("comp" in none, false);
});

test("allowedUrl: only allowlisted origins, else first entry", () => {
  const allow = "https://app.mb.fr/, https://mb.fr";
  assert.equal(allowedUrl("https://mb.fr/merci?x=1", allow), "https://mb.fr/merci?x=1");
  assert.equal(allowedUrl("https://evil.fr/mb.fr", allow), "https://app.mb.fr/");
  assert.equal(allowedUrl("javascript:alert(1)", allow), "https://app.mb.fr/");
  assert.equal(allowedUrl(undefined, allow), "https://app.mb.fr/");
  assert.equal(allowedUrl("https://mb.fr", ""), null);
});

test("Cal.com signature", async () => {
  const raw = JSON.stringify({ triggerEvent: "PING" }), sig = createHmac("sha256", "s3cret").update(raw).digest("hex");
  assert.equal(await verifyCal(raw, sig, "s3cret"), true);
  assert.equal(await verifyCal(raw + " ", sig, "s3cret"), false);
  assert.equal(await verifyCal(raw, sig, "other"), false);
  assert.equal(await verifyCal(raw, null, "s3cret"), false);
  assert.equal(await verifyCal(raw, sig, ""), false);
});

test("Cal.com payload -> booking row", () => {
  const p = { uid: "new", startTime: "2026-12-01T09:00:00Z", endTime: "2026-12-01T09:30:00Z",
    attendees: [{ email: "Client@Mail.FR" }], location: "integrations:daily", metadata: { videoCallUrl: "https://meet.example/x" } };
  const c = calBooking({ triggerEvent: "BOOKING_CREATED", payload: p });
  assert.deepEqual(c.row, { cal_uid: "new", email: "client@mail.fr", starts_at: "2026-12-01T09:00:00.000Z",
    ends_at: "2026-12-01T09:30:00.000Z", status: "booked", meeting_url: "https://meet.example/x" });
  assert.equal(c.replaces, null);
  const r = calBooking({ triggerEvent: "BOOKING_RESCHEDULED", payload: { ...p, rescheduleUid: "old", metadata: {}, location: "https://zoom.us/j/1" } });
  assert.equal(r.replaces, "old");
  assert.equal(r.row.meeting_url, "https://zoom.us/j/1");
  assert.equal(calBooking({ triggerEvent: "BOOKING_CANCELLED", payload: p }).row.status, "cancelled");
  assert.equal(calBooking({ triggerEvent: "PING", payload: {} }), null);
  assert.throws(() => calBooking({ triggerEvent: "BOOKING_CREATED", payload: { uid: "x", startTime: "nope" } }));
});

test("FCM: RS256 JWT verifies with the service-account public key; dead-token detection", async () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const sa = { client_email: "push@p.iam.gserviceaccount.com", private_key: privateKey.export({ type: "pkcs8", format: "pem" }) };
  const jwt = await fcmJwt(sa, 1000);
  const [h, c, s] = jwt.split(".");
  const dec = (x) => JSON.parse(Buffer.from(x, "base64url").toString());
  assert.deepEqual(dec(h), { alg: "RS256", typ: "JWT" });
  assert.deepEqual(dec(c), { iss: sa.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token", iat: 1000, exp: 4600 });
  assert.equal(createVerify("RSA-SHA256").update(h + "." + c).verify(publicKey, Buffer.from(s, "base64url")), true);

  assert.equal(fcmGone({ error: { status: "NOT_FOUND", details: [{ errorCode: "UNREGISTERED" }] } }), true);
  assert.equal(fcmGone({ error: { status: "INVALID_ARGUMENT", message: "The registration token is not a valid FCM registration token" } }), true);
  assert.equal(fcmGone({ error: { status: "INVALID_ARGUMENT", message: "Invalid JSON payload" } }), false);
  assert.equal(fcmGone({ error: { status: "NOT_FOUND", message: "Requested entity was not found." } }), false);
  assert.equal(fcmGone(null), false);
  assert.equal(clip("  ab  ", 1), "a");
});

test("delete-account cancels every subscription Stripe could still bill", () => {
  const subs = [{ id: "a", status: "active" }, { id: "b", status: "canceled" }, { id: "c", status: "past_due" },
    { id: "d", status: "incomplete_expired" }, { id: "e", status: "trialing" }, { id: "f", status: "incomplete" }];
  assert.deepEqual(cancellable(subs), ["a", "c", "e", "f"]);
  assert.deepEqual(cancellable(null), []);
});

test("sheetPlan: live sub -> conflict; reuse the newest unpaid sub of this price; else create", () => {
  const inc = (id, created, price = "price_1", secret = "pi_" + id + "_secret") =>
    ({ id, status: "incomplete", created, items: { data: [{ price: { id: price } }] }, latest_invoice: { confirmation_secret: secret && { client_secret: secret } } });
  assert.deepEqual(sheetPlan([inc("a", 1), { id: "b", status: "past_due", created: 0 }], "price_1"), { conflict: true });
  assert.equal(sheetPlan([inc("a", 1), inc("b", 2)], "price_1").reuse.id, "b");
  assert.deepEqual(sheetPlan([inc("a", 1, "price_old")], "price_1"), { create: true }); // price changed
  assert.deepEqual(sheetPlan([inc("a", 1, "price_1", null)], "price_1"), { create: true });
  assert.deepEqual(sheetPlan([{ id: "c", status: "canceled", created: 3 }, { id: "d", status: "incomplete_expired" }], "price_1"), { create: true });
  assert.deepEqual(sheetPlan(undefined, "price_1"), { create: true });
});
