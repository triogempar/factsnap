export const LIMITS = {
  minTextChars: 12,
  maxTextChars: 8_000,
  maxUrlChars: 2_000,
  maxNoteChars: 500,
  maxImageDataUrlChars: 3_800_000,
  maxRequestBytes: 4_200_000,
  maxClaims: 4,
  maxSourcesPerClaim: 5,
  factCheckSearchResults: 4,
  openSearchResults: 4,
  highlightChars: 700,
  pageTextChars: 6_000,
  promptExcerptChars: 500,
  rateLimitPerIp: 12,
  rateLimitWindowMs: 60 * 60 * 1000,
  llmTimeoutMs: 28_000,
  exaTimeoutMs: 12_000,
  extractTokens: 900,
  judgeTokens: 500,
  shareTokens: 400,
} as const;

export function rateLimitMax(): number {
  const raw = Number(process.env.FACTSNAP_RATE_LIMIT ?? LIMITS.rateLimitPerIp);
  if (!Number.isFinite(raw)) return LIMITS.rateLimitPerIp;
  return Math.min(60, Math.max(1, Math.floor(raw)));
}
