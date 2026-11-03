import { describe, expect, it } from "vitest";
import { parseModelJson } from "@/lib/parse";
import { normalizeClaims, normalizeRedFlags } from "@/lib/normalize";
import { canonicalUrl, scrubUntrustedUrls, selectCited } from "@/lib/evidence";
import type { Evidence } from "@/lib/types";

describe("parseModelJson", () => {
  it("reads fenced JSON and ignores a think block", () => {
    const parsed = parseModelJson('<think>draft</think>\n```json\n{"claims":["A real claim."]}\n```');
    expect(parsed).toEqual({ claims: ["A real claim."] });
  });

  it("extracts the object when prose surrounds it", () => {
    expect(parseModelJson('Sure. {"verdict":"False"} thanks')).toEqual({ verdict: "False" });
  });
});

describe("normalize", () => {
  it("caps claims at four and drops duplicates", () => {
    const claims = normalizeClaims([
      "First claim here.",
      "first claim here.",
      { text: "Second claim here." },
      "Third claim here.",
      "Fourth claim here.",
      "Fifth claim should drop.",
    ]);
    expect(claims).toHaveLength(4);
    expect(claims[1]).toBe("Second claim here.");
  });

  it("keeps only known red flags", () => {
    expect(
      normalizeRedFlags([
        { code: "urgency", detail: "Share now." },
        { code: "made-up", detail: "Nope." },
        { code: "urgency", detail: "Again." },
      ]),
    ).toEqual([{ code: "urgency", detail: "Share now." }]);
  });
});

describe("evidence", () => {
  const sources: Evidence[] = [
    { url: "https://www.snopes.com/a", title: "Snopes", snippet: "One" },
    { url: "https://turnbackhoax.id/b", title: "TBH", snippet: "Two" },
  ];

  it("selects 1-based indexes and drops invented ones", () => {
    expect(selectCited(sources, [2, 9, 2, 0]).map((source) => source.title)).toEqual(["TBH"]);
  });

  it("canonicalizes tracking params and strips untrusted links", () => {
    expect(canonicalUrl("https://www.Snopes.com/a/?utm_source=x&fbclid=1")).toBe("https://snopes.com/a");
    const cleaned = scrubUntrustedUrls(
      "See https://www.snopes.com/a and https://evil.example/fake.",
      ["https://snopes.com/a"],
    );
    expect(cleaned).toContain("https://www.snopes.com/a");
    expect(cleaned).not.toContain("evil.example");
  });
});
