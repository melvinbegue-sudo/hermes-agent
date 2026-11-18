// node --test mb-nutrition/tests/sync.test.mjs — MBSync must no-op safely (local-only mode, and broken backend).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const SRC = readFileSync(new URL("../www/sync.js", import.meta.url), "utf8");
const load = (extra = {}) => {
  const window = { MB_CONFIG: { supabaseUrl: "", supabaseAnonKey: "" }, ...extra };
  vm.runInNewContext(SRC, { window, navigator: { onLine: true }, console });
  return window.MBSync;
};
const calls = (S) => [
  S.session(), S.signIn("a@b.fr"), S.verify("a@b.fr", "123456"), S.signOut(),
  S.pushDay("2026-11-18", { water: 1 }), S.pushProfile({ prenom: "A" }), S.pushWeight({ date: "2026-11-18", kg: 70 }),
  S.pushMeasure({ date: "2026-11-18", waist: 80 }), S.pushCheckin({ date: "2026-11-18" }), S.pushTrainings("2026-11-18", []),
  S.uploadPhoto({}, "meal"), S.photoUrl("x"), S.pullPlan(), S.messages.list(), S.messages.send("hi"), S.messages.markRead(),
  S.analyzeMeal({}), S.coach.clients(), S.coach.client("id"), S.coach.update("id", { plan: {} }),
  S.billing.status(), S.billing.checkout(), S.billing.portal(), S.calls.next(), S.calls.list(), S.calls.list("id"),
  S.push.register("tok", "ios"), S.push.unregister("tok"), S.coach.grantAccess("id", true), S.coach.push({ to: "all", title: "t", body: "b" }),
  S.consent.get(), S.consent.get("id"), S.consent.set({ health: true, version: "2026-11" }), S.account.export(), S.account.delete(),
];

test("empty MB_CONFIG: disabled, every method resolves null/false", async () => {
  const S = load();
  assert.equal(S.enabled(), false);
  for (const v of await Promise.all(calls(S))) assert.ok(v === null || v === false, `got ${v}`);
  const off = S.messages.subscribe(() => {});
  assert.equal(typeof off, "function");
  off();
});

test("configured but backend throws or errors: still never throws", async () => {
  const boom = () => { throw new Error("offline"); };
  const errRes = async () => ({ data: null, error: new Error("down") });
  const client = {
    auth: { getSession: errRes, signInWithOtp: errRes, verifyOtp: boom, signOut: boom },
    from: boom, storage: { from: boom }, functions: { invoke: errRes }, channel: boom, removeChannel: boom,
  };
  const S = load({ MB_CONFIG: { supabaseUrl: "https://x.supabase.co", supabaseAnonKey: "k" }, supabase: { createClient: () => client } });
  assert.equal(S.enabled(), true);
  for (const v of await Promise.all(calls(S))) assert.ok(v === null || v === false, `got ${v}`);
  assert.equal(typeof S.messages.subscribe(() => {}), "function");
});

// Minimal fake supabase-js: every query chain resolves to tables[name] (or an error when the table is "missing").
const fake = (tables, me = "u1", extra = {}) => {
  const q = (t) => {
    const res = t in tables ? { data: tables[t], error: null } : { data: null, error: new Error("relation does not exist") };
    const p = new Proxy({}, { get: (_, k) => k === "then" ? (f, r) => Promise.resolve(res).then(f, r)
      : k === "single" || k === "maybeSingle" ? () => Promise.resolve({ ...res, data: Array.isArray(res.data) ? res.data[0] ?? null : res.data })
      : () => p });
    return p;
  };
  return { auth: { getSession: async () => ({ data: { session: { user: { id: me, email: "a@b.fr" } } }, error: null }) },
    from: q, ...extra };
};
const plain = (x) => JSON.parse(JSON.stringify(x)); // objects from the vm realm have another Object.prototype
const live = (client) => load({ MB_CONFIG: { supabaseUrl: "https://x.supabase.co", supabaseAnonKey: "k" }, supabase: { createClient: () => client } });

