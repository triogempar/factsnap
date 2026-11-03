import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/check/route";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/check", () => {
  it("explains which key is missing", async () => {
    vi.stubEnv("FIREWORKS_API_KEY", "");
    vi.stubEnv("EXA_API_KEY", "");
    const response = await POST(
      new Request("http://localhost/api/check", {
        method: "POST",
        body: JSON.stringify({ kind: "text", text: "The Eiffel Tower was completed in 1889." }),
      }),
    );
    expect(response.status).toBe(503);
    const body = (await response.json()) as { error: string };
    expect(body.error).toMatch(/FIREWORKS_API_KEY/);
  });

  it("rejects a body that is not JSON once keys are present", async () => {
    vi.stubEnv("FIREWORKS_API_KEY", "test-key");
    vi.stubEnv("EXA_API_KEY", "test-key");
    const response = await POST(
      new Request("http://localhost/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not-json",
      }),
    );
    expect(response.status).toBe(400);
  });
});
