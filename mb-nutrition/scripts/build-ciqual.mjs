// Builds www/foods/ciqual.json from the official Ciqual XML release.
// Source: Anses. Table de composition nutritionnelle des aliments Ciqual 2025 (doi:10.5281/zenodo.17550133, CC-BY 4.0).
// Usage: put the XML files (alim_*.xml, compo_*.xml) from ciqual.anses.fr or the Anses Zenodo record in a folder, then
//   node scripts/build-ciqual.mjs <folder> [out=www/foods/ciqual.json]
// Output: [[id, name, kcal, p, g, l, rayon]] per 100 g, sorted by name. Rows without energy are dropped.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const C = { kcal: ["328", "333"], p: ["25000", "25003"], g: ["31000"], l: ["40000"] }; // EU kcal, then Jones kcal as fallback

// Ciqual alim_grp_code → rayon of the app.
const RAYON = { 1: "Traiteur", 2: "Fruits et légumes", 3: "Épicerie", 4: "Protéines", 5: "Crèmerie", 6: "Boissons",
  7: "Épicerie", 8: "Surgelés", 9: "Épicerie", 10: "Épicerie", 11: "Épicerie" };
// Sub-groups that sit in another rayon than their group (légumineuses, fruits à coque, pains, viennoiseries, beurres).
const SSGRP = { 203: "Épicerie", 205: "Épicerie", 302: "Boulangerie", 705: "Boulangerie", 901: "Crèmerie" };

const decode = (buf) => {
  const enc = /encoding="([^"]+)"/i.exec(buf.subarray(0, 200).toString("latin1"))?.[1] || "utf-8";
  return new TextDecoder(enc).decode(buf);
};
// Ciqual XML is flat: <TABLE><ROW><field> value </field>…</ROW>…</TABLE>
const records = (xml, tag) => [...xml.matchAll(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "g"))].map(([, body]) => {
  const o = {};
  for (const [, k, v] of body.matchAll(/<(\w+)>([\s\S]*?)<\/\1>/g)) o[k] = v.trim();
  for (const [, k] of body.matchAll(/<(\w+)\s*\/>/g)) o[k] = "";
  return o;
});
// "12,5" → 12.5 · "traces" / "< 0,5" → 0 · "-" or empty → null
const num = (s) => {
  if (s == null) return null;
  s = String(s).trim().replace(",", ".");
  if (!s || s === "-") return null;
  if (/^traces$/i.test(s) || s.startsWith("<")) return 0;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
};
const r1 = (n) => Math.round(n * 10) / 10;
const unescape = (s) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");

export function build(dir) {
  const files = readdirSync(dir);
  const pick = (re) => {
    const f = files.find((n) => re.test(n));
    if (!f) throw new Error(`missing ${re} in ${dir}`);
    return decode(readFileSync(join(dir, f)));
  };
  const alims = records(pick(/^alim_(?!grp)[^/]*\.xml$/i), "ALIM");
  const vals = {};
  for (const c of records(pick(/^compo_.*\.xml$/i), "COMPO")) {
    const id = parseInt(c.alim_code, 10), k = String(parseInt(c.const_code, 10));
    (vals[id] ||= {})[k] = num(c.teneur);
  }
  const get = (v, codes) => { for (const c of codes) if (v[c] != null) return v[c]; return null; };
  const rows = [];
  for (const a of alims) {
    const id = parseInt(a.alim_code, 10), v = vals[id] || {}, kcal = get(v, C.kcal);
    if (!Number.isFinite(id) || kcal == null) continue;
    const name = unescape(a.alim_nom_fr || "").replace(/\s+/g, " ").trim();
    if (!name) continue;
    const rayon = SSGRP[parseInt(a.alim_ssgrp_code, 10)] || RAYON[parseInt(a.alim_grp_code, 10)] || "Épicerie";
    rows.push([id, name, r1(kcal), r1(get(v, C.p) ?? 0), r1(get(v, C.g) ?? 0), r1(get(v, C.l) ?? 0), rayon]);
  }
  return rows.sort((x, y) => x[1].localeCompare(y[1], "fr"));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [dir, out = fileURLToPath(new URL("../www/foods/ciqual.json", import.meta.url))] = process.argv.slice(2);
  if (!dir) { console.error("usage: node scripts/build-ciqual.mjs <ciqual-xml-folder> [out.json]"); process.exit(1); }
  const rows = build(dir);
  const json = "[\n" + rows.map((r) => JSON.stringify(r)).join(",\n") + "\n]\n";
  writeFileSync(out, json);
  console.log(`${rows.length} foods → ${out} (${(json.length / 1024).toFixed(0)} KB)`);
}
