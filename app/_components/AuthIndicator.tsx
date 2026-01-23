"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { sanitizeNext } from "@/app/lib/authRedirect";
import { createSupabaseBrowserClient } from "@/app/lib/supabase/client";

type Props = {
  email?: string | null;
  userId?: string | null;
};

export default function AuthIndicator({ email, userId }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);

  const label = email || userId;
  const signedIn = !!label;
  const rawNextParam = useMemo(() => {
    if (pathname === "/start") {
      return searchParams?.get("next") || "/new";
    }
    if (pathname.startsWith("/auth/callback")) {
      return "/inbox";
    }
    return pathname || "/inbox";
  }, [pathname, searchParams]);

  const cleanNext = useMemo(() => {
    const nextPath = sanitizeNext(rawNextParam);
    return nextPath.startsWith("/start") ? "/inbox" : nextPath;
  }, [rawNextParam]);

  const startHref = useMemo(() => `/start?next=${encodeURIComponent(cleanNext)}`, [cleanNext]);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_APP_ENV === "dev") {
      // Example: /start?next=/new should stay /start?next=/new
      console.log("[auth] start href:", {
        pathname,
        rawNextParam,
        cleanNext,
        href: startHref,
      });
    }
  }, [pathname, rawNextParam, cleanNext, startHref]);

  async function onSignOut() {
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
    } finally {
      router.refresh();
      router.push("/");
      setLoading(false);
    }
  }

  if (!signedIn) {
    return (
      <div className="authPill">
        <span className="muted">Not signed in</span>
        <Link href={startHref} className="btnGhost">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="authPill">
      <span className="muted">Signed in as {label}</span>
      <button type="button" className="btnGhost" onClick={onSignOut} disabled={loading}>
        {loading ? "Signing out..." : "Sign out"}
      </button>
    </div>
  );
}
