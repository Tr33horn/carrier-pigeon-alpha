"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/app/lib/supabase/client";

type Props = {
  token: string;
};

export default function UnsealButton({ token }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onUnseal = async () => {
    setLoading(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const { error: openErr } = await supabase.rpc("open_letter_by_token", { p_token: token });
      if (openErr) throw openErr;
      router.refresh();
    } catch (e: any) {
      setError(e?.message || "Could not unseal the letter.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: 640 }}>
      <div className="cardHead">
        <div>
          <div className="kicker">Ready to open</div>
          <div className="h2">Unseal the letter</div>
        </div>
      </div>

      <div className="stack" style={{ gap: 10 }}>
        <button type="button" className="btnPrimary" onClick={onUnseal} disabled={loading}>
          {loading ? "Unsealing…" : "Unseal letter"}
        </button>
        {error ? <div className="err">❌ {error}</div> : null}
      </div>
    </div>
  );
}
