export function getCanonicalOrigin(reqUrl?: string): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.APP_BASE_URL ||
    "";

  const origin = raw || (reqUrl ? new URL(reqUrl).origin : "");
  return origin.endsWith("/") ? origin.slice(0, -1) : origin;
}

export function isLocalOrigin(origin: string): boolean {
  if (!origin) return false;
  return /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
}
