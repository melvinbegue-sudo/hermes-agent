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
