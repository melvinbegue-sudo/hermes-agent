// analyze-meal — photo de repas -> estimation {nom,kcal,p,g,l,aliments,confiance} via Claude (vision).
// Secrets: ANTHROPIC_API_KEY (to set). SUPABASE_URL / SUPABASE_ANON_KEY are injected by Supabase.
import { createClient } from "npm:@supabase/supabase-js@2.119.0";
import Anthropic from "npm:@anthropic-ai/sdk@1.10.0";

// Sonnet 5.5: about half the Opus price, enough for a photo -> JSON estimate. SDK 1.10.0 types accept fallbacks: "default".
const MODEL = "claude-sonnet-5-5";
const anthropic = new Anthropic({ apiKey: Deno.env.get("ANTHROPIC_API_KEY") ?? "" });
const DAILY_LIMIT = 30;
const MAX_BYTES = 1_500_000;
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const PROMPT =
  "Tu es nutritionniste du sport. Estime le contenu de ce repas à partir de la photo. " +
  "Réponds uniquement avec le JSON demandé : nom (court, en français), kcal totales, p/g/l = protéines, glucides, lipides en grammes, " +
  "aliments = liste « aliment – quantité estimée », confiance = faible | moyenne | bonne. " +
  "Si la photo ne montre pas de nourriture, renvoie nom vide et des zéros.";

// Structured output: the API guarantees this shape; numbers are still clamped below.
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["nom", "kcal", "p", "g", "l", "aliments", "confiance"],
  properties: {
    nom: { type: "string" },
    kcal: { type: "number" },
    p: { type: "number" },
    g: { type: "number" },
    l: { type: "number" },
    aliments: { type: "array", items: { type: "string" } },
    confiance: { type: "string", enum: ["faible", "moyenne", "bonne"] },
  },
};

const num = (v: unknown, max: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(Math.min(Math.max(n, 0), max)) : 0;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  // Auth: verify the caller's JWT (the gateway also checks it unless deployed with --no-verify-jwt).
  const authHeader = req.headers.get("Authorization") ?? "";
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: auth, error: authErr } = await sb.auth.getUser(authHeader.replace(/^Bearer\s+/i, ""));
  if (authErr || !auth.user) return json({ error: "auth" }, 401);

  // Input: {image: base64 JPEG, with or without data: prefix}
  let image = "";
  try {
    image = String((await req.json())?.image ?? "").replace(/^data:image\/jpeg;base64,/, "").replace(/\s/g, "");
  } catch { /* falls through to the check below */ }
  if (!/^\/9j\/[A-Za-z0-9+/]+=*$/.test(image)) return json({ error: "image_jpeg_base64_requise" }, 400); // /9j/ = JPEG magic
  if (image.length * 3 / 4 > MAX_BYTES) return json({ error: "image_trop_lourde" }, 413);

  // Rate limit (counted before the paid call, under the user's own JWT -> RLS + security definer RPC).
  const { data: ok, error: quotaErr } = await sb.rpc("ai_take", { lim: DAILY_LIMIT });
  if (quotaErr) return json({ error: "quota_indisponible" }, 503);
  if (!ok) return json({ error: "limite_quotidienne" }, 429);

  let msg;
  try {
    msg = await anthropic.beta.messages.create({
      model: MODEL,
      max_tokens: 1024, // the JSON is ~200 tokens; low effort keeps thinking short
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default", // on a safety-classifier decline (cyber/frontier_llm), the API retries on Sonnet 5 in the same call
      output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: image } },
          { type: "text", text: PROMPT },
        ],
      }],
    });
  } catch (e) {
    console.error("anthropic", e instanceof Anthropic.APIError ? `${e.status} ${e.message}` : e);
    return json({ error: "analyse_indisponible" }, 502);
  }

  if (msg.stop_reason !== "end_turn") return json({ error: "analyse_impossible", reason: msg.stop_reason }, 422);
  let out: Record<string, unknown>;
  try {
    const t = msg.content.find((b) => b.type === "text");
    out = JSON.parse(t && t.type === "text" ? t.text : "");
  } catch {
    return json({ error: "analyse_illisible" }, 502);
  }

  return json({
    nom: String(out.nom ?? "").slice(0, 80),
    kcal: num(out.kcal, 4000),
    p: num(out.p, 400),
    g: num(out.g, 600),
    l: num(out.l, 300),
    aliments: (Array.isArray(out.aliments) ? out.aliments : []).slice(0, 20).map((a) => String(a).slice(0, 120)),
    confiance: ["faible", "moyenne", "bonne"].includes(out.confiance as string) ? out.confiance : "faible",
  });
});
