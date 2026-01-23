"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
      const res = await fetch("/api/letters/unseal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Could not unseal the letter.");
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
