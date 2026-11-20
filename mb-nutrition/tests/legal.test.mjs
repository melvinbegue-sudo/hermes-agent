// node --test mb-nutrition/tests/legal.test.mjs — MB_LEGAL loads standalone and carries the contract keys.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

test("MB_LEGAL: contract keys, static HTML, controller identity", () => {
  const window = {};
  vm.runInNewContext(readFileSync(new URL("../www/legal.js", import.meta.url), "utf8"), { window });
  const L = window.MB_LEGAL;
  assert.match(L.version, /^\d{4}-\d{2}(-\d{2})?$/);
  for (const k of ["short", "consentText", "privacyHtml"]) assert.ok(typeof L[k] === "string" && L[k].length > 20, k);
  assert.doesNotMatch(L.privacyHtml, /<script|on\w+=/i);
  assert.doesNotMatch(L.privacyHtml, /gmail|À COMPLÉTER/);
  for (const s of ["981 481 864 00016", "melvin.begue@mb-nutritions.com", "19 rue du Moulin de la Chapelle, 45340 Beaune-la-Rolande", "9.2.a", "L123-22", "CNIL"]) assert.ok(L.privacyHtml.includes(s), s);
});
