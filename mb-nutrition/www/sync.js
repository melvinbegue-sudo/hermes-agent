/* window.MBSync — Supabase sync (see ARCHITECTURE.md). Every method is safe: no config, no network or any
   error -> resolves null / false, never throws. Needs config.js and vendor/supabase.js loaded first. */
(function () {
  "use strict";
  var C = window.MB_CONFIG || {};
  var sb = null;
  if (C.supabaseUrl && C.supabaseAnonKey && window.supabase && window.supabase.createClient) {
    try {
      sb = window.supabase.createClient(C.supabaseUrl, C.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      });
    } catch (e) { sb = null; }
  }
  var role = null; // cached for the signed-in user

  // Wraps an async body: disabled/offline/error -> fallback value.
  function safe(fn, fallback) {
    if (fallback === undefined) fallback = null;
    return async function () {
      if (!sb || navigator.onLine === false) return fallback;
      try { var r = await fn.apply(null, arguments); return r === undefined ? fallback : r; }
      catch (e) { return fallback; }
    };
  }
  // Supabase returns {data, error} instead of throwing: turn errors into throws for safe().
  function ok(res) { if (res.error) throw res.error; return res.data; }
  async function uid() {
    var s = ok(await sb.auth.getSession()).session;
    if (!s) throw new Error("no session");
    return s.user.id;
  }
  var iso = function (d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }; // local date, like app.js

  // Downscale to ≤1280px JPEG (keeps uploads small, and the Edge Function only accepts JPEG ≤1.5 MB).
  async function toJpeg(blob) {
    try {
      var bmp = await createImageBitmap(blob), k = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
      var c = document.createElement("canvas");
      c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
      c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
      return (await new Promise(function (r) { c.toBlob(r, "image/jpeg", 0.82); })) || blob;
    } catch (e) { return blob; }
  }
  async function base64(blob) {
    var b = new Uint8Array(await blob.arrayBuffer()), s = "";
    for (var i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    return btoa(s);
  }

  // subscriptions row -> billing.status() shape (ARCHITECTURE.md v2). past_due counts: Stripe is still retrying.
  function bill(r) {
    if (!r) return { active: false, status: "none", periodEnd: null, cancelAt: false };
    var st = r.comp ? "comp" : r.status || "none";
    return { active: ["active", "trialing", "past_due", "comp"].indexOf(st) >= 0, status: st, periodEnd: r.current_period_end || null,
      cancelAt: !r.comp && !!r.cancel_at_period_end };
  }
  var call = function (b) {
    return { id: b.id, clientId: b.client_id, email: b.email, start: b.starts_at, end: b.ends_at, url: b.meeting_url || null };
  };
  var upcoming = function () {
    return sb.from("bookings").select("*").eq("status", "booked").gte("ends_at", new Date().toISOString()).order("starts_at");
  };
  // Edge Function call -> data (non-2xx -> throws). Return URL = current page when it is a web page.
  var here = function () { var h = (window.location && window.location.href) || ""; return /^https?:/.test(h) ? h : undefined; };
  async function fn(name, body) { return ok(await sb.functions.invoke(name, { body: body || {} })); }

  var session = safe(async function () {
    var s = ok(await sb.auth.getSession()).session;
    if (!s) return null;
    if (!role) role = ok(await sb.from("profiles").select("role").eq("id", s.user.id).single()).role;
    return { userId: s.user.id, email: s.user.email, role: role };
  });

  var upsert = function (table, row, key) {
    return safe(async function () {
      ok(await sb.from(table).upsert(Object.assign({ client_id: await uid() }, row), { onConflict: key || "client_id,date" }));
      return true;
    }, false)();
  };

  var MBSync = {
    enabled: function () { return !!sb; },
    session: session,

    signIn: safe(async function (email) {
      // shouldCreateUser false: only clients invited by the coach (Supabase dashboard) can sign in.
      ok(await sb.auth.signInWithOtp({ email: String(email).trim(), options: { shouldCreateUser: false } }));
      return true;
    }, false),
    verify: safe(async function (email, code) {
      ok(await sb.auth.verifyOtp({ email: String(email).trim(), token: String(code).trim(), type: "email" }));
      role = null;
      return session();
    }),
    signOut: safe(async function () { role = null; ok(await sb.auth.signOut()); return true; }, false),

    pushDay: function (date, payload) {
      return upsert("days", { date: date, data: payload || {}, updated_at: new Date().toISOString() });
    },
    pushProfile: safe(async function (profile) {
      ok(await sb.from("profiles").update({ profile: profile, prenom: profile && profile.prenom }).eq("id", await uid()));
      return true;
    }, false),
    pushWeight: function (w) { return upsert("weights", { date: w.date, kg: w.kg }); },
    pushMeasure: function (m) {
      return upsert("measures", { date: m.date, waist: m.waist, hips: m.hips, chest: m.chest, arm: m.arm, thigh: m.thigh });
    },
    // Not in the original contract: checkins/trainings had a table but no push.
    pushCheckin: function (c) { return upsert("checkins", { date: c.date, data: c }); },
    pushTrainings: function (date, list) { return upsert("trainings", { date: date, data: list || [] }); },

    uploadPhoto: safe(async function (blob, kind) {
      kind = kind === "progress" ? "progress" : "meal";
      var id = await uid(), path = id + "/" + kind + "/" + Date.now() + ".jpg";
      ok(await sb.storage.from("photos").upload(path, await toJpeg(blob), { contentType: "image/jpeg" }));
      ok(await sb.from("photos").insert({ client_id: id, path: path, kind: kind, date: iso(new Date()) }));
      return path;
    }),
    // Private bucket: short-lived URL to display a photo (client: own, coach: their clients').
    photoUrl: safe(async function (path) {
      return ok(await sb.storage.from("photos").createSignedUrl(path, 3600)).signedUrl;
    }),

    pullPlan: safe(async function () {
      return ok(await sb.from("profiles").select("plan").eq("id", await uid()).single()).plan;
    }),

    messages: {
      // Last 200 messages of a conversation, oldest first. clientId omitted = my own conversation.
      list: safe(async function (clientId) {
        var rows = ok(await sb.from("messages").select("*").eq("client_id", clientId || await uid())
          .order("created_at", { ascending: false }).limit(200));
        return rows.reverse();
      }),
      send: safe(async function (text, clientId) {
        var body = String(text || "").trim().slice(0, 4000);
        if (!body) return null;
        return ok(await sb.from("messages").insert({ client_id: clientId || await uid(), body: body }).select().single());
      }),
      markRead: safe(async function (clientId) {
        var me = await uid();
        ok(await sb.from("messages").update({ read_at: new Date().toISOString() })
          .eq("client_id", clientId || me).neq("sender_id", me).is("read_at", null));
        return true;
      }, false),
      // Sync: returns the unsubscribe fn (a no-op when disabled). RLS filters which rows reach cb.
      subscribe: function (cb) {
        if (!sb || typeof cb !== "function") return function () {};
        try {
          var ch = sb.channel("mb-messages-" + Math.random().toString(36).slice(2))
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, function (p) {
              try { cb(p.new); } catch (e) {}
            }).subscribe();
          return function () { try { sb.removeChannel(ch); } catch (e) {} };
        } catch (e) { return function () {}; }
      },
    },

    analyzeMeal: safe(async function (blob) {
      var res = await sb.functions.invoke("analyze-meal", { body: { image: await base64(await toJpeg(blob)) } });
      return ok(res);
    }),

    billing: {
      status: safe(async function () {
        var id = await uid();
        await session(); // fills role
        if (role === "coach") return { active: true, status: "comp", periodEnd: null, cancelAt: false };
        return bill(ok(await sb.from("subscriptions").select("*").eq("client_id", id).maybeSingle()));
      }),
      checkout: safe(async function () { return (await fn("create-checkout", { successUrl: here(), cancelUrl: here() })).url; }),
      portal: safe(async function () { return (await fn("billing-portal", { returnUrl: here() })).url; }),
    },

    calls: {
      next: safe(async function () {
        var b = ok(await upcoming().eq("client_id", await uid()).limit(1))[0];
        return b ? { start: b.starts_at, end: b.ends_at, url: b.meeting_url || null } : null;
      }),
      // RLS scopes it: a client sees own calls, the coach all of his clients' (+ unmatched bookings).
      list: safe(async function (clientId) {
        var q = upcoming().limit(200);
        return ok(await (clientId ? q.eq("client_id", clientId) : q)).map(call);
      }),
    },

    push: {
      register: safe(async function (token, platform) {
        if (!token || ["ios", "android"].indexOf(platform) < 0) return false;
        return ok(await sb.rpc("register_push", { tok: String(token), plat: platform })) === true;
      }, false),
      // Sign-out: this device stops receiving the previous user's pushes (RLS: own rows only).
      unregister: safe(async function (token) {
        if (!token) return false;
        ok(await sb.from("push_tokens").delete().eq("token", String(token)));
        return true;
      }, false),
    },

    coach: {
      clients: safe(async function () {
        var r = await Promise.all([
          sb.from("profiles").select("*").eq("role", "client").order("prenom"),
          sb.from("coach_notes").select("*"),
          sb.from("subscriptions").select("*"),
          upcoming().not("client_id", "is", null),
        ]);
        var rows = ok(r[0]), notes = ok(r[1]);
        // Billing/calls tables may be missing (migration 0002 not run yet): the list must still load.
        var subs = r[2].error ? null : r[2].data, books = r[3].error ? null : r[3].data;
        return rows.map(function (row) {
          var n = notes.find(function (x) { return x.client_id === row.id; }) || {};
          var b = subs && bill(subs.find(function (x) { return x.client_id === row.id; }));
          var c = books && books.find(function (x) { return x.client_id === row.id; });
          return Object.assign({}, row, { notes: n.notes || "", data: n.data || {},
            billing: b ? { status: b.status, periodEnd: b.periodEnd, cancelAt: b.cancelAt } : null,
            nextCall: c ? { start: c.starts_at, end: c.ends_at, url: c.meeting_url || null } : null });
        });
      }),
      grantAccess: safe(async function (clientId, on) {
        return ok(await sb.rpc("set_comp", { client: clientId, on_: !!on })) === true;
      }, false),
      // -> number of devices reached, or null.
      push: safe(async function (msg) {
        msg = msg || {};
        return (await fn("send-push", { to: msg.to, title: msg.title, body: msg.body })).sent;
      }),
      client: safe(async function (id) {
        var from = iso(new Date(Date.now() - 27 * 864e5));
        var q = function (t, since) {
          var x = sb.from(t).select("*").eq("client_id", id);
          return (since ? x.gte("date", from) : x).order("date");
        };
        var r = await Promise.all([
          sb.from("profiles").select("*").eq("id", id).single(),
          sb.from("coach_notes").select("*").eq("client_id", id).maybeSingle(),
          q("days", true), q("weights"), q("measures"), q("checkins"), q("trainings", true), q("photos"),
        ]);
        var d = r.map(ok), n = d[1] || {};
        return Object.assign({}, d[0], { notes: n.notes || "", data: n.data || {},
          days: d[2], weights: d[3], measures: d[4], checkins: d[5], trainings: d[6], photos: d[7] });
      }),
      // Not in the original contract: the coach needs a write path for plan / statut / notes.
      // patch keys: prenom, profile, plan, statut, cid (on the profile) ; notes, data (coach-private).
      update: safe(async function (id, patch) {
        var p = {}, n = {};
        ["prenom", "profile", "plan", "statut", "cid"].forEach(function (k) { if (k in patch) p[k] = patch[k]; });
        ["notes", "data"].forEach(function (k) { if (k in patch) n[k] = patch[k]; });
        if (Object.keys(p).length) ok(await sb.from("profiles").update(p).eq("id", id));
        if (Object.keys(n).length) ok(await sb.from("coach_notes").upsert(Object.assign({ client_id: id, updated_at: new Date().toISOString() }, n)));
        return true;
      }, false),
    },
  };

  window.MBSync = MBSync;
})();
