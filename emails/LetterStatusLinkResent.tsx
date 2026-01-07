import * as React from "react";

export function LetterStatusLinkResentEmail({
  subject,
  originName,
  destName,
  statusUrl,
}: {
  subject: string;
  originName: string;
  destName: string;
  statusUrl: string;
}) {
  return (
    <div style={{ fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial", lineHeight: 1.5 }}>
      <h2 style={{ margin: "0 0 8px" }}>Status link re-sent</h2>

      <p style={{ margin: "0 0 10px" }}>
        <strong>{subject}</strong>
      </p>

      <p style={{ margin: "0 0 14px", opacity: 0.85 }}>
        {originName} → {destName}
      </p>

      <p style={{ margin: "0 0 16px" }}>
        <a
          href={statusUrl}
          style={{
            display: "inline-block",
            padding: "10px 14px",
            borderRadius: 10,
            textDecoration: "none",
            border: "1px solid #222",
          }}
        >
          View flight status
        </a>
      </p>

      <p style={{ opacity: 0.7, margin: 0 }}>We found your link and slapped a stamp on it.</p>
    </div>
  );
}