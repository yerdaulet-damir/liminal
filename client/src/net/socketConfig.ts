import { DEFAULT_PARTY_HOST } from "@liminal/shared";

export function partyHost(): string {
  const fromQuery = new URLSearchParams(location.search).get("host");
  return fromQuery ?? import.meta.env.VITE_PARTY_HOST ?? DEFAULT_PARTY_HOST;
}

export function stableSocketId(scope: string): string {
  const key = `liminal.socket.${scope}`;
  try {
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const created = crypto.randomUUID();
    sessionStorage.setItem(key, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}
