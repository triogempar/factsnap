import { LIMITS } from "./limits";
import { asRecord } from "./parse";
import { selectCited } from "./evidence";
import { RED_FLAG_CODES, VERDICTS, type Evidence, type RedFlag, type Verdict } from "./types";

function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

export function normalizeLanguage(value: unknown): string {
  const language = cleanText(value, 40);
  return language.length >= 2 ? language : "English";
}

export function normalizeClaims(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const claims: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const text =
      typeof item === "string"
        ? cleanText(item, 400)
        : cleanText(asRecord(item)?.text ?? asRecord(item)?.claim, 400);
    if (text.length < 8) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    claims.push(text);
    if (claims.length === LIMITS.maxClaims) break;
  }
  return claims;
}

export function normalizeRedFlags(value: unknown): RedFlag[] {
  if (!Array.isArray(value)) return [];
  const flags: RedFlag[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const record = asRecord(item);
    if (!record) continue;
    const code = cleanText(record.code, 40).toLowerCase();
    if (!RED_FLAG_CODES.includes(code as RedFlag["code"]) || seen.has(code)) continue;
    const detail = cleanText(record.detail, 180);
    if (!detail) continue;
    seen.add(code);
    flags.push({ code: code as RedFlag["code"], detail });
    if (flags.length === 4) break;
  }
  return flags;
}

export function normalizeVerdict(value: unknown): Verdict {
  const raw = cleanText(value, 40).toLowerCase();
  return VERDICTS.find((verdict) => verdict.toLowerCase() === raw) ?? "Unverified";
}

export function normalizeIndexes(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const indexes: number[] = [];
  for (const item of value) {
    const number = typeof item === "number" ? item : Number(item);
    if (!Number.isInteger(number)) continue;
    indexes.push(number);
  }
  return indexes;
}

export function explanationOrFallback(value: unknown, fallback: string): string {
  const text = cleanText(value, 800);
  return text.length >= 12 ? text : fallback;
}

export function citeOrDowngrade(
  verdict: Verdict,
  explanation: string,
  reviewed: Evidence[],
  indexes: number[],
): { verdict: Verdict; explanation: string; cited: Evidence[] } {
  const cited = selectCited(reviewed, indexes);
  if (cited.length === 0 && verdict !== "Unverified") {
    return {
      verdict: "Unverified",
      explanation:
        "None of the retrieved sources were cited for this claim, so it stays unverified.",
      cited: [],
    };
  }
  return { verdict, explanation, cited };
}
