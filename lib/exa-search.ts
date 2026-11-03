import Exa from "exa-js";
import { exaSearchType, requireEnv } from "./env";
import { dedupeEvidence } from "./evidence";
import { UserFacingError } from "./errors";
import { LIMITS } from "./limits";
import type { Evidence, PageReader, Searcher } from "./types";

type ExaHit = {
  url?: string | null;
  title?: string | null;
  publishedDate?: string | null;
  highlights?: string[] | null;
  text?: string | null;
};

export function mapExaResults(results: ExaHit[], field: "highlights" | "text"): Evidence[] {
  const mapped: Evidence[] = [];
  for (const result of results) {
    if (!result.url) continue;
    const snippet =
      field === "highlights"
        ? (result.highlights ?? []).filter(Boolean).join(" ")
        : (result.text ?? "");
    mapped.push({
      url: result.url,
      title: result.title?.trim() || "Untitled source",
      snippet: snippet.replace(/\s+/g, " ").trim().slice(0, LIMITS.highlightChars),
      publishedDate: result.publishedDate || undefined,
    });
  }
  return dedupeEvidence(mapped);
}

function exaClient(): Exa {
  return new Exa(requireEnv("EXA_API_KEY"), undefined, { timeout: LIMITS.exaTimeoutMs });
}

export function createExaSearcher(): Searcher {
  return async ({ query, numResults, includeDomains, objective }) => {
    try {
      const response = await exaClient().search(query, {
        type: exaSearchType(),
        numResults,
        includeDomains,
        objective: objective.slice(0, 4000),
        contents: { highlights: { maxCharacters: LIMITS.highlightChars } },
        timeout: LIMITS.exaTimeoutMs,
      });
      return mapExaResults(response.results, "highlights");
    } catch (error) {
      if (error instanceof UserFacingError) throw error;
      const message = error instanceof Error ? error.message : "Search failed";
      if (/401|403|api key/i.test(message)) {
        throw new UserFacingError("Exa rejected EXA_API_KEY. Check the key in the environment.");
      }
      throw new UserFacingError("The evidence search failed. Try again in a moment.");
    }
  };
}

export function createExaPageReader(): PageReader {
  return async (url) => {
    try {
      const response = await exaClient().getContents([url], {
        text: { maxCharacters: LIMITS.pageTextChars },
        highlights: { maxCharacters: LIMITS.highlightChars },
        timeout: LIMITS.exaTimeoutMs,
      });
      const [first] = mapExaResults(response.results, "text");
      if (!first) throw new UserFacingError("That page could not be read. Paste the claim text instead.");
      const highlights = mapExaResults(response.results, "highlights")[0]?.snippet ?? "";
      return {
        url: first.url,
        title: first.title,
        text: [first.snippet, highlights].filter(Boolean).join("\n\n").slice(0, LIMITS.pageTextChars),
      };
    } catch (error) {
      if (error instanceof UserFacingError) throw error;
      throw new UserFacingError("That page could not be read. Paste the claim text instead.");
    }
  };
}
