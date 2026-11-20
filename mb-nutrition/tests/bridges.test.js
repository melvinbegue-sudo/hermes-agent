// node --test tests/  — vérifie health.js / native.js sans Capacitor réel.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const www = path.join(__dirname, '..', 'www');
function load(window, ...files) { return loadWith({}, window, ...files); }
function loadWith(globals, window, ...files) {
  const ctx = vm.createContext({ window, navigator: {}, document: {}, console, Date, Math, Promise, setTimeout, clearTimeout, ...globals });
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
  assert.strictEqual(await w.MBNative.push.register(), null);
  w.MBNative.push.onTap(() => {}); w.MBNative.notify.onTap(() => {});
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

test('notification data passes through as extra', async () => {
  const calls = [];
  const ln = { checkPermissions: async () => ({ display: 'granted' }), getPending: async () => ({}), cancel: async () => {},
    schedule: async (o) => calls.push(o) };
  const w = load({ Capacitor: { isNativePlatform: () => true, Plugins: { LocalNotifications: ln } } }, 'native.js');
  await w.MBNative.notify.schedule([{ id: 2, title: 'Séance', body: '', hour: 18, minute: 0, weekday: 2, data: { kind: 'seance' } }]);
  assert.deepStrictEqual(plain(calls[0].notifications[0].extra), { kind: 'seance' });
  assert.deepStrictEqual(plain(calls[0].notifications[0].schedule.on), { weekday: 2, hour: 18, minute: 0 });
});

const nativeWin = (Plugins, plat = 'ios') => ({ Capacitor: { isNativePlatform: () => true, getPlatform: () => plat, Plugins } });
function listeners() {
  const l = {};
  return { l, addListener: async (ev, fn) => { l[ev] = fn; return { remove: async () => {} }; } };
}

test('openUrl: native Browser, web tab, blocked popup, rejected URL', async () => {
  const opened = [];
  let w = load(nativeWin({ Browser: { open: async (o) => opened.push(o) } }), 'native.js');
  assert.strictEqual(await w.MBNative.openUrl('https://checkout.stripe.com/x'), true);
  assert.deepStrictEqual(plain(opened), [{ url: 'https://checkout.stripe.com/x' }]);
  assert.strictEqual(await w.MBNative.openUrl('javascript:alert(1)'), false);

  const tab = {};
  w = load({ open: (u, t) => { opened.push([u, t]); return tab; }, location: {} }, 'native.js');
  assert.strictEqual(await w.MBNative.openUrl('https://cal.com/x'), true);
  assert.deepStrictEqual(opened[1], ['https://cal.com/x', '_blank']);
  assert.strictEqual(tab.opener, null);

  w = load({ open: () => null, location: {} }, 'native.js');
  assert.strictEqual(await w.MBNative.openUrl('https://cal.com/y'), true);
  assert.strictEqual(w.location.href, 'https://cal.com/y');
  w = load({ open: () => { throw new Error('nope'); } }, 'native.js');
  assert.strictEqual(await w.MBNative.openUrl('https://cal.com/z'), false);
});

test('push.register: FCM token, denied, error, timeout', async () => {
  const ok = { requestPermissions: async () => ({ receive: 'granted' }), getToken: async () => ({ token: 'fcm-123' }) };
  let w = load(nativeWin({ FirebaseMessaging: ok }, 'android'), 'native.js');
  assert.deepStrictEqual(plain(await w.MBNative.push.register()), { token: 'fcm-123', platform: 'android' });

  w = load(nativeWin({ FirebaseMessaging: { ...ok, requestPermissions: async () => ({ receive: 'denied' }) } }), 'native.js');
  assert.strictEqual(await w.MBNative.push.register(), null);

  w = load(nativeWin({ FirebaseMessaging: { ...ok, getToken: async () => { throw new Error('no google-services'); } } }), 'native.js');
  assert.strictEqual(await w.MBNative.push.register(), null);

  // getToken ne répond jamais : le délai (10 s) est simulé immédiatement
  const fastTimer = (fn, ms, ...a) => setTimeout(fn, ms >= 10000 ? 0 : ms, ...a);
  w = loadWith({ setTimeout: fastTimer }, nativeWin({ FirebaseMessaging: { ...ok, getToken: () => new Promise(() => {}) } }), 'native.js');
  assert.strictEqual(await w.MBNative.push.register(), null);
});

test('onTap: push and local reminder give {title, body, data}', async () => {
  const fm = listeners(), ln = listeners(), got = [];
  const w = load(nativeWin({ FirebaseMessaging: fm, LocalNotifications: ln }), 'native.js');
  w.MBNative.push.onTap((n) => got.push(n));
  w.MBNative.notify.onTap((n) => got.push(n));
  fm.l.notificationActionPerformed({ actionId: 'tap', notification: { title: 'Coach', body: 'Bravo', data: { kind: 'msg' } } });
  ln.l.localNotificationActionPerformed({ actionId: 'tap', notification: { id: 2, title: 'Séance', body: '18h', extra: { kind: 'seance' } } });
  fm.l.notificationActionPerformed(null); // charge vide : pas d'exception
  assert.deepStrictEqual(plain(got), [
    { title: 'Coach', body: 'Bravo', data: { kind: 'msg' } },
    { title: 'Séance', body: '18h', data: { kind: 'seance' } },
    { title: '', body: '', data: {} }
  ]);
});

test('onBrowserClosed: Browser browserFinished calls back; web is a no-op', () => {
  const br = listeners();
  let n = 0;
  load(nativeWin({ Browser: br }), 'native.js').MBNative.onBrowserClosed(() => n++);
  br.l.browserFinished();
  assert.strictEqual(n, 1);
  const web = load({}, 'native.js');
  assert.doesNotThrow(() => web.MBNative.onBrowserClosed(() => n++));
  assert.strictEqual(n, 1);
});

test('cycle(): plugin has no menstrual type -> null (manual entry), native or web', async () => {
  const w = load({ Capacitor: { isNativePlatform: () => true, Plugins: { Health: fakeHealth() } } }, 'health.js');
  assert.strictEqual(await w.MBHealth.cycle('2026-10-01', '2026-11-18'), null);
  assert.strictEqual(await load({}, 'health.js').MBHealth.cycle('2026-10-01', '2026-11-18'), null);
});

test('saveFile: native writes base64 to Cache then opens the share sheet; web false', async () => {
  const calls = [];
  const plugins = (share) => ({
    Filesystem: { writeFile: async (o) => { calls.push(['write', o]); return { uri: 'file:///cache/' + o.path }; } },
    Share: { share: share || (async (o) => { calls.push(['share', o]); return {}; }) }
  });
  const g = { btoa, Uint8Array, String };
  let w = loadWith(g, nativeWin(plugins()), 'native.js');
  const blob = new Blob(['%PDF-1'], { type: 'application/pdf' });
  assert.strictEqual(await w.MBNative.saveFile(blob, 'bilan/nov.pdf', 'application/pdf'), true);
  assert.deepStrictEqual(plain(calls), [
    ['write', { path: 'bilan-nov.pdf', data: Buffer.from('%PDF-1').toString('base64'), directory: 'CACHE' }],
    ['share', { title: 'bilan-nov.pdf', files: ['file:///cache/bilan-nov.pdf'], dialogTitle: 'bilan-nov.pdf' }]
  ]);
  // feuille fermée sans choisir : pas un échec ; vraie erreur : false
  w = loadWith(g, nativeWin(plugins(async () => { throw new Error('Share canceled'); })), 'native.js');
  assert.strictEqual(await w.MBNative.saveFile(blob, 'a.pdf', 'application/pdf'), true);
  w = loadWith(g, nativeWin(plugins(async () => { throw new Error('boom'); })), 'native.js');
  assert.strictEqual(await w.MBNative.saveFile(blob, 'a.pdf', 'application/pdf'), false);
  assert.strictEqual(await load({}, 'native.js').MBNative.saveFile(blob, 'a.pdf', 'application/pdf'), false);
});

test('widget.update: iOS sends clean numbers to MBWidget; Android and web false', async () => {
  const sent = [];
  const wg = { update: async (o) => sent.push(o) };
  const data = { kcal: 1520.4, kcalGoal: 2100, prot: 98, protGoal: 140, steps: 'x', stepsGoal: 8000, date: '2026-11-18' };
  assert.strictEqual(await load(nativeWin({ MBWidget: wg }), 'native.js').MBNative.widget.update(data), true);
  assert.deepStrictEqual(plain(sent), [{ kcal: 1520, kcalGoal: 2100, prot: 98, protGoal: 140, steps: 0, stepsGoal: 8000, date: '2026-11-18' }]);
  assert.strictEqual(await load(nativeWin({ MBWidget: wg }, 'android'), 'native.js').MBNative.widget.update(data), false);
  assert.strictEqual(await load({}, 'native.js').MBNative.widget.update(data), false);
  const bad = { update: async () => { throw new Error('no app group'); } };
  assert.strictEqual(await load(nativeWin({ MBWidget: bad }), 'native.js').MBNative.widget.update(data), false);
});

test('pay/canPay: PaymentSheet result -> paid/canceled/failed; init once; setup error or web -> null', async () => {
  const P = { clientSecret: 'pi_1_secret', customerId: 'cus_1', ephemeralKey: 'ek_1', publishableKey: 'pk_test_1' };
  const fakeStripe = (result, opts = {}) => {
    const log = { init: [], sheet: [] };
    return { log, initialize: async (o) => log.init.push(o),
      createPaymentSheet: async (o) => { if (opts.badSetup) throw new Error('no'); log.sheet.push(o); },
      presentPaymentSheet: async () => { if (opts.boom) throw new Error('x'); return { paymentResult: result }; } };
  };
  let s = fakeStripe('paymentSheetCompleted');
  let w = load(nativeWin({ Stripe: s }, 'ios'), 'native.js');
  assert.strictEqual(await w.MBNative.pay(P), 'paid');
  assert.strictEqual(await w.MBNative.pay(P), 'paid');
  assert.deepStrictEqual(plain(s.log.init), [{ publishableKey: 'pk_test_1' }]); // once
  const o = plain(s.log.sheet[0]);
  assert.deepStrictEqual([o.paymentIntentClientSecret, o.customerId, o.customerEphemeralKeySecret, o.countryCode, o.enableApplePay, o.applePayMerchantId, o.enableGooglePay],
    ['pi_1_secret', 'cus_1', 'ek_1', 'FR', true, 'merchant.fr.mbnutrition.app', false]);

  s = fakeStripe('paymentSheetCanceled');
  w = load(nativeWin({ Stripe: s }, 'android'), 'native.js');
  assert.strictEqual(await w.MBNative.pay(P), 'canceled');
  assert.deepStrictEqual([s.log.sheet[0].enableGooglePay, s.log.sheet[0].GooglePayIsTesting, s.log.sheet[0].enableApplePay], [true, true, false]);

  w = load(nativeWin({ Stripe: fakeStripe('paymentSheetFailed') }), 'native.js');
  assert.strictEqual(await w.MBNative.pay(P), 'failed');
  w = load(nativeWin({ Stripe: fakeStripe(null, { boom: true }) }), 'native.js');
  assert.strictEqual(await w.MBNative.pay(P), 'failed');
  w = load(nativeWin({ Stripe: fakeStripe(null, { badSetup: true }) }), 'native.js');
  assert.strictEqual(await w.MBNative.pay(P), null);
  assert.strictEqual(await load(nativeWin({ Stripe: fakeStripe('paymentSheetCompleted') }), 'native.js').MBNative.pay(null), null);
  assert.strictEqual(await load({}, 'native.js').MBNative.pay(P), null); // web
  assert.strictEqual(load(nativeWin({ Stripe: fakeStripe('x') }), 'native.js').MBNative.canPay(), true);
  assert.strictEqual(load(nativeWin({}), 'native.js').MBNative.canPay(), false);
  assert.strictEqual(load({}, 'native.js').MBNative.canPay(), false);
});
