// node --test tests/  — vérifie health.js / native.js sans Capacitor réel.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const www = path.join(__dirname, '..', 'www');
function load(window, ...files) {
  const ctx = vm.createContext({ window, navigator: {}, document: {}, console, Date, Math, Promise, setTimeout });
  for (const f of files) vm.runInContext(fs.readFileSync(path.join(www, f), 'utf8'), ctx);
  return window;
}
const plain = (x) => JSON.parse(JSON.stringify(x)); // objets créés dans le contexte vm
const at = (h, m) => new Date(2026, 10, 18, h, m).toISOString();

function fakeHealth() {
  const hr = [];
  for (let m = 0; m < 1440; m += 5) hr.push({ value: 60 + (m % 15), startDate: at(0, m), endDate: at(0, m) });
  const samples = {
    heartRate: hr,
    restingHeartRate: [{ value: 55, startDate: at(7, 0), endDate: at(7, 0) }, { value: 52, startDate: at(8, 0), endDate: at(8, 0) }],
    heartRateVariability: [{ value: 40, startDate: at(3, 0) }, { value: 50, startDate: at(4, 0) }],
    // iPhone + montre qui se chevauchent : 23:00-07:00 asleep, doublon 01:00-03:00, éveil ignoré
    sleep: [
      { sleepState: 'asleep', startDate: new Date(2026, 10, 17, 23, 0).toISOString(), endDate: at(7, 0) },
      { sleepState: 'deep', startDate: at(1, 0), endDate: at(3, 0) },
      { sleepState: 'awake', startDate: at(7, 0), endDate: at(7, 30) },
      { sleepState: 'inBed', startDate: new Date(2026, 10, 17, 22, 0).toISOString(), endDate: at(8, 0) }
    ],
    weight: [{ value: 72.46, startDate: at(7, 5) }]
  };
  return {
    isAvailable: async () => ({ available: true, platform: 'ios' }),
    requestAuthorization: async () => ({ readAuthorized: [], readDenied: [], writeAuthorized: [], writeDenied: [] }),
    readSamples: async (o) => ({ samples: samples[o.dataType] || [] }),
    queryAggregated: async (o) => ({
      samples: [{ startDate: o.startDate, endDate: new Date(Date.parse(o.startDate) + 864e5).toISOString(),
        value: 0, values: { sum: o.dataType === 'steps' ? 8421.4 : 512.6, average: 53 }, unit: 'count' }]
    })
  };
}

test('day() shape and 15-min HR downsampling', async () => {
  const w = load({ Capacitor: { isNativePlatform: () => true, Plugins: { Health: fakeHealth() } } }, 'health.js');
  assert.strictEqual(await w.MBHealth.available(), true);
  assert.strictEqual(await w.MBHealth.request(), true);
  const d = await w.MBHealth.day('2026-11-18');
  assert.deepStrictEqual(plain(Object.keys(d)).sort(),
    ['activeKcal', 'hr', 'hrAvg', 'hrMax', 'hrMin', 'hrResting', 'hrv', 'sleepMin', 'steps'].sort());
  assert.strictEqual(d.steps, 8421);
  assert.strictEqual(d.activeKcal, 513);
  assert.strictEqual(d.hrResting, 52);
  assert.strictEqual(d.hrv, 45);
  assert.strictEqual(d.sleepMin, 480); // union, sans double comptage ni inBed
  assert.deepStrictEqual([d.hrMin, d.hrMax, d.hrAvg], [60, 70, 65]);
  assert.strictEqual(d.hr.length, 96);
  assert.deepStrictEqual(plain(d.hr[0]), [0, 65]); // moyenne de 60, 65, 70
  assert.deepStrictEqual(plain(d.hr[95]), [1425, 65]);
  assert.ok(d.hr.every(([m], i) => m === i * 15));
  assert.deepStrictEqual(plain(await w.MBHealth.latestWeight()), { date: '2026-11-18', kg: 72.5 });
  const r = await w.MBHealth.range('2026-11-18', '2026-11-18');
  assert.deepStrictEqual(plain(r['2026-11-18']), { steps: 8421, activeKcal: 513, hrResting: 53, sleepMin: 480 });
});

test('plugin errors never throw', async () => {
  const boom = async () => { throw new Error('denied'); };
  const w = load({ Capacitor: { Plugins: { Health: { isAvailable: async () => ({ available: true }), readSamples: boom, queryAggregated: boom, requestAuthorization: boom } } } }, 'health.js');
  assert.strictEqual(await w.MBHealth.request(), false);
  assert.strictEqual(await w.MBHealth.day('2026-11-18'), null);
  assert.strictEqual(await w.MBHealth.latestWeight(), null);
});

test('plain browser: loads, no-ops, never throws', async () => {
  const w = load({}, 'health.js', 'native.js');
  assert.strictEqual(await w.MBHealth.available(), false);
  assert.strictEqual(await w.MBHealth.request(), false);
  assert.strictEqual(await w.MBHealth.day('2026-11-18'), null);
  assert.deepStrictEqual(plain(await w.MBHealth.range('2026-11-01', '2026-11-07')), {});
  assert.strictEqual(await w.MBHealth.latestWeight(), null);
  assert.strictEqual(w.MBNative.isNative(), false);
  assert.strictEqual(await w.MBNative.scanBarcode(), null); // pas de BarcodeDetector
  assert.strictEqual(await w.MBNative.notify.permission(), false);
  assert.strictEqual(await w.MBNative.notify.schedule([{ id: 1, title: 'Eau', body: '', hour: 10, minute: 0 }]), false);
});

test('native notifications replace previous schedule', async () => {
  const calls = [];
  const ln = {
    checkPermissions: async () => ({ display: 'granted' }),
    getPending: async () => ({ notifications: [{ id: 7 }] }),
    cancel: async (o) => calls.push(['cancel', o]),
    schedule: async (o) => calls.push(['schedule', o])
  };
  const w = load({ Capacitor: { isNativePlatform: () => true, getPlatform: () => 'ios', Plugins: { LocalNotifications: ln } } }, 'native.js');
  assert.strictEqual(await w.MBNative.notify.schedule([{ id: 1, title: 'Repas', body: 'Midi', hour: 12, minute: 30 }]), true);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(calls)), [
    ['cancel', { notifications: [{ id: 7 }] }],
    ['schedule', { notifications: [{ id: 1, title: 'Repas', body: 'Midi', schedule: { on: { hour: 12, minute: 30 }, allowWhileIdle: true } }] }]
  ]);
});
