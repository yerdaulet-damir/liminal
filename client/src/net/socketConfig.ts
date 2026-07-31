import { DEFAULT_PARTY_HOST } from "@liminal/shared";

interface HostOptions {
  production: boolean;
  configuredHost?: string;
  queryHost?: string | null;
}

export function resolvePartyHost(options: HostOptions): string {
  const configured = options.configuredHost?.trim();
  if (options.production) {
    if (!configured) throw new Error("VITE_PARTY_HOST is required for production builds");
    return configured;
  }
  return options.queryHost?.trim() || configured || DEFAULT_PARTY_HOST;
}

export function partyHost(): string {
  return resolvePartyHost({
    production: import.meta.env.PROD,
    configuredHost: import.meta.env.VITE_PARTY_HOST,
    queryHost: new URLSearchParams(location.search).get("host"),
  });
}

function sessionKey(scope: string): string {
  return `liminal.session.${scope}`;
}

export function readResumeToken(scope: string): string | undefined {
  try {
    return sessionStorage.getItem(sessionKey(scope)) ?? undefined;
  } catch {
    return undefined;
  }
}

export function storeResumeToken(scope: string, token: string): void {
  try {
    sessionStorage.setItem(sessionKey(scope), token);
  } catch {
    // Storage denial only disables reconnection; gameplay remains available.
  }
}

export function clearResumeToken(scope: string): void {
  try {
    sessionStorage.removeItem(sessionKey(scope));
  } catch {
    // Nothing else can be cleared when storage is unavailable.
  }
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
