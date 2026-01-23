function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function unwrapStartNext(input: string | null | undefined): string | null {
  if (!input) return null;
  let current = input;

  for (let i = 0; i < 5; i += 1) {
    const decoded = safeDecode(current);
    if (!decoded.startsWith("/start")) return decoded;

    try {
      const url = new URL(decoded, "http://local");
      const next = url.searchParams.get("next");
      if (!next) return decoded;
      current = next;
    } catch {
      return decoded;
    }
  }

  return safeDecode(current);
}

export function sanitizeNext(next: string | null | undefined): string {
  const unwrapped = unwrapStartNext(next);
  if (!unwrapped) return "/inbox";
  let n = unwrapped.trim();
  if (!n) return "/inbox";
  if (n.startsWith("http://") || n.startsWith("https://")) return "/inbox";
  if (!n.startsWith("/")) return "/inbox";
  if (n.startsWith("//")) return "/inbox";

  while (n.startsWith("//")) n = n.slice(1);

  if (!n.startsWith("/")) return "/inbox";
  if (n === "/") return "/inbox";
  if (n.startsWith("/start")) return "/inbox";
  return n;
}
