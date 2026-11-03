import { describe, expect, it } from "vitest";
import { FACT_CHECK_DOMAINS } from "@/lib/domains";
import { runFactCheck } from "@/lib/pipeline";
import type { ChatMessage, Evidence, PipelineDeps, SearchArgs, StreamEvent } from "@/lib/types";

const SNOPES: Evidence = {
  url: "https://www.snopes.com/fact-check/5g-covid/",
  title: "Snopes on 5G and COVID-19",
  snippet: "Snopes rates the claim that 5G towers spread COVID-19 false.",
};

const OPEN: Evidence = {
  url: "https://www.reuters.com/article/factcheck-5g",
  title: "Reuters fact check",
  snippet: "Reuters found no evidence that 5G spreads the virus.",
};

function collect(events: AsyncGenerator<StreamEvent>): Promise<StreamEvent[]> {
  return Array.fromAsync(events);
}

function scripted(responses: unknown[]) {
  const calls: ChatMessage[][] = [];
  const searches: SearchArgs[] = [];
  const pages: string[] = [];
  const deps: PipelineDeps = {
    complete: async (messages) => {
      calls.push(messages);
      const next = responses.shift();
      if (next === undefined) throw new Error("no scripted model response");
      return typeof next === "string" ? next : JSON.stringify(next);
    },
    search: async (args) => {
      searches.push(args);
      if (args.includeDomains) return [SNOPES];
      return [OPEN];
    },
    readPage: async (url) => {
      pages.push(url);
      return {
        url,
        title: "Snopes page",
        text: "A video does not show a 5G tower torn down in China to stop COVID-19. The footage is from Hong Kong in 2019.",
      };
    },
  };
  return { calls, searches, pages, deps };
}

async function run(input: Parameters<typeof runFactCheck>[0], responses: unknown[], search?: PipelineDeps["search"]) {
  const harness = scripted(responses);
  if (search) harness.deps.search = search;
  const events = await collect(runFactCheck(input, harness.deps));
  return { ...harness, events };
}

describe("text checks", () => {
  it("searches fact-checkers first, cites only retrieved sources, and writes a reply", async () => {
    const { events, searches, calls } = await run(
      {
        kind: "text",
        text: "BREAKING: Scientists confirmed that 5G towers spread COVID-19. Share this before it disappears!!",
      },
      [
        {
          language: "English",
          claims: ["5G towers spread COVID-19."],
          redFlags: [{ code: "urgency", detail: "Tells people to share it before it disappears." }],
        },
        { verdict: "False", explanation: "Snopes reports the claim is false.", sourceIndexes: [1, 99] },
        { shareText: "This is false. Source: https://www.snopes.com/fact-check/5g-covid/ and https://evil.example/nope" },
      ],
    );

    expect(searches[0]?.includeDomains).toEqual([...FACT_CHECK_DOMAINS]);
    expect(searches[0]?.includeDomains).toContain("turnbackhoax.id");
    expect(searches[0]?.includeDomains).toContain("cekfakta.com");
    expect(searches.some((search) => !search.includeDomains)).toBe(true);
    expect(calls[1]?.[1]?.content).toEqual(expect.any(String));
    expect(String(calls[1]?.[1]?.content)).not.toContain("https://");

    const done = events.find((event) => event.type === "done");
    expect(done?.type).toBe("done");
    if (done?.type !== "done") return;
    expect(done.result.claims[0]?.verdict).toBe("False");
    expect(done.result.claims[0]?.cited.map((source) => source.url)).toEqual([SNOPES.url]);
    expect(done.result.shareText).toContain("snopes.com");
    expect(done.result.shareText).not.toContain("evil.example");
    expect(done.result.score).toBe(3);
    expect(events.map((event) => event.type)).toEqual([
      "status",
      "claims",
      "searching",
      "sources",
      "status",
      "verdict",
      "status",
      "done",
    ]);
  });

  it("stops after the fact-check search when three sources are already in", async () => {
    const searches: SearchArgs[] = [];
    await run(
      { kind: "text", text: "The Eiffel Tower was completed in 1889 for the Paris World's Fair." },
      [
        { language: "English", claims: ["The Eiffel Tower was completed in 1889."] },
        { verdict: "Supported", explanation: "The pages confirm the 1889 completion.", sourceIndexes: [1] },
        { shareText: "This one holds up." },
      ],
      async (args) => {
        searches.push(args);
        return [SNOPES, OPEN, { ...OPEN, url: "https://www.bbc.com/eiffel", title: "BBC", snippet: "Completed in 1889." }];
      },
    );
    expect(searches).toHaveLength(1);
    expect(searches[0]?.includeDomains?.[0]).toBe("snopes.com");
  });

  it("leaves a claim unverified when search returns nothing and does not judge it", async () => {
    const { events, calls } = await run(
      { kind: "text", text: "A very specific claim about a private event yesterday." },
      [{ language: "English", claims: ["A private event happened yesterday."] }, { shareText: "Not enough to call it." }],
      async () => [],
    );
    expect(calls).toHaveLength(2);
    const verdict = events.find((event) => event.type === "verdict");
    expect(verdict?.type).toBe("verdict");
    if (verdict?.type !== "verdict") return;
    expect(verdict.claim.verdict).toBe("Unverified");
  });

  it("caps the model at four claims", async () => {
    const { events } = await run(
      { kind: "text", text: "One. Two. Three. Four. Five separate factual claims in this paste." },
      [
        {
          language: "English",
          claims: ["Claim number one.", "Claim number two.", "Claim number three.", "Claim number four.", "Claim number five."],
        },
        ...Array.from({ length: 4 }, () => ({
          verdict: "Unverified",
          explanation: "Not enough evidence in the excerpts.",
          sourceIndexes: [],
        })),
        { shareText: "Four claims checked." },
      ],
      async () => [SNOPES],
    );
    const claims = events.find((event) => event.type === "claims");
    expect(claims?.type).toBe("claims");
    if (claims?.type === "claims") expect(claims.claims).toHaveLength(4);
  });
});

