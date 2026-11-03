import { LIMITS } from "./limits";
import { UserFacingError } from "./errors";

function isPrivateIpv4(host: string): boolean {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!match) return false;
  const parts = match.slice(1).map(Number);
  if (parts.some((part) => part > 255)) return true;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}

function isPrivateIpv6(host: string): boolean {
  const normalized = host.toLowerCase();
  if (normalized === "::1" || normalized === "::") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (normalized.startsWith("fe80")) return true;
  return false;
}

export function assertPublicHttpUrl(raw: string): URL {
  const value = raw.trim();
  if (!value || value.length > LIMITS.maxUrlChars) {
    throw new UserFacingError("Paste a single http(s) link under 2,000 characters.");
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new UserFacingError("That link is not a valid URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UserFacingError("Only http and https links can be checked.");
  }
  if (url.username || url.password) {
    throw new UserFacingError("Remove the username and password from the link.");
  }

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    !host ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    !host.includes(".") ||
    isPrivateIpv4(host) ||
    isPrivateIpv6(host)
  ) {
    throw new UserFacingError("That link points at a private or local address.");
  }

  return url;
}
