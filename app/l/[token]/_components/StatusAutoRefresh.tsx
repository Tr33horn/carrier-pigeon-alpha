"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type Props = {
  enabled: boolean;
  intervalMs?: number;
};

export default function StatusAutoRefresh({ enabled, intervalMs = 30000 }: Props) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return;

    const id = window.setInterval(() => {
      router.refresh();
    }, intervalMs);

    return () => window.clearInterval(id);
  }, [enabled, intervalMs, router]);

  return null;
}
