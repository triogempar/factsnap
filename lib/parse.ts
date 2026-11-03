import { UserFacingError } from "./errors";

export function parseModelJson(raw: string): unknown {
  const stripped = raw
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  if (!stripped) {
    throw new UserFacingError("The model returned an empty answer.");
  }

  try {
    return JSON.parse(stripped);
  } catch {
    const start = stripped.indexOf("{");
    const end = stripped.lastIndexOf("}");
    if (start === -1 || end <= start) {
      throw new UserFacingError("The model did not return JSON.");
    }
    try {
      return JSON.parse(stripped.slice(start, end + 1));
    } catch {
      throw new UserFacingError("The model did not return JSON.");
    }
  }
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}
