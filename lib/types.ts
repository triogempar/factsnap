export const VERDICTS = ["Supported", "False", "Misleading", "Unverified"] as const;

export type Verdict = (typeof VERDICTS)[number];

export const RED_FLAG_CODES = ["clickbait", "emotional", "anonymous", "urgency"] as const;

export type RedFlagCode = (typeof RED_FLAG_CODES)[number];

export type RedFlag = {
  code: RedFlagCode;
  detail: string;
};

export type Evidence = {
  url: string;
  title: string;
  snippet: string;
  publishedDate?: string;
};

export type ClaimResult = {
  id: string;
  text: string;
  verdict: Verdict;
  explanation: string;
  cited: Evidence[];
  reviewed: Evidence[];
};

export type CheckResult = {
  language: string;
  inputSummary: string;
  claims: ClaimResult[];
  redFlags: RedFlag[];
  score: number;
  shareText: string;
};

export type CheckInput =
  | { kind: "text"; text: string }
  | { kind: "url"; url: string }
  | { kind: "image"; imageDataUrl: string; note?: string };

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type ChatMessage = {
  role: "system" | "user";
  content: string | ContentPart[];
};

export type Completer = (messages: ChatMessage[], maxTokens: number) => Promise<string>;

export type SearchArgs = {
  query: string;
  numResults: number;
  includeDomains?: string[];
  objective: string;
};

export type Searcher = (args: SearchArgs) => Promise<Evidence[]>;

export type PageReader = (url: string) => Promise<{ url: string; title: string; text: string }>;

export type PipelineDeps = {
  complete: Completer;
  search: Searcher;
  readPage: PageReader;
};

export type StreamEvent =
  | { type: "status"; step: "read" | "extract" | "search" | "judge" | "share"; message: string }
  | { type: "claims"; language: string; claims: { id: string; text: string }[]; redFlags: RedFlag[] }
  | { type: "searching"; claimId: string; message: string }
  | { type: "sources"; claimId: string; sources: Evidence[] }
  | { type: "verdict"; claim: ClaimResult }
  | { type: "done"; result: CheckResult }
  | { type: "error"; message: string };
