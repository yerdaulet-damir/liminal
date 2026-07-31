const ROOM_ID_PATTERN = /^[A-Za-z0-9_-]{20,128}$/;

/** Unpredictable private-room identifier with 128 bits of browser-provided entropy. */
export function createRoomId(): string {
  return crypto.randomUUID().replaceAll("-", "");
}

export function roomIdFromSearch(search: string): string | null {
  const candidate = new URLSearchParams(search).get("room");
  return candidate && ROOM_ID_PATTERN.test(candidate) ? candidate : null;
}

export function roomIdFromLocation(): string | null {
  return roomIdFromSearch(location.search);
}

export function roomUrl(roomId: string, currentHref = location.href): string {
  if (!ROOM_ID_PATTERN.test(roomId)) throw new Error("Invalid private room identifier");
  const current = new URL(currentHref);
  const url = new URL(current.pathname, current.origin);
  url.searchParams.set("room", roomId);
  return url.toString();
}
