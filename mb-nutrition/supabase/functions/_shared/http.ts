// CORS, JSON responses and caller auth, same style as analyze-meal. SUPABASE_* env vars are injected by Supabase.
import { createClient, type User } from "npm:@supabase/supabase-js@2.119.0";

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// Service-role client: bypasses RLS. Only used server-side after the caller has been checked.
export const admin = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

// Verifies the caller's JWT; null when missing/invalid.
export async function caller(req: Request): Promise<User | null> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await sb.auth.getUser(authHeader.replace(/^Bearer\s+/i, ""));
  return error || !data.user ? null : data.user;
}
