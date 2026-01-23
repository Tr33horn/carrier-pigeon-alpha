import { redirect } from "next/navigation";

import { sanitizeNext } from "@/app/lib/authRedirect";
import { createSupabaseServerReadClient } from "@/app/lib/supabase/server";
import NewPageClient from "./NewPageClient";

function titleCase(input: string) {
  return input
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function deriveNameFromEmail(email: string) {
  const local = email.split("@")[0] || "";
  const cleaned = local.replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim();
  return cleaned ? titleCase(cleaned) : "You";
}

export default async function NewPage() {
  const supabase = await createSupabaseServerReadClient();
  const { data } = await supabase.auth.getUser();
  const user = data?.user ?? null;

  if (!user) {
    const nextPath = sanitizeNext("/new");
    redirect(`/start?next=${encodeURIComponent(nextPath)}`);
  }

  const email = user?.email ? user.email.trim().toLowerCase() : "";
  const meta = (user?.user_metadata as Record<string, string> | null) ?? null;
  const metaName = meta?.full_name || meta?.name || "";
  const fromName = metaName?.trim() || (email ? deriveNameFromEmail(email) : "You");

  return <NewPageClient initialFromEmail={email} initialFromName={fromName} />;
}
