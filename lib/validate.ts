import { LIMITS } from "./limits";
import { UserFacingError } from "./errors";
import type { CheckInput } from "./types";
import { assertPublicHttpUrl } from "./url-safety";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function parseImageDataUrl(value: string): string {
  if (value.length > LIMITS.maxImageDataUrlChars) {
    throw new UserFacingError("That screenshot is too large. Crop it, or use the in-app upload which compresses it.");
  }
  const comma = value.indexOf(",");
  if (comma < 0) throw new UserFacingError("The image must be a base64 data URL.");
  const header = value.slice(0, comma).toLowerCase();
  const match = /^data:(image\/(?:png|jpeg|gif));base64$/.exec(header);
  if (!match || !match[1]) {
    throw new UserFacingError("Use a PNG, JPEG, or GIF screenshot.");
  }
  const body = value.slice(comma + 1);
  if (body.length < 16 || !/^[a-z0-9+/=]+$/i.test(body)) {
    throw new UserFacingError("That image data is not valid base64.");
  }
  return `data:${match[1]};base64,${body}`;
}

export function parseCheckInput(body: unknown): CheckInput {
  const record = asRecord(body);
  if (!record) throw new UserFacingError("Send a JSON object with a kind of text, url, or image.");

  const kind = record.kind;
  if (kind === "text") {
    if (typeof record.text !== "string") throw new UserFacingError("Paste the claim text.");
    const text = record.text.trim();
    if (text.length < LIMITS.minTextChars) {
      throw new UserFacingError("Paste a little more text so there is a claim to check.");
    }
    if (text.length > LIMITS.maxTextChars) {
      throw new UserFacingError("That text is over 8,000 characters. Paste the claim, not the whole thread.");
    }
    return { kind: "text", text };
  }

  if (kind === "url") {
    if (typeof record.url !== "string") throw new UserFacingError("Paste a link to check.");
    const url = assertPublicHttpUrl(record.url);
    return { kind: "url", url: url.toString() };
  }

  if (kind === "image") {
    if (typeof record.imageDataUrl !== "string") {
      throw new UserFacingError("Attach a screenshot to check.");
    }
    const imageDataUrl = parseImageDataUrl(record.imageDataUrl);
    let note: string | undefined;
    if (typeof record.note === "string" && record.note.trim()) {
      note = record.note.trim().slice(0, LIMITS.maxNoteChars);
    }
    return note ? { kind: "image", imageDataUrl, note } : { kind: "image", imageDataUrl };
  }

  throw new UserFacingError("kind must be text, url, or image.");
}
