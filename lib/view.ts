import { credibilityScore } from "./score";
import type { CheckResult, Evidence, RedFlag, StreamEvent, Verdict } from "./types";

export type ClaimPhase = "queued" | "searching" | "judging" | "done";

export type ClaimView = {
  id: string;
  text: string;
  phase: ClaimPhase;
  verdict?: Verdict;
  explanation?: string;
  cited: Evidence[];
  reviewed: Evidence[];
};

export type CheckView = {
  phase: "idle" | "running" | "done" | "error";
  status: string;
  language: string | null;
  inputSummary: string | null;
  claims: ClaimView[];
  redFlags: RedFlag[];
  score: number | null;
  shareText: string | null;
  error: string | null;
  preview: boolean;
};

export const emptyView: CheckView = {
  phase: "idle",
  status: "",
  language: null,
  inputSummary: null,
  claims: [],
  redFlags: [],
  score: null,
  shareText: null,
  error: null,
  preview: false,
};

function liveScore(claims: ClaimView[], redFlags: RedFlag[], explicit?: number | null): number | null {
  if (typeof explicit === "number") return explicit;
  const verdicts = claims.flatMap((claim) => (claim.verdict ? [claim.verdict] : []));
  if (verdicts.length === 0) return null;
  return credibilityScore(verdicts, redFlags.length);
}

export function applyEvent(view: CheckView, event: StreamEvent, preview = view.preview): CheckView {
  switch (event.type) {
    case "status":
      return {
        ...view,
        phase: view.phase === "done" ? "done" : "running",
        status: event.message,
        preview,
        error: null,
      };
    case "claims":
      return {
        ...view,
        phase: "running",
        language: event.language,
        redFlags: event.redFlags,
        claims: event.claims.map((claim) => ({
          id: claim.id,
          text: claim.text,
          phase: "queued",
          cited: [],
          reviewed: [],
        })),
        preview,
        error: null,
      };
    case "searching":
      return {
        ...view,
        phase: "running",
        status: event.message,
        claims: view.claims.map((claim) =>
          claim.id === event.claimId ? { ...claim, phase: "searching" } : claim,
        ),
      };
    case "sources":
      return {
        ...view,
        claims: view.claims.map((claim) =>
          claim.id === event.claimId ? { ...claim, phase: "judging", reviewed: event.sources } : claim,
        ),
      };
    case "verdict": {
      const claims = view.claims.map((claim) =>
        claim.id === event.claim.id
          ? {
              ...claim,
              phase: "done" as const,
              text: event.claim.text,
              verdict: event.claim.verdict,
              explanation: event.claim.explanation,
              cited: event.claim.cited,
              reviewed: event.claim.reviewed,
            }
          : claim,
      );
      return { ...view, claims, score: liveScore(claims, view.redFlags) };
    }
    case "done":
      return {
        ...view,
        phase: "done",
        status: "Check complete",
        language: event.result.language,
        inputSummary: event.result.inputSummary,
        redFlags: event.result.redFlags,
        score: event.result.score,
        shareText: event.result.shareText,
        claims: event.result.claims.map((claim) => ({
          id: claim.id,
          text: claim.text,
          phase: "done",
          verdict: claim.verdict,
          explanation: claim.explanation,
          cited: claim.cited,
          reviewed: claim.reviewed,
        })),
        error: null,
        preview,
      };
    case "error": {
      const hasVerdict = view.claims.some((claim) => claim.verdict);
      return {
        ...view,
        phase: hasVerdict ? "done" : "error",
        status: event.message,
        error: event.message,
      };
    }
    default:
      return view;
  }
}

export function viewFromResult(result: CheckResult, preview: boolean): CheckView {
  return applyEvent({ ...emptyView, preview }, { type: "done", result }, preview);
}
