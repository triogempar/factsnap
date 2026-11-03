import { FACT_CHECK_DOMAINS } from "./domains";
import { dedupeEvidence } from "./evidence";
import { UserFacingError } from "./errors";
import { LIMITS } from "./limits";
import {
  citeOrDowngrade,
  explanationOrFallback,
  normalizeClaims,
  normalizeIndexes,
  normalizeLanguage,
  normalizeRedFlags,
  normalizeVerdict,
} from "./normalize";
import { asRecord, parseModelJson } from "./parse";
import { EXTRACT_SYSTEM, imageExtractPrompt, JUDGE_SYSTEM, SHARE_SYSTEM } from "./prompts";
import { credibilityScore } from "./score";
import { allowedUrls, buildShareText, finalizeShareText } from "./share";
import type {
  ChatMessage,
  CheckInput,
  CheckResult,
  ClaimResult,
  Completer,
  Evidence,
  PipelineDeps,
  StreamEvent,
} from "./types";

const SEARCH_OBJECTIVE =
  "Fact-check the claim. Rank fact-checking outlets and primary news first. Pull the passage that confirms or contradicts the claim, including who published it.";

function summarizeInput(input: CheckInput, pageTitle?: string): string {
  if (input.kind === "text") return input.text.slice(0, 180);
  if (input.kind === "url") return pageTitle ? `${pageTitle} · ${input.url}` : input.url;
  return input.note ? `Screenshot · ${input.note.slice(0, 120)}` : "Screenshot";
}

async function completeJson(complete: Completer, messages: ChatMessage[], maxTokens: number): Promise<unknown> {
  let latest = "";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const prompt =
      attempt === 0
        ? messages
        : [
            ...messages,
            {
              role: "user" as const,
              content: "Your previous reply was not valid JSON. Return only one JSON object matching the schema.",
            },
          ];
    latest = await complete(prompt, maxTokens);
    try {
      return parseModelJson(latest);
    } catch (error) {
      if (attempt === 1) throw error;
    }
  }
  throw new UserFacingError("The model returned an unreadable answer.");
}

async function gatherEvidence(search: PipelineDeps["search"], claim: string): Promise<Evidence[]> {
  let preferred: Evidence[] = [];
  try {
    preferred = await search({
      query: claim,
      numResults: LIMITS.factCheckSearchResults,
      includeDomains: [...FACT_CHECK_DOMAINS],
      objective: SEARCH_OBJECTIVE,
    });
  } catch {
    preferred = [];
  }

  const merged = dedupeEvidence(preferred);
  if (merged.length >= 3) return merged.slice(0, LIMITS.maxSourcesPerClaim);

  try {
    const open = await search({
      query: `Fact check: ${claim}`,
      numResults: LIMITS.openSearchResults,
      objective: SEARCH_OBJECTIVE,
    });
    return dedupeEvidence([...merged, ...open]).slice(0, LIMITS.maxSourcesPerClaim);
  } catch {
    return merged.slice(0, LIMITS.maxSourcesPerClaim);
  }
}

function evidenceBlock(sources: Evidence[]): string {
  return sources
    .map((source, index) => {
      const published = source.publishedDate ? `\nPublished: ${source.publishedDate}` : "";
      return `[${index + 1}] ${source.title}${published}\n${source.snippet.slice(0, LIMITS.promptExcerptChars)}`;
    })
    .join("\n\n");
}

async function judgeClaim(
  complete: Completer,
  claim: string,
  language: string,
  sources: Evidence[],
): Promise<ClaimResult> {
  if (sources.length === 0) {
    return {
      id: "",
      text: claim,
      verdict: "Unverified",
      explanation:
        "No matching sources came back from fact-check outlets or the open web search, so this stays unverified.",
      cited: [],
      reviewed: [],
    };
  }

  try {
    const raw = await completeJson(
      complete,
      [
        { role: "system", content: JUDGE_SYSTEM },
        {
          role: "user",
          content: `Language: ${language}\nClaim: ${claim}\n\nEvidence:\n${evidenceBlock(sources)}`,
        },
      ],
      LIMITS.judgeTokens,
    );
    const record = asRecord(raw);
    const drafted = citeOrDowngrade(
      normalizeVerdict(record?.verdict),
      explanationOrFallback(record?.explanation, "The evidence was too thin to call this claim."),
      sources,
      normalizeIndexes(record?.sourceIndexes),
    );
    return { id: "", text: claim, ...drafted, reviewed: sources };
  } catch {
    return {
      id: "",
      text: claim,
      verdict: "Unverified",
      explanation: "This claim could not be judged from the retrieved pages, so it stays unverified.",
      cited: [],
      reviewed: sources,
    };
  }
}

