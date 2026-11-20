// Nutrition tables (www/data.js), food search (www/foods.js) and the Ciqual build script.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import vm from "node:vm";
import { build } from "../scripts/build-ciqual.mjs";

const src = (f) => readFileSync(new URL("../www/" + f, import.meta.url), "utf8");
const load = (fetch) => {
  const ctx = vm.createContext({ console, fetch });
  ctx.window = ctx;
  vm.runInContext(src("data.js"), ctx);
  vm.runInContext(src("foods.js"), ctx);
  return { ...vm.runInContext("({FOODS, SUBS, SUB_RATIO, MEALS, WEEK, TITLE_W, TITLE_TO, STEP_N})", ctx), DRIVE: ctx.DRIVE, MBFoods: ctx.MBFoods };
};
const D = load(async () => { throw new Error("offline"); });
const SLOTS = ["Petit-déjeuner", "Déjeuner", "Collation", "Dîner"];
const RAYONS = ["Fruits et légumes", "Protéines", "Crèmerie", "Boulangerie", "Épicerie", "Surgelés"]; // shopping() only lists these
const kcal = (M) => M.ing.reduce((t, [f, g]) => t + (D.FOODS[f].k * g) / 100, 0);

test("every food is complete and sold in a rayon the shopping list shows", () => {
  for (const [k, F] of Object.entries(D.FOODS)) {
    for (const m of ["k", "p", "g", "l"]) assert.ok(Number.isFinite(F[m]) && F[m] >= 0, `${k}.${m}`);
    assert.ok(F.p + F.g + F.l <= 100.5, `${k}: macros exceed 100 g`);
    assert.ok(RAYONS.includes(F.r), `${k}: rayon ${F.r}`);
    if (F.piece || F.buy) assert.ok(F.unit, `${k}: unit missing`);
  }
});

test("recipes: ≥ 55, valid slot, known ingredients, sane kcal per slot", () => {
  const ids = Object.keys(D.MEALS);
  assert.ok(ids.length >= 55, `${ids.length} recipes`);
  const range = { "Petit-déjeuner": [300, 700], "Déjeuner": [400, 800], "Collation": [100, 400], "Dîner": [350, 750] };
  for (const id of ids) {
    const M = D.MEALS[id];
    assert.ok(M.t && SLOTS.includes(M.slot) && M.min > 0 && M.steps.length, id);
    for (const [f, g] of M.ing) assert.ok(D.FOODS[f] && g > 0, `${id}: ${f}`);
    const [lo, hi] = range[M.slot], k = kcal(M);
    assert.ok(k >= lo && k <= hi, `${id}: ${Math.round(k)} kcal for ${M.slot}`);
  }
});

test("substitutions: sources and targets exist, every {placeholder} resolves after any substitution", () => {
  const targets = (f) => [f, ...Object.values(D.SUBS).map((m) => m[f]).filter(Boolean)];
  for (const [list, m] of Object.entries(D.SUBS))
    for (const [a, b] of Object.entries(m)) assert.ok(D.FOODS[a] && D.FOODS[b], `SUBS.${list}: ${a} → ${b}`);
  for (const k of Object.keys(D.TITLE_W)) assert.ok(D.FOODS[k], `TITLE_W.${k}`);
  for (const k of [...Object.keys(D.TITLE_TO), ...Object.keys(D.STEP_N)]) assert.ok(D.FOODS[k], `name for unknown food ${k}`);
  for (const [id, M] of Object.entries(D.MEALS)) {
    const ing = M.ing.map(([f]) => f);
    for (const st of M.steps)
      for (const [, k] of st.matchAll(/\{(\w+)\}/g)) {
        assert.ok(ing.includes(k), `${id}: {${k}} is not an ingredient`);
        for (const f of targets(k)) assert.ok(D.STEP_N[f] || D.FOODS[f], `${id}: {${k}} → ${f}`);
      }
  }
});

test("WEEK: 7 days × 4 slots in order, known recipes", () => {
  assert.equal(D.WEEK.length, 7);
  for (const day of D.WEEK) {
    assert.equal(day.length, 4);
    day.forEach((id, i) => assert.equal(D.MEALS[id]?.slot, SLOTS[i], `${id} at slot ${i}`));
  }
});

test("DRIVE builds encoded search links", () => {
  for (const s of Object.values(D.DRIVE)) {
    assert.ok(s.name);
    const u = new URL(s.search("pois chiches & riz"));
    assert.equal(u.protocol, "https:");
    assert.ok(u.href.includes("pois%20chiches%20%26%20riz"), u.href);
  }
});

