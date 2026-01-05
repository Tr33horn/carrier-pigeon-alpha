"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";

export default function Home() {
  const [status, setStatus] = useState("Checking Supabase connection...");

  useEffect(() => {
    async function run() {
      const { error } = await supabase.from("letters").select("id").limit(1);
      if (error) setStatus("❌ Supabase error: " + error.message);
      else setStatus("✅ Supabase connected successfully.");
    }
    run();
  }, []);

  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: 0.5 }}>
        FLOK
      </h1>

      <p style={{ marginTop: 10, opacity: 0.8 }}>
        Messages delivered with patience.
      </p>

      <Link
        href="/new"
        style={{
          display: "inline-block",
          marginTop: 18,
          padding: "12px 16px",
          fontWeight: 800,
          border: "1px solid #333",
          borderRadius: 10,
          textDecoration: "none",
        }}
      >
        ✍️ Write a Letter
      </Link>

      {/* subtle system status (POC-friendly) */}
      <p style={{ marginTop: 14, opacity: 0.6, fontSize: 12 }}>
        {status}
      </p>

      <p style={{ marginTop: 10 }}>
        <Link href="/dashboard" style={{ opacity: 0.8 }}>
          Go to Dashboard →
        </Link>
      </p>
    </main>
  );
}