async function writeShareText(complete: Completer, draft: Omit<CheckResult, "shareText">): Promise<string> {
  const fallback = buildShareText(draft);
  try {
    const raw = await completeJson(
      complete,
      [
        { role: "system", content: SHARE_SYSTEM },
        {
          role: "user",
          content: JSON.stringify({
            language: draft.language,
            score: draft.score,
            claims: draft.claims.map((claim) => ({
              text: claim.text,
              verdict: claim.verdict,
              explanation: claim.explanation,
            })),
            allowedUrls: allowedUrls(draft),
          }),
        },
      ],
      LIMITS.shareTokens,
    );
    const text = asRecord(raw)?.shareText;
    if (typeof text !== "string") return fallback;
    return finalizeShareText(text, draft);
  } catch {
    return fallback;
  }
}

export async function* runFactCheck(input: CheckInput, deps: PipelineDeps): AsyncGenerator<StreamEvent> {
  let sourceText = "";
  let pageTitle: string | undefined;

  if (input.kind === "url") {
    yield { type: "status", step: "read", message: "Reading the page…" };
    let page: { url: string; title: string; text: string };
    try {
      page = await deps.readPage(input.url);
    } catch (error) {
      if (error instanceof UserFacingError) throw error;
      throw new UserFacingError("That page could not be read. Paste the claim text instead.");
    }
    sourceText = page.text.trim();
    pageTitle = page.title.trim();
    if (sourceText.length < LIMITS.minTextChars) {
      throw new UserFacingError("That page did not return enough text. Paste the claim instead.");
    }
  }

  yield { type: "status", step: "extract", message: "Extracting checkable claims…" };

  const extractUser: ChatMessage =
    input.kind === "image"
      ? {
          role: "user",
          content: [
            { type: "text", text: imageExtractPrompt(input.note) },
            { type: "image_url", image_url: { url: input.imageDataUrl } },
          ],
        }
      : {
          role: "user",
          content:
            input.kind === "url"
              ? `This page is the submission being checked. It is not independent evidence.\nURL: ${input.url}\nTitle: ${pageTitle || "Untitled"}\nPage text:\n"""${sourceText.slice(0, LIMITS.pageTextChars)}"""`
              : `Submission:\n"""${input.text}"""`,
        };

  const extracted = asRecord(
    await completeJson(deps.complete, [{ role: "system", content: EXTRACT_SYSTEM }, extractUser], LIMITS.extractTokens),
  );
  const claimTexts = normalizeClaims(extracted?.claims);
  if (claimTexts.length === 0) {
    throw new UserFacingError("No checkable claim was found. Paste a specific factual statement.");
  }
  const language = normalizeLanguage(extracted?.language);
  const redFlags = normalizeRedFlags(extracted?.redFlags);
  const claimIds = claimTexts.map((text, index) => ({ id: `c${index + 1}`, text }));

  yield { type: "claims", language, claims: claimIds, redFlags };

  const judged: ClaimResult[] = [];
  for (const claim of claimIds) {
    yield {
      type: "searching",
      claimId: claim.id,
      message: `Searching fact-checkers for claim ${claim.id.slice(1)}…`,
    };
    const sources = await gatherEvidence(deps.search, claim.text);
    yield { type: "sources", claimId: claim.id, sources };
    yield { type: "status", step: "judge", message: `Judging claim ${claim.id.slice(1)}…` };
    const result = await judgeClaim(deps.complete, claim.text, language, sources);
    const withId = { ...result, id: claim.id };
    judged.push(withId);
    yield { type: "verdict", claim: withId };
  }

  const draft: Omit<CheckResult, "shareText"> = {
    language,
    inputSummary: summarizeInput(input, pageTitle),
    claims: judged,
    redFlags,
    score: credibilityScore(
      judged.map((claim) => claim.verdict),
      redFlags.length,
    ),
  };

  yield { type: "status", step: "share", message: "Writing a reply you can paste…" };
  const shareText = await writeShareText(deps.complete, draft);
  const result: CheckResult = { ...draft, shareText };
  yield { type: "done", result };
}
