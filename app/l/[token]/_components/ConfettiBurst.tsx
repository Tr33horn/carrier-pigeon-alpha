"use client";

import { useEffect, useState } from "react";

export default function ConfettiBurst({
  active,
  count = 18,
  durationMs = 1200,
  clearParam = "celebrate",
}: {
  active: boolean;
  count?: number;
  durationMs?: number;
  clearParam?: string;
}) {
  const [visible, setVisible] = useState(active);

  useEffect(() => {
    if (!active) return;

    setVisible(true);

    if (typeof window !== "undefined" && clearParam) {
      const url = new URL(window.location.href);
      url.searchParams.delete(clearParam);
      window.history.replaceState({}, "", url.toString());
    }

    const id = window.setTimeout(() => setVisible(false), durationMs);
    return () => window.clearTimeout(id);
  }, [active, durationMs, clearParam]);

  if (!visible) return null;

  return (
    <div className="confetti" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} className="confetti-bit" />
      ))}
    </div>
  );
}
