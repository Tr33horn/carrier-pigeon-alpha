"use client";

import { useState } from "react";
import { CITIES } from "../lib/cities";

export default function WritePage() {
  const [fromName, setFromName] = useState("Greggor");
  const [toName, setToName] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [origin, setOrigin] = useState(CITIES[0]);
  const [destination, setDestination] = useState(CITIES[CITIES.length - 1]);
  const [result, setResult] = useState<{ url: string; eta_at: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function sendLetter() {
    setSending(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/letters/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from_name: fromName,
          to_name: toName,
          subject,
          message,
          origin,
          destination,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Send failed");

      setResult({
        url: `${window.location.origin}/l/${data.public_token}`,
        eta_at: data.eta_at,
      });
    } catch (e: any) {
      setError(e.message ?? "Unknown error");
    } finally {
      setSending(false);
    }
  }

  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 720 }}>
      <h1 style={{ fontSize: 26, fontWeight: 800 }}>Write a Letter</h1>
      <p style={{ opacity: 0.7, marginTop: 6 }}>
        It’ll unlock for the recipient when the pigeon “lands.”
      </p>

      <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
        <label>
          From
          <input
            value={fromName}
            onChange={(e) => setFromName(e.target.value)}
            style={{ display: "block", width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        <label>
          To
          <input
            value={toName}
            onChange={(e) => setToName(e.target.value)}
            placeholder="Recipient name"
            style={{ display: "block", width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        <label>
          Subject
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            style={{ display: "block", width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        <label>
          Message (sealed until delivery)
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={6}
            style={{ display: "block", width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label>
            Origin
            <select
              value={origin.name}
              onChange={(e) => setOrigin(CITIES.find((c) => c.name === e.target.value)!)}
              style={{ display: "block", width: "100%", padding: 10, marginTop: 6 }}
            >
              {CITIES.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            Destination
            <select
              value={destination.name}
              onChange={(e) => setDestination(CITIES.find((c) => c.name === e.target.value)!)}
              style={{ display: "block", width: "100%", padding: 10, marginTop: 6 }}
            >
              {CITIES.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button
          onClick={sendLetter}
          disabled={sending || !message.trim() || !toName.trim()}
          style={{
            padding: "12px 14px",
            fontWeight: 700,
            cursor: sending ? "not-allowed" : "pointer",
          }}
        >
          {sending ? "Sending…" : "Send Letter"}
        </button>

        {error && (
          <p style={{ color: "crimson" }}>
            ❌ {error}
          </p>
        )}

        {result && (
          <div style={{ padding: 12, border: "1px solid #333", borderRadius: 8 }}>
            <div style={{ fontWeight: 800 }}>✅ Sent!</div>
            <div style={{ marginTop: 8 }}>
              Share link:{" "}
              <a href={result.url} style={{ textDecoration: "underline" }}>
                {result.url}
              </a>
            </div>
            <div style={{ marginTop: 6, opacity: 0.8 }}>
              ETA: {new Date(result.eta_at).toLocaleString()}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}