test("MBFoods.search: base foods, accent-insensitive, offline-safe", async () => {
  const r = await D.MBFoods.search("poulet");
  assert.ok(r.some((x) => x.id === "poulet" && x.src === "base" && x.k === D.FOODS.poulet.k));
  assert.ok((await D.MBFoods.search("BOEUF hache")).some((x) => x.id === "boeuf"));
  assert.equal((await D.MBFoods.search("  ")).length, 0);
  const empty = load(async () => ({ ok: true, json: async () => [] }));
  assert.ok((await empty.MBFoods.search("poulet")).some((x) => x.id === "poulet"));
  const notFound = load(async () => ({ ok: false, json: async () => { throw new Error("404"); } }));
  assert.ok((await notFound.MBFoods.search("poulet")).length >= 1);
});

test("MBFoods.search: Ciqual rows after base, fetched once, limit respected", async () => {
  let calls = 0;
  const rows = [[36018, "Poulet, filet, sans peau, cru", 121, 23, 0, 2.6, "Protéines"], [99, "Gâteau", 400, 5, 50, 20, "Épicerie"]];
  const M = load(async (url) => { calls++; assert.equal(url, "foods/ciqual.json"); return { ok: true, json: async () => rows }; }).MBFoods;
  const r = await M.search("poulet");
  assert.equal(r[0].src, "base");
  assert.deepEqual({ ...r.at(-1) }, { id: 36018, n: rows[0][1], k: 121, p: 23, g: 0, l: 2.6, r: "Protéines", src: "ciqual" });
  assert.equal((await M.search("gateau"))[0].id, 99);
  assert.equal((await M.search("p", 2)).length, 2);
  assert.equal(calls, 1);
  assert.match(M.credit, /Anses.*Ciqual 2025/);
});

test("build-ciqual parses the official XML layout", () => {
  const dir = mkdtempSync(join(tmpdir(), "ciqual-"));
  const enc = (s) => Buffer.from(s, "latin1");
  writeFileSync(join(dir, "alim_2020_07_07.xml"), enc(`<?xml version="1.0" encoding="windows-1252"?><TABLE>
<ALIM><alim_code> 1 </alim_code><alim_nom_fr> Pain baguette </alim_nom_fr><alim_nom_sci missing=" " /><alim_grp_code> 03 </alim_grp_code><alim_ssgrp_code> 0302 </alim_ssgrp_code></ALIM>
<ALIM><alim_code> 2 </alim_code><alim_nom_fr> Crème fraîche </alim_nom_fr><alim_grp_code> 05 </alim_grp_code><alim_ssgrp_code> 0504 </alim_ssgrp_code></ALIM>
<ALIM><alim_code> 3 </alim_code><alim_nom_fr> Sans énergie </alim_nom_fr><alim_grp_code> 02 </alim_grp_code></ALIM></TABLE>`));
  writeFileSync(join(dir, "alim_grp_2020_07_07.xml"), enc(`<TABLE></TABLE>`));
  const c = (a, k, v) => `<COMPO><alim_code> ${a} </alim_code><const_code> ${k} </const_code><teneur> ${v} </teneur></COMPO>`;
  writeFileSync(join(dir, "compo_2020_07_07.xml"), enc(`<?xml version="1.0" encoding="windows-1252"?><TABLE>
${c(1, 328, "272")}${c(1, 25000, "8,64")}${c(1, 31000, "54,8")}${c(1, 40000, "< 1")}
${c(2, 328, "-")}${c(2, 333, "292,04")}${c(2, 25000, "traces")}${c(3, 328, "-")}</TABLE>`));
  assert.deepEqual(build(dir), [
    [2, "Crème fraîche", 292, 0, 0, 0, "Crèmerie"],
    [1, "Pain baguette", 272, 8.6, 54.8, 0, "Boulangerie"],
  ]);
});

test("shipped ciqual.json: valid rows, small enough", () => {
  const raw = readFileSync(new URL("../www/foods/ciqual.json", import.meta.url), "utf8");
  assert.ok(raw.length < 400 * 1024, `${raw.length} bytes`);
  const rows = JSON.parse(raw);
  assert.ok(rows.length > 1000);
  for (const [id, n, k, p, g, l, r] of rows) {
    assert.ok(Number.isInteger(id) && n && typeof r === "string", String(id));
    for (const v of [k, p, g, l]) assert.ok(Number.isFinite(v) && v >= 0, `${id}: ${v}`);
  }
});

test("MBFoods.search on the real Ciqual table finds raw chicken fillet", async () => {
  const raw = JSON.parse(readFileSync(new URL("../www/foods/ciqual.json", import.meta.url), "utf8"));
  const M = load(async () => ({ ok: true, json: async () => raw })).MBFoods;
  const r = await M.search("poulet filet cru", 50);
  assert.ok(r.some((x) => x.src === "ciqual" && x.k > 90 && x.k < 140 && x.p > 20), JSON.stringify(r.slice(0, 3)));
});
