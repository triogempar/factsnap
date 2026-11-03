import { reasoningEffort, fireworksModel, requireEnv } from "./env";
import { UserFacingError } from "./errors";
import { LIMITS } from "./limits";
import type { ChatMessage, Completer } from "./types";

const FIREWORKS_URL = "https://api.fireworks.ai/inference/v1/chat/completions";

function messageText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (!part || typeof part !== "object" || !("text" in part)) return "";
      return String((part as { text: unknown }).text ?? "");
    })
    .join("");
}

function fireworksError(status: number, body: string): UserFacingError {
  let detail = "";
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } };
    detail = parsed.error?.message?.slice(0, 240) ?? "";
  } catch {
    detail = body.slice(0, 240);
  }
  if (status === 401 || status === 403) {
    return new UserFacingError("Fireworks rejected FIREWORKS_API_KEY. Check the key in the environment.");
  }
  if (status === 404) {
    return new UserFacingError(
      `Fireworks could not find model ${fireworksModel()}. Check FIREWORKS_MODEL.${detail ? ` ${detail}` : ""}`,
    );
  }
  if (status === 429) {
    return new UserFacingError("Fireworks rate limit reached. Wait a moment and try again.");
  }
  if (/reasoning[_ ]effort/i.test(detail)) {
    return new UserFacingError(
      "Fireworks rejected the reasoning setting. Set FIREWORKS_REASONING_EFFORT to low and redeploy.",
    );
  }
  return new UserFacingError(
    `The model request failed (${status}).${detail ? ` ${detail}` : " Try again in a moment."}`,
  );
}

export function createFireworksCompleter(fetchImpl: typeof fetch = fetch): Completer {
  const apiKey = requireEnv("FIREWORKS_API_KEY");
  const model = fireworksModel();
  const reasoning = reasoningEffort();

  return async (messages, maxTokens) => {
    const budget = reasoning === "none" ? maxTokens : Math.min(4096, maxTokens * 6);
    const body: Record<string, unknown> = {
      model,
      messages,
      max_tokens: budget,
      response_format: { type: "json_object" },
      reasoning_effort: reasoning,
    };
    if (reasoning === "none") body.temperature = 0.1;

    let response: Response;
    try {
      response = await fetchImpl(FIREWORKS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(LIMITS.llmTimeoutMs),
      });
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") {
        throw new UserFacingError("The model took too long to answer. Try again.");
      }
      throw new UserFacingError("The model request could not be sent. Try again.");
    }

    const raw = await response.text();
    if (!response.ok) throw fireworksError(response.status, raw);

    let parsed: { choices?: Array<{ message?: { content?: unknown } }> };
    try {
      parsed = JSON.parse(raw) as { choices?: Array<{ message?: { content?: unknown } }> };
    } catch {
      throw new UserFacingError("Fireworks returned an unreadable response.");
    }
    const text = messageText(parsed.choices?.[0]?.message?.content).trim();
    if (!text) throw new UserFacingError("The model returned an empty answer.");
    return text;
  };
}

export type { ChatMessage };
