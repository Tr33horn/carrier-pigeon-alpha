"use client";

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
    <h1 style={{ fontSize: 28, fontWeight: 900 }}>Carrier Pigeon</h1>
    <p style={{ marginTop: 10, opacity: 0.8 }}>
      Messages delivered with patience.
    </p>

    <a
      href="/write"
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
    </a>
  </main>
);
}