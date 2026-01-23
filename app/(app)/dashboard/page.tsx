import { redirect } from "next/navigation";

import { sanitizeNext } from "@/app/lib/authRedirect";
import { createSupabaseServerReadClient } from "@/app/lib/supabase/server";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerReadClient();
  const { data } = await supabase.auth.getUser();
  const user = data?.user ?? null;

  if (!user) {
    const nextPath = sanitizeNext("/dashboard");
    redirect(`/start?next=${encodeURIComponent(nextPath)}`);
  }

  const initialEmail = user?.email ? user.email.trim().toLowerCase() : "";

  return <DashboardClient initialEmail={initialEmail} />;
}
