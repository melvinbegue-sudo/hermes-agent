// cal-webhook — Cal.com -> table bookings. Called by Cal.com, not the app: deploy with --no-verify-jwt.
// Secret: CAL_WEBHOOK_SECRET (same value as the "Secret" field of the Cal.com webhook).
// Events: BOOKING_CREATED, BOOKING_RESCHEDULED, BOOKING_CANCELLED. Payload shape assumed in _shared/pure.mjs calBooking().
import { admin, json } from "../_shared/http.ts";
import { calBooking, verifyCal } from "../_shared/pure.mjs";

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const raw = await req.text();
  if (!(await verifyCal(raw, req.headers.get("x-cal-signature-256"), Deno.env.get("CAL_WEBHOOK_SECRET")))) {
    return json({ error: "signature" }, 401);
  }
  let parsed;
  try { parsed = calBooking(JSON.parse(raw)); } catch { return json({ error: "payload" }, 400); }
  if (!parsed) return json({ ignored: true }); // PING, MEETING_ENDED, …

  const db = admin();
  try {
    const { row, replaces } = parsed;
    // Match the attendee to a client by e-mail (profiles.email comes from auth, so it's the login e-mail).
    let client_id = null;
    if (row.email) {
      const { data, error } = await db.from("profiles").select("id").ilike("email", row.email.replace(/[\\%_]/g, "\\$&")).limit(1);
      if (error) throw error;
      client_id = data?.[0]?.id ?? null;
    }
    const up = await db.from("bookings").upsert({ ...row, client_id, updated_at: new Date().toISOString() }, { onConflict: "cal_uid" });
    if (up.error) throw up.error;
    if (replaces) {
      const old = await db.from("bookings").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("cal_uid", replaces);
      if (old.error) throw old.error;
    }
    return json({ ok: true });
  } catch (e) {
    console.error("cal-webhook", e instanceof Error ? e.message : e);
    return json({ error: "retry" }, 500);
  }
});
