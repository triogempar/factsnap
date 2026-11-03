import { UserFacingError } from "./errors";

const REASONING = new Set(["none", "low", "high", "max"]);

export function requireEnv(name: "FIREWORKS_API_KEY" | "EXA_API_KEY"): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new UserFacingError(
      `Missing ${name}. Add it to .env.local to run locally, or to the Vercel project environment variables before deploying.`,
    );
  }
  return value;
}

export function fireworksModel(): string {
  return process.env.FIREWORKS_MODEL?.trim() || "accounts/fireworks/models/deepseek-v4p1-flash";
}

export function reasoningEffort(): "none" | "low" | "high" | "max" {
  const value = process.env.FIREWORKS_REASONING_EFFORT?.trim() || "none";
  if (!REASONING.has(value)) {
    throw new UserFacingError(
      `FIREWORKS_REASONING_EFFORT must be none, low, high, or max. Received "${value}".`,
    );
  }
  return value as "none" | "low" | "high" | "max";
}

export function exaSearchType(): "auto" | "lite" {
  const value = process.env.EXA_SEARCH_TYPE?.trim() || "auto";
  if (value === "lite" || value === "auto") return value;
  throw new UserFacingError(`EXA_SEARCH_TYPE must be auto or lite. Received "${value}".`);
}
