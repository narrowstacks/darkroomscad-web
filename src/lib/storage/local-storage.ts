// Thin, SSR-safe localStorage wrappers. Every access is guarded so a missing
// (server), disabled (private mode), or quota-exceeded storage never throws.

export function safeGet(key: string): string | null {
  try {
    return typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

export function safeSet(key: string, value: string): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
  } catch {
    // ignore: storage disabled or over quota — persistence is best-effort
  }
}
