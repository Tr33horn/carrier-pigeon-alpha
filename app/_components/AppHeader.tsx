import Link from "next/link";

import { createSupabaseServerReadClient } from "@/app/lib/supabase/server";
import AuthIndicator from "@/app/_components/AuthIndicator";

export default async function AppHeader() {
  const supabase = await createSupabaseServerReadClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user ?? null;

  const emailOrPhone = user?.email ?? user?.phone ?? null;
  const userId = user?.id ?? null;

  return (
    <header className="topBar appHeader">
      <div className="wrap topBarInner">
        <Link href="/" className="appBrand" aria-label="FLOK home" title="Home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/flok-mark.png" alt="FLOK" className="appLogo" />
        </Link>
        <div className="appHeaderRight">
          <AuthIndicator email={emailOrPhone} userId={userId} />
        </div>
      </div>
    </header>
  );
}
