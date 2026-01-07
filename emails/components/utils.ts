// emails/components/utils.ts
export function joinUrl(base: string, pathOrUrl: string) {
  if (!pathOrUrl) return base;
  if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) return pathOrUrl;

  const b = base.endsWith("/") ? base.slice(0, -1) : base;
  const p = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${b}${p}`;
}

export const styles = {
  h1: { fontSize: 20, fontWeight: 900 as const, margin: "6px 0 10px" },
  p: { margin: "0 0 12px", fontSize: 14, color: "#111" },
  subtle: { margin: "0 0 12px", fontSize: 13, color: "#444" },
  small: { fontSize: 12, color: "#666", marginTop: 16 },
  hr: { margin: "16px 0", borderTop: "1px solid #eee" },
  button: {
    backgroundColor: "#111",
    color: "#fff",
    padding: "12px 16px",
    borderRadius: 12,
    display: "inline-block",
    textDecoration: "none",
    fontWeight: 800,
  } as const,
  pill: {
    display: "inline-block",
    fontSize: 12,
    color: "#444",
    backgroundColor: "#f3f4f6",
    border: "1px solid #e5e7eb",
    padding: "6px 10px",
    borderRadius: 999,
    margin: "0 0 12px",
  } as const,
  callout: {
    backgroundColor: "#fafafa",
    border: "1px solid #eee",
    padding: 14,
    borderRadius: 12,
    margin: "12px 0 12px",
  } as const,
};