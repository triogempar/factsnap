import { LIMITS } from "./limits";
import type { Evidence } from "./types";

export function canonicalUrl(raw: string): string {
  try {
    const url = new URL(raw);
    url.hash = "";
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    for (const key of [...url.searchParams.keys()]) {
      const lower = key.toLowerCase();
      if (lower.startsWith("utm_") || lower === "fbclid") url.searchParams.delete(key);
    }
    const path = url.pathname.replace(/\/$/, "");
    const search = url.searchParams.toString();
    return `${url.protocol}//${url.hostname}${path}${search ? `?${search}` : ""}`;
  } catch {
    return raw.trim();
  }
}

export function dedupeEvidence(items: Evidence[]): Evidence[] {
  const seen = new Set<string>();
  const unique: Evidence[] = [];
  for (const item of items) {
    const key = canonicalUrl(item.url);
    if (!item.url || seen.has(key)) continue;
    seen.add(key);
    unique.push({
      ...item,
      title: item.title.trim() || "Untitled source",
      snippet: item.snippet.trim().slice(0, LIMITS.highlightChars),
    });
  }
  return unique;
}

export function selectCited(reviewed: Evidence[], indexes: number[]): Evidence[] {
  const cited: Evidence[] = [];
  const used = new Set<number>();
  for (const index of indexes) {
    if (!Number.isInteger(index) || index < 1 || index > reviewed.length || used.has(index)) continue;
    used.add(index);
    const source = reviewed[index - 1];
    if (source) cited.push(source);
    if (cited.length === 4) break;
  }
  return cited;
}

export function scrubUntrustedUrls(text: string, allowed: string[]): string {
  const allowedSet = new Set(allowed.map(canonicalUrl));
  return text
    .replace(/https?:\/\/[^\s<>\]]+/gi, (match) => {
      const trimmed = match.replace(/[),.;]+$/, "");
      const suffix = match.slice(trimmed.length);
      return allowedSet.has(canonicalUrl(trimmed)) ? trimmed + suffix : "";
    })
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +([.,;])/g, "$1")
    .trim();
}
