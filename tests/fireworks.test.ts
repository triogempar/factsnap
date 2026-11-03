import { afterEach, describe, expect, it, vi } from "vitest";
import { createFireworksCompleter } from "@/lib/fireworks";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("Fireworks client", () => {
  it("posts to the OpenAI-compatible endpoint with DeepSeek V4.1 Flash", async () => {
    vi.stubEnv("FIREWORKS_API_KEY", "test-key");
    vi.stubEnv("FIREWORKS_MODEL", "");
    vi.stubEnv("FIREWORKS_REASONING_EFFORT", "");
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      Response.json({ choices: [{ message: { content: '{"ok":true}' } }] }),
    );
    const complete = createFireworksCompleter(fetchImpl);
    const text = await complete(
      [
        {
          role: "user",
          content: [
            { type: "text", text: "Read this screenshot." },
            { type: "image_url", image_url: { url: "data:image/jpeg;base64,aGVsbG8=" } },
          ],
        },
      ],
      200,
    );

    expect(text).toBe('{"ok":true}');
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe("https://api.fireworks.ai/inference/v1/chat/completions");
    expect(init?.headers).toMatchObject({ Authorization: "Bearer test-key" });
    const body = JSON.parse(String(init?.body));
    expect(body.model).toBe("accounts/fireworks/models/deepseek-v4p1-flash");
    expect(body.reasoning_effort).toBe("none");
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.messages[0].content[1]).toEqual({
      type: "image_url",
      image_url: { url: "data:image/jpeg;base64,aGVsbG8=" },
    });
  });

  it("names a missing key instead of calling the API", () => {
    vi.stubEnv("FIREWORKS_API_KEY", "");
    expect(() => createFireworksCompleter()).toThrow(/FIREWORKS_API_KEY/);
  });
});
