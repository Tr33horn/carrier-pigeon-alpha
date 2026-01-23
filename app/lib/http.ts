export async function safeJson(res: Response): Promise<any> {
  const type = res.headers.get("content-type") || "";
  if (type.includes("application/json")) {
    return res.json();
  }
  return { error: await res.text() };
}
