import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url) {
  throw new Error("Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) for supabaseServer");
}
if (!serviceRole) {
  throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY for supabaseServer");
}

export const supabaseServer = createClient(url, serviceRole, {
  auth: { persistSession: false },
});