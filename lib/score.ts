import type { Verdict } from "./types";

const WEIGHT: Record<Verdict, number> = {
  Supported: 92,
  Misleading: 36,
  Unverified: 42,
  False: 8,
};

export function credibilityScore(verdicts: Verdict[], redFlagCount: number): number {
  if (verdicts.length === 0) return 0;
  const average = verdicts.reduce((sum, verdict) => sum + WEIGHT[verdict], 0) / verdicts.length;
  const penalty = Math.min(15, Math.max(0, redFlagCount) * 5);
  return Math.max(0, Math.min(100, Math.round(average - penalty)));
}

export function scoreLabel(score: number): string {
  if (score >= 75) return "Mostly credible";
  if (score >= 50) return "Mixed";
  if (score >= 30) return "Weak";
  return "Not credible";
}
