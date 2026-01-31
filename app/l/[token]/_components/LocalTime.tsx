"use client";

import { useMemo } from "react";

export default function LocalTime({ iso, fallback = "" }: { iso?: string | null; fallback?: string }) {
  const text = useMemo(() => {
    if (!iso) return "";
    let normalized = iso.trim();
    if (!normalized) return "";
    // If timezone is missing, treat as UTC to avoid local-time shifts.
    const hasTz = /([zZ]|[+-]\d{2}:\d{2})$/.test(normalized);
    if (!hasTz) {
      normalized = normalized.replace(/\s*UTC\s*$/i, "");
      if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(normalized)) {
        normalized = normalized.replace(" ", "T");
      }
      normalized = `${normalized}Z`;
    }
    const d = new Date(normalized);
    if (!Number.isFinite(d.getTime())) return "";
    return d.toLocaleString();
  }, [iso]);

  return <span suppressHydrationWarning>{text || fallback}</span>;
}
