/* MB NUTRITION — window.MBHealth : Apple Santé (HealthKit) / Health Connect via @capgo/capacitor-health.
   Contrat : ARCHITECTURE.md. Script simple (pas d'import) ; dans un navigateur tout renvoie false / null. */
(function () {
  'use strict';
  var READ = ['steps', 'calories', 'heartRate', 'restingHeartRate', 'heartRateVariability', 'sleep', 'weight'];
  var ASLEEP = { asleep: 1, light: 1, deep: 1, rem: 1 };
  var avail = null; // cache de isAvailable()

  function plugin() {
    try { return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Health) || null; }
    catch (e) { return null; }
  }
  function d0(iso, addDays, hour) { // minuit local (ou hour) du jour iso + addDays
    var p = String(iso).split('-').map(Number);
    var d = new Date(p[0], p[1] - 1, p[2] + (addDays || 0), hour || 0);
    return isNaN(d) ? null : d;
  }
  function key(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function round(x, n) { var f = Math.pow(10, n || 0); return Math.round(x * f) / f; }
  async function safe(fn) { try { return await fn(); } catch (e) { return null; } }

  function read(type, from, to, limit) {
    return safe(async function () {
      var r = await plugin().readSamples({ dataType: type, startDate: from.toISOString(), endDate: to.toISOString(), limit: limit || 1000, ascending: true });
      return (r && r.samples) || [];
    });
  }
  // -> {isoDate: value} ; jours via le milieu du bucket (les buckets Android sont des durées de 24 h).
  function agg(type, op, from, to) {
    return safe(async function () {
      var r = await plugin().queryAggregated({ dataType: type, startDate: from.toISOString(), endDate: to.toISOString(), bucket: 'day', aggregation: op });
      var out = {};
      ((r && r.samples) || []).forEach(function (s) {
        var v = s.values && s.values[op] != null ? s.values[op] : s.value;
        if (v == null || isNaN(v)) return;
        out[key(new Date((Date.parse(s.startDate) + Date.parse(s.endDate)) / 2))] = v;
      });
      return out;
    });
  }

  // Minutes de sommeil réelles dans [from, to) : union des intervalles (évite le double comptage iPhone + montre).
  function sleepMinutes(samples, from, to) {
    if (!samples) return null;
    var asleep = [], inBed = [];
    samples.forEach(function (s) {
      if (s.stages && s.stages.length) {
        s.stages.forEach(function (st) { if (ASLEEP[st.stage]) asleep.push([Date.parse(st.startDate), Date.parse(st.endDate)]); });
      } else if (!s.sleepState || ASLEEP[s.sleepState]) {
        asleep.push([Date.parse(s.startDate), Date.parse(s.endDate)]); // session Android sans phases = dormi
      } else if (s.sleepState === 'inBed') {
        inBed.push([Date.parse(s.startDate), Date.parse(s.endDate)]);
      }
    });
    var list = asleep.length ? asleep : inBed; // vieux iPhone sans montre : seulement "au lit"
    var a = +from, b = +to, total = 0, end = -Infinity;
    list.map(function (i) { return [Math.max(i[0], a), Math.min(i[1], b)]; })
      .filter(function (i) { return i[1] > i[0]; })
      .sort(function (x, y) { return x[0] - y[0]; })
      .forEach(function (i) {
        if (i[1] <= end) return;
        total += i[1] - Math.max(i[0], end);
        end = i[1];
      });
    return total ? Math.round(total / 60000) : null;
  }
  // Nuit rattachée au jour J = de J-1 18 h à J 18 h (inclut une sieste de l'après-midi).
  function sleepWindow(iso) { return [d0(iso, -1, 18), d0(iso, 0, 18)]; }

  function hrStats(samples, dayStart) {
    var vals = (samples || []).map(function (s) { return s.value; }).filter(function (v) { return v > 0; });
    if (!vals.length) return { hrAvg: null, hrMin: null, hrMax: null, hr: [] };
    var b = {};
    samples.forEach(function (s) {
      if (!(s.value > 0)) return;
      var m = Math.floor((Date.parse(s.startDate) - dayStart) / 60000);
      if (m < 0 || m >= 1440) return;
      var k = m - (m % 15);
      (b[k] = b[k] || []).push(s.value);
    });
    var hr = Object.keys(b).map(Number).sort(function (x, y) { return x - y; }).map(function (k) {
      return [k, Math.round(b[k].reduce(function (x, y) { return x + y; }, 0) / b[k].length)];
    });
    return {
      hrAvg: Math.round(vals.reduce(function (x, y) { return x + y; }, 0) / vals.length),
      hrMin: Math.round(Math.min.apply(null, vals)),
      hrMax: Math.round(Math.max.apply(null, vals)),
      hr: hr
    };
  }
  function avg(samples) {
    if (!samples || !samples.length) return null;
    return samples.reduce(function (x, s) { return x + s.value; }, 0) / samples.length;
  }

  window.MBHealth = {
    available: async function () {
      if (!plugin()) return false;
      if (avail === null) avail = !!(await safe(async function () { var r = await plugin().isAvailable(); return r && r.available; }));
      return avail;
    },

    request: async function () {
      if (!(await this.available())) return false;
      var r = await safe(function () { return plugin().requestAuthorization({ read: READ, write: [] }); });
      // iOS ne dit jamais si la lecture est refusée : on considère "demandé" = ok.
      return !!r && !(r.readAuthorized && r.readAuthorized.length === 0 && r.readDenied && r.readDenied.length);
    },

    day: async function (iso) {
      try {
        if (!(await this.available())) return null;
        var s = d0(iso), e = d0(iso, 1);
        if (!s) return null;
        var w = sleepWindow(iso);
        // shortcut: 20000 échantillons FC max/jour (montre ~1/5 min, plus en séance) ; paginer si un jour est tronqué.
        var r = await Promise.all([
          agg('steps', 'sum', s, e), agg('calories', 'sum', s, e),
          read('heartRate', s, e, 20000), read('restingHeartRate', s, e, 50),
          read('heartRateVariability', s, e, 500), read('sleep', w[0], w[1], 2000)
        ]);
        var k = key(s), st = hrStats(r[2], +s);
        var rest = r[3] && r[3].length ? r[3][r[3].length - 1].value : null;
        var hrv = avg(r[4]);
        var out = {
          steps: r[0] && r[0][k] != null ? Math.round(r[0][k]) : null,
          activeKcal: r[1] && r[1][k] != null ? Math.round(r[1][k]) : null,
          hrAvg: st.hrAvg, hrMin: st.hrMin, hrMax: st.hrMax,
          hrResting: rest != null ? Math.round(rest) : null,
          hrv: hrv != null ? round(hrv, 0) : null,
          sleepMin: sleepMinutes(r[5], w[0], w[1]),
          hr: st.hr
        };
        return r.every(function (x) { return x === null; }) ? null : out;
      } catch (err) { return null; }
    },

    range: async function (fromIso, toIso) {
      var out = {};
      try {
        if (!(await this.available())) return out;
        var s = d0(fromIso), e = d0(toIso, 1);
        if (!s || !e || e <= s) return out;
        var r = await Promise.all([
          agg('steps', 'sum', s, e), agg('calories', 'sum', s, e), agg('restingHeartRate', 'average', s, e),
          read('sleep', d0(fromIso, -1, 18), d0(toIso, 0, 18), 10000)
        ]);
        for (var d = new Date(s); d < e; d.setDate(d.getDate() + 1)) {
          var k = key(d), w = sleepWindow(k);
          out[k] = {
            steps: r[0] && r[0][k] != null ? Math.round(r[0][k]) : null,
            activeKcal: r[1] && r[1][k] != null ? Math.round(r[1][k]) : null,
            hrResting: r[2] && r[2][k] != null ? Math.round(r[2][k]) : null,
            sleepMin: sleepMinutes(r[3], w[0], w[1])
          };
        }
      } catch (err) { /* contrat : ne jamais lever */ }
      return out;
    },

    // @capgo/capacitor-health 8.13 (dernière version) n'expose pas le flux menstruel
    // (ni HealthKit menstrualFlow ni Health Connect MenstruationFlow) : null -> l'app passe à la saisie manuelle.
    // shortcut: toujours null, brancher readSamples('menstrualFlow') quand le plugin l'ajoutera.
    cycle: async function () { return null; },

    latestWeight: async function () {
      try {
        if (!(await this.available())) return null;
        var r = await safe(function () {
          return plugin().readSamples({ dataType: 'weight', startDate: new Date(Date.now() - 365 * 864e5).toISOString(), endDate: new Date().toISOString(), limit: 1, ascending: false });
        });
        var w = r && r.samples && r.samples[0];
        return w && w.value > 0 ? { date: key(new Date(w.startDate)), kg: round(w.value, 1) } : null;
      } catch (err) { return null; }
    }
  };
})();
