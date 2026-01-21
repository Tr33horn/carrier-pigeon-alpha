"use client";

import { useEffect } from "react";

export default function CleanAuthHash() {
  useEffect(() => {
    if (!window.location.hash) return;
    if (!window.location.hash.includes("error=")) return;

    // Remove the fragment, keep path + query.
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }, []);

  return null;
}