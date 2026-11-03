import { scrubUntrustedUrls } from "./evidence";
import { scoreLabel } from "./score";
import type { CheckResult } from "./types";

export function buildShareText(result: Omit<CheckResult, "shareText">): string {
  const lines = [
    `FactSnap · ${result.score}/100 · ${scoreLabel(result.score)}`,
    ...result.claims.map((claim, index) => {
      const link = claim.cited[0]?.url;
      return `${index + 1}. ${claim.verdict}: ${claim.text}${link ? ` (${link})` : ""}`;
    }),
    "Checked before forwarding.",
  ];
  return lines.join("\n").slice(0, 1200);
}

export function allowedUrls(result: Omit<CheckResult, "shareText">): string[] {
  return result.claims.flatMap((claim) => claim.cited.map((source) => source.url));
}

export function finalizeShareText(modelText: string, result: Omit<CheckResult, "shareText">): string {
  const cleaned = scrubUntrustedUrls(modelText, allowedUrls(result)).slice(0, 1200);
  if (cleaned.length < 20) return buildShareText(result);
  return cleaned;
}
