/* Recherche d'aliments : table de base (FOODS, data.js) puis Ciqual (foods/ciqual.json, chargée à la première recherche).
   MBFoods.search(q, limit) -> [{id, n, k, p, g, l, r, src:"base"|"ciqual"}] pour 100 g. Ne lève jamais d'erreur. */
(function () {
  const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/œ/g, "oe").replace(/æ/g, "ae");
  let ciqual = null; // Promise<rows[]>, remise à null après un échec pour réessayer une fois en ligne

  function loadCiqual() {
    if (!ciqual) ciqual = Promise.resolve()
      .then(() => fetch("foods/ciqual.json"))
      .then(r => (r.ok ? r.json() : []))
      .then(rows => (Array.isArray(rows) ? rows.filter(x => Array.isArray(x) && x.length >= 7).map(x => ({row: x, key: norm(x[1])})) : []))
      .catch(() => [])
      .then(rows => { if (!rows.length) ciqual = null; return rows; });
    return ciqual;
  }

  async function search(q, limit = 30) {
    try {
      const words = norm(q).split(/[\s,'’-]+/).filter(Boolean);
      if (!words.length) return [];
      const hit = key => words.every(w => key.includes(w));
      const first = key => (key.startsWith(words[0]) ? 0 : 1);
      const base = typeof FOODS === "object" && FOODS ? FOODS : {};
      const out = Object.entries(base).filter(([, F]) => hit(norm(F.n)))
        .sort((a, b) => first(norm(a[1].n)) - first(norm(b[1].n)))
        .map(([id, F]) => ({id, n: F.n, k: F.k, p: F.p, g: F.g, l: F.l, r: F.r, src: "base"}));
      if (out.length >= limit) return out.slice(0, limit);
      const rows = (await loadCiqual()).filter(x => hit(x.key)).sort((a, b) => first(a.key) - first(b.key));
      for (const {row: [id, n, k, p, g, l, r]} of rows) {
        if (out.length >= limit) break;
        out.push({id, n, k, p, g, l, r, src: "ciqual"});
      }
      return out;
    } catch (e) { return []; }
  }

  window.MBFoods = {search};
})();
