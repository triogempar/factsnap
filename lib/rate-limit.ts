import { LIMITS, rateLimitMax } from "./limits";

type HitStore = Map<string, number[]>;

export function createRateLimiter(options?: {
  now?: () => number;
  max?: number;
  windowMs?: number;
  store?: HitStore;
}) {
  const store = options?.store ?? new Map<string, number[]>();
  return {
    check(ip: string): { ok: true; remaining: number } | { ok: false; retryAfterMs: number } {
      const now = options?.now?.() ?? Date.now();
      const windowMs = options?.windowMs ?? LIMITS.rateLimitWindowMs;
      const max = options?.max ?? rateLimitMax();
      const recent = (store.get(ip) ?? []).filter((timestamp) => now - timestamp < windowMs);
      if (recent.length >= max) {
        store.set(ip, recent);
        const oldest = recent[0] ?? now;
        return { ok: false, retryAfterMs: Math.max(1_000, windowMs - (now - oldest)) };
      }
      recent.push(now);
      store.set(ip, recent);
      return { ok: true, remaining: max - recent.length };
    },
  };
}

export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 80);
  }
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp.slice(0, 80);
  return "unknown";
}

export const ipRateLimiter = createRateLimiter();