describe("url checks", () => {
  it("reads the page and treats it as the submission, not as the evidence", async () => {
    const url = "https://www.snopes.com/fact-check/5g-tower-torn-down-china-covid/";
    const { pages, calls, searches } = await run(urlInput(url), [
      { language: "English", claims: ["The video shows a 5G tower torn down in China to stop COVID-19."] },
      { verdict: "False", explanation: "The footage is from Hong Kong in 2019.", sourceIndexes: [1] },
      { shareText: "The video is not what the forward says." },
    ]);
    expect(pages).toEqual([url]);
    expect(String(calls[0]?.[1]?.content)).toContain("not independent evidence");
    expect(String(calls[0]?.[1]?.content)).toContain("Hong Kong in 2019");
    expect(searches[0]?.query).toContain("5G tower");
  });
});

describe("image checks", () => {
  it("sends the screenshot to the extractor and keeps later calls text-only", async () => {
    const imageDataUrl = "data:image/jpeg;base64,aGVsbG8=";
    const { calls, events } = await run(
      { kind: "image", imageDataUrl, note: "Forwarded on WhatsApp" },
      [
        { language: "Indonesian", claims: ["Klaim di tangkapan layar ini soal minyak babi."] },
        { verdict: "False", explanation: "Sumber yang ditemukan membantah klaim itu.", sourceIndexes: [1] },
        { shareText: "Klaim di gambar itu salah." },
      ],
    );
    const first = calls[0]?.[1]?.content;
    expect(Array.isArray(first)).toBe(true);
    if (!Array.isArray(first)) return;
    expect(first).toContainEqual({ type: "image_url", image_url: { url: imageDataUrl } });
    expect(String(first[0] && "text" in first[0] ? first[0].text : "")).toContain("WhatsApp");
    expect(typeof calls[1]?.[1]?.content).toBe("string");
    expect(events.some((event) => event.type === "done")).toBe(true);
  });
});

function urlInput(url: string): Parameters<typeof runFactCheck>[0] {
  return { kind: "url", url };
}
