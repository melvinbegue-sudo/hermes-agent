/* MB NUTRITION — window.MBNative : scanner code-barres, notifications locales + push, ouverture de liens.
   Contrat : ARCHITECTURE.md. Script simple ; dans un navigateur : scanner BarcodeDetector si dispo, notifications/push = false/null. */
(function () {
  'use strict';
  var FORMATS = ['EAN_13', 'EAN_8', 'UPC_A', 'UPC_E'];

  function cap() { try { return window.Capacitor || null; } catch (e) { return null; } }
  function isNative() {
    try { var c = cap(); return !!(c && c.isNativePlatform && c.isNativePlatform()); } catch (e) { return false; }
  }
  function P(name) {
    try { var c = cap(); return (isNative() && c.Plugins && c.Plugins[name]) || null; } catch (e) { return null; }
  }
  function platform() { try { return cap().getPlatform(); } catch (e) { return ''; } }

  // Écoute un événement de plugin et renvoie {title, body, data} au callback ; jamais d'exception.
  function onEvent(plugin, event, pick, cb) {
    try {
      var p = P(plugin);
      if (!p || typeof cb !== 'function') return;
      p.addListener(event, function (e) {
        try { var n = pick(e) || {}; cb({ title: n.title || '', body: n.body || '', data: n.data || n.extra || {} }); } catch (x) {}
      });
    } catch (e) {}
  }

  async function nativeScan(bs) {
    if (platform() === 'android') {
      var m = await bs.isGoogleBarcodeScannerModuleAvailable();
      if (!m || !m.available) { // premier lancement : Google télécharge le module, réessayer dans quelques secondes
        try { await bs.installGoogleBarcodeScannerModule(); } catch (e) { /* déjà en cours */ }
        return null;
      }
    } else {
      var p = await bs.requestPermissions();
      if (!p || (p.camera !== 'granted' && p.camera !== 'limited')) return null;
    }
    var r = await bs.scan({ formats: FORMATS });
    var b = r && r.barcodes && r.barcodes[0];
    return (b && b.rawValue) || null;
  }

  // Repli web : caméra + BarcodeDetector dans un calque plein écran.
  function webScan() {
    return new Promise(function (resolve) {
      var done = false, stream = null, overlay = null, prevFocus = document.activeElement;
      function finish(v) {
        if (done) return; done = true;
        try { stream && stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
        try { overlay && overlay.remove(); } catch (e) {}
        document.removeEventListener('keydown', onKey);
        try { prevFocus && prevFocus.focus && prevFocus.focus(); } catch (e) {}
        resolve(v || null);
      }
      function onKey(e) { if (e.key === 'Escape') finish(null); }
      try {
        var detector = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
        overlay = document.createElement('div');
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', 'Scanner un code-barres');
        overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#000;display:flex;align-items:center;justify-content:center';
        var video = document.createElement('video');
        video.setAttribute('playsinline', ''); video.muted = true;
        video.style.cssText = 'width:100%;height:100%;object-fit:cover';
        var hint = document.createElement('p');
        hint.textContent = 'Placez le code-barres dans le cadre';
        hint.style.cssText = 'position:absolute;bottom:calc(32px + env(safe-area-inset-bottom));left:16px;right:16px;margin:0;text-align:center;color:#fff;font:500 16px Inter,system-ui,sans-serif';
        var frame = document.createElement('div');
        frame.style.cssText = 'position:absolute;width:min(80vw,320px);height:min(40vw,160px);border:3px solid #fff;border-radius:12px;box-shadow:0 0 0 100vmax rgba(0,0,0,.45)';
        var close = document.createElement('button');
        close.type = 'button'; close.textContent = '✕';
        close.setAttribute('aria-label', 'Fermer le scanner');
        close.style.cssText = 'position:absolute;top:calc(16px + env(safe-area-inset-top));right:16px;width:48px;height:48px;border-radius:24px;border:0;background:rgba(255,255,255,.9);color:#111;font-size:22px;cursor:pointer';
        close.onclick = function () { finish(null); };
        overlay.append(video, frame, hint, close);
        document.body.appendChild(overlay);
        document.addEventListener('keydown', onKey);
        close.focus();
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }).then(function (s) {
          if (done) { s.getTracks().forEach(function (t) { t.stop(); }); return; }
          stream = s; video.srcObject = s;
          return video.play().then(function tick() {
            if (done) return;
            detector.detect(video).then(function (codes) {
              if (codes && codes[0] && codes[0].rawValue) finish(codes[0].rawValue);
              else setTimeout(tick, 200);
            }, function () { setTimeout(tick, 200); });
          });
        }).catch(function () { finish(null); }); // refus caméra
      } catch (e) { finish(null); }
    });
  }

  window.MBNative = {
    isNative: isNative,

    // Stripe Checkout / portail, Cal.com… : navigateur intégré en natif, nouvel onglet sur le web.
    openUrl: async function (url) {
      try {
        if (!/^https?:\/\//i.test(String(url))) return false;
        var br = P('Browser');
        if (br) { await br.open({ url: String(url) }); return true; }
        var w = window.open(url, '_blank'); // pas 'noopener' : il ferait toujours renvoyer null
        if (w) { try { w.opener = null; } catch (e) {} } else window.location.href = url; // popup bloquée
        return true;
      } catch (e) { return false; }
    },

    // Push via Firebase Cloud Messaging : jeton FCM sur iOS et Android (le serveur envoie en FCM HTTP v1).
    push: {
      register: async function () {
        try {
          var fm = P('FirebaseMessaging');
          if (!fm) return null;
          var p = await fm.requestPermissions();
          if (!p || p.receive !== 'granted') return null;
          // sans GoogleService-Info.plist / google-services.json, getToken échoue ou ne répond jamais
          var t, r = await Promise.race([fm.getToken(), new Promise(function (ok) { t = setTimeout(ok, 10000, null); })]).finally(function () { clearTimeout(t); });
          return r && r.token ? { token: r.token, platform: platform() } : null;
        } catch (e) { return null; }
      },
      onTap: function (cb) { onEvent('FirebaseMessaging', 'notificationActionPerformed', function (e) { return e && e.notification; }, cb); }
    },

    scanBarcode: async function () {
      try {
        var bs = P('BarcodeScanner');
        if (bs) return await nativeScan(bs);
        if (!('BarcodeDetector' in window) || !(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) return null;
        return await webScan();
      } catch (e) { return null; }
    },

    notify: {
      permission: async function () {
        try {
          var ln = P('LocalNotifications');
          if (!ln) return false;
          var p = await ln.checkPermissions();
          if (p && p.display === 'granted') return true;
          p = await ln.requestPermissions();
          return !!(p && p.display === 'granted');
        } catch (e) { return false; }
      },

      // cb({title, body, data}) au toucher d'un rappel local (data = n.data passé à schedule)
      onTap: function (cb) { onEvent('LocalNotifications', 'localNotificationActionPerformed', function (e) { return e && e.notification; }, cb); },

      // list = [{id:int, title, body, hour, minute, weekday?, data?}] : quotidiens, ou hebdo si weekday (1 = dimanche … 7 = samedi). Remplace tous les précédents.
      schedule: async function (list) {
        try {
          var ln = P('LocalNotifications');
          if (!ln || !(await this.permission())) return false;
          var pending = await ln.getPending();
          var old = ((pending && pending.notifications) || []).map(function (n) { return { id: n.id }; });
          if (old.length) await ln.cancel({ notifications: old });
          var items = (list || []).filter(function (n) {
            return n && Number.isInteger(n.id) && n.hour >= 0 && n.hour < 24 && n.minute >= 0 && n.minute < 60;
          }).map(function (n) {
            var it = { id: n.id, title: String(n.title || 'MB NUTRITION'), body: String(n.body || ''),
              schedule: { on: n.weekday >= 1 && n.weekday <= 7 ? { weekday: n.weekday, hour: n.hour, minute: n.minute } : { hour: n.hour, minute: n.minute }, allowWhileIdle: true } };
            if (n.data && typeof n.data === 'object') it.extra = n.data;
            return it;
          });
          if (items.length) await ln.schedule({ notifications: items });
          return true;
        } catch (e) { return false; }
      }
    }
  };
})();
