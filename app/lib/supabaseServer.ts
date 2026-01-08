import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url) throw new Error("supabaseServer: missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)");
if (!serviceKey) throw new Error("supabaseServer: missing SUPABASE_SERVICE_ROLE_KEY");

export const supabaseServer = createClient(url, serviceKey, {
  auth: { persistSession: false },
});