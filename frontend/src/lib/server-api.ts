/** Server-side reads only. Mutations go from the browser straight to Django (Architecture Guardrails). */

const DEFAULT_BASE = process.env.INTERNAL_API_URL ?? "http://localhost:8000";

export function buildServerHeaders(
  incoming: Headers,
  publicHost: string,
): Headers {
  const headers = new Headers({
    accept: "application/json",
    "x-forwarded-proto": "https",
    "x-forwarded-host": publicHost,
  });
  const cookie = incoming.get("cookie");
  if (cookie) headers.set("cookie", cookie);
  return headers;
}

export async function serverGet<T>(
  path: string,
  incoming: Headers,
  {
    baseUrl = DEFAULT_BASE,
    publicHost = process.env.PUBLIC_HOST ?? "localhost",
  } = {},
): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: buildServerHeaders(incoming, publicHost),
    cache: "no-store",
  });
  if (!response.ok)
    throw new Error(`GET ${path} failed with ${response.status}`);
  return (await response.json()) as T;
}
