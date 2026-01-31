"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

type Props = {
  token: string;
  variant?: "card" | "seal";
  className?: string;
  children?: ReactNode;
  buttonProps?: React.ButtonHTMLAttributes<HTMLButtonElement>;
  itemLabel?: string;
};

export default function UnsealButton({
  token,
  variant = "card",
  className,
  children,
  buttonProps,
  itemLabel = "letter",
}: Props) {
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
      if (!res.ok) {
        const msg = String(data?.error ?? "");
        if (msg.includes("not_arrived")) {
          throw new Error(`Not yet — this ${itemLabel} has not arrived.`);
        }
        throw new Error(msg || `Could not open the ${itemLabel}.`);
      }
      router.replace(`/l/${token}/open?celebrate=1`);
    } catch (e: any) {
      setError(e?.message || `Could not open the ${itemLabel}.`);
    } finally {
      setLoading(false);
    }
  };

  if (variant === "seal") {
    return (
      <div>
        <button
          type="button"
          className={className || "waxBtn"}
          onClick={onUnseal}
          disabled={loading || buttonProps?.disabled}
          {...buttonProps}
        >
          {children ?? (loading ? "Opening…" : `Open ${itemLabel}`)}
        </button>
        {error ? (
          <div className="err" style={{ marginTop: 8 }}>
            ❌ {error}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="card" style={{ maxWidth: 640 }}>
      <div className="cardHead">
        <div>
          <div className="kicker">Ready to open</div>
          <div className="h2">Open the {itemLabel}</div>
        </div>
      </div>

      <div className="stack" style={{ gap: 10 }}>
        <button type="button" className="btnPrimary" onClick={onUnseal} disabled={loading}>
          {loading ? "Opening…" : `Open ${itemLabel}`}
        </button>
        {error ? <div className="err">❌ {error}</div> : null}
      </div>
    </div>
  );
}
