import { describe, expect, it } from "vitest";
import { credibilityScore, scoreLabel } from "@/lib/score";
import { createRateLimiter } from "@/lib/rate-limit";
import { parseCheckInput } from "@/lib/validate";
import { assertPublicHttpUrl } from "@/lib/url-safety";

describe("credibilityScore", () => {
  it("averages verdicts and subtracts red flags", () => {
    expect(credibilityScore(["Supported"], 0)).toBe(92);
    expect(credibilityScore(["False", "False"], 2)).toBe(0);
    expect(credibilityScore(["Supported", "False"], 0)).toBe(50);
    expect(scoreLabel(92)).toBe("Mostly credible");
    expect(scoreLabel(0)).toBe("Not credible");
  });
});

describe("rate limit", () => {
  it("blocks the next check inside the window and allows it after", () => {
    let now = 1_000;
    const limiter = createRateLimiter({ now: () => now, max: 2, windowMs: 10_000 });
    expect(limiter.check("1.1.1.1").ok).toBe(true);
    expect(limiter.check("1.1.1.1").ok).toBe(true);
    const blocked = limiter.check("1.1.1.1");
    expect(blocked.ok).toBe(false);
    expect(limiter.check("2.2.2.2").ok).toBe(true);
    now += 10_001;
    expect(limiter.check("1.1.1.1").ok).toBe(true);
  });
});

describe("parseCheckInput", () => {
  it("accepts text and rejects a short paste", () => {
    expect(parseCheckInput({ kind: "text", text: "  The tower was built in 1889 for the fair.  " })).toEqual({
      kind: "text",
      text: "The tower was built in 1889 for the fair.",
    });
    expect(() => parseCheckInput({ kind: "text", text: "too short" })).toThrow(/little more text/);
  });

  it("rejects private and non-http links", () => {
    expect(() => assertPublicHttpUrl("http://127.0.0.1/admin")).toThrow(/private/);
    expect(() => assertPublicHttpUrl("http://169.254.169.254/latest")).toThrow(/private/);
    expect(() => assertPublicHttpUrl("http://192.168.0.8/x")).toThrow(/private/);
    expect(() => assertPublicHttpUrl("file:///etc/passwd")).toThrow(/http/);
    expect(() => assertPublicHttpUrl("https://user:pass@example.com/a")).toThrow(/password/);
    expect(assertPublicHttpUrl("https://www.snopes.com/fact-check/5g-tower-torn-down-china-covid/").hostname).toBe(
      "www.snopes.com",
    );
  });

  it("accepts a small jpeg data url and rejects webp", () => {
    const jpeg = `data:image/jpeg;base64,${"aGVsbG8=".repeat(2)}`;
    expect(parseCheckInput({ kind: "image", imageDataUrl: jpeg, note: "  caption  " })).toMatchObject({
      kind: "image",
      note: "caption",
    });
    expect(() => parseCheckInput({ kind: "image", imageDataUrl: "data:image/webp;base64,aaaa" })).toThrow(/PNG, JPEG/);
  });
});