test("billing.status maps the subscriptions row", async () => {
  const st = async (sub) => plain(await live(fake({ profiles: [{ role: "client" }], subscriptions: sub })).billing.status());
  assert.deepEqual(await st([]), { active: false, status: "none", periodEnd: null, cancelAt: false });
  assert.deepEqual(await st([{ status: "past_due", comp: false, current_period_end: "2026-12-01T00:00:00Z" }]),
    { active: true, status: "past_due", periodEnd: "2026-12-01T00:00:00Z", cancelAt: false });
  assert.equal((await st([{ status: "active", comp: false, cancel_at_period_end: true }])).cancelAt, true);
  assert.equal((await st([{ status: "canceled", comp: true }])).status, "comp");
  assert.equal((await st([{ status: "canceled", comp: false }])).active, false);
  assert.equal((await live(fake({ profiles: [{ role: "coach" }] })).billing.status()).active, true);
});

test("coach.clients adds billing + nextCall, and still loads without the v2 tables", async () => {
  const base = { profiles: [{ id: "c1", prenom: "A" }, { id: "c2", prenom: "B" }], coach_notes: [] };
  const rows = await live(fake({ ...base, subscriptions: [{ client_id: "c1", status: "active", comp: false, current_period_end: "x", cancel_at_period_end: true }],
    bookings: [{ client_id: "c2", starts_at: "s", ends_at: "e", meeting_url: null }] })).coach.clients();
  assert.deepEqual(plain(rows.map((r) => [r.billing, r.nextCall])), [
    [{ status: "active", periodEnd: "x", cancelAt: true }, null],
    [{ status: "none", periodEnd: null, cancelAt: false }, { start: "s", end: "e", url: null }],
  ]);
  const old = await live(fake(base)).coach.clients();
  assert.deepEqual(plain(old.map((r) => [r.id, r.billing, r.nextCall])), [["c1", null, null], ["c2", null, null]]);
});

test("push.register validates platform; coach.push returns the sent count", async () => {
  const S = live(fake({ push_tokens: [] }, "u1", { rpc: async () => ({ data: true, error: null }),
    functions: { invoke: async (name, o) => ({ data: name === "send-push" && o.body.to === "all" ? { sent: 3 } : null, error: null }) } }));
  assert.equal(await S.push.register("tok", "web"), false);
  assert.equal(await S.push.register("tok", "android"), true);
  assert.equal(await S.push.unregister(""), false);
  assert.equal(await S.push.unregister("tok"), true);
  assert.equal(await S.coach.grantAccess("c1", true), true);
  assert.equal(await S.coach.push({ to: "all", title: "t", body: "b" }), 3);
});

test("consent get/set and account export/delete", async () => {
  const t = { profiles: [{ id: "u1", role: "client" }], days: [{ date: "2026-11-18" }], weights: [], measures: [], checkins: [],
    trainings: [], photos: [{ id: 1, path: "u1/meal/1.jpg" }], messages: [], bookings: [], subscriptions: [],
    consents: [{ granted: true, version: "2026-11", at: "2026-11-18T10:00:00Z" }], push_tokens: [], ai_usage: [] };
  const c = fake(t, "u1", {
    storage: { from: () => ({ createSignedUrls: async (paths) => ({ data: paths.map((p) => ({ path: p, signedUrl: "https://s/" + p })), error: null }) }) },
    functions: { invoke: async (name) => ({ data: name === "delete-account" ? { ok: true } : null, error: null }) },
  });
  c.auth.signOut = async () => ({ error: null });
  const S = live(c);
  assert.deepEqual(plain(await S.consent.get()), { health: true, version: "2026-11", at: "2026-11-18T10:00:00Z" });
  assert.equal(await S.consent.set({ health: false, version: "2026-11" }), true);
  assert.equal(await S.consent.set({ health: true }), false); // version required
  const x = plain(await S.account.export());
  assert.equal(x.userId, "u1");
  assert.equal(x.email, "a@b.fr");
  assert.deepEqual(x.profile, { id: "u1", role: "client" });
  assert.equal(x.subscription, null);
  assert.deepEqual(x.photos, [{ id: 1, path: "u1/meal/1.jpg", url: "https://s/u1/meal/1.jpg" }]);
  for (const k of ["days", "weights", "measures", "checkins", "trainings", "messages", "bookings", "consents", "pushTokens", "aiUsage"])
    assert.ok(Array.isArray(x[k]), k);
  assert.equal(await S.account.delete(), true);
  const none = live(fake({ consents: [] }, "u1", { functions: { invoke: async () => ({ data: null, error: new Error("403") }) } }));
  assert.equal(await none.consent.get(), null);
  assert.equal(await none.account.delete(), false);
  assert.equal(await none.account.export(), null); // a missing table must not yield a silently partial export
});
