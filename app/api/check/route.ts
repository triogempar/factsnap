import { exaSearchType, reasoningEffort, requireEnv } from "@/lib/env";
import { publicErrorMessage } from "@/lib/errors";
import { LIMITS } from "@/lib/limits";
import { createLiveDeps } from "@/lib/live-deps";
import { runFactCheck } from "@/lib/pipeline";
import { clientIp, ipRateLimiter } from "@/lib/rate-limit";
import type { StreamEvent } from "@/lib/types";
import { parseCheckInput } from "@/lib/validate";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

export async function POST(request: Request): Promise<Response> {
  const lengthHeader = request.headers.get("content-length");
  if (lengthHeader && Number(lengthHeader) > LIMITS.maxRequestBytes) {
    return jsonError("That upload is too large. Use a smaller screenshot or paste the text.", 413);
  }

  try {
    requireEnv("FIREWORKS_API_KEY");
    requireEnv("EXA_API_KEY");
    reasoningEffort();
    exaSearchType();
  } catch (error) {
    console.error("factsnap config", error instanceof Error ? error.message : error);
    return jsonError(publicErrorMessage(error), 503);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("The request body must be JSON.", 400);
  }

  let input: ReturnType<typeof parseCheckInput>;
  try {
    input = parseCheckInput(body);
  } catch (error) {
    return jsonError(publicErrorMessage(error), 400);
  }

  const limit = ipRateLimiter.check(clientIp(request.headers));
  if (!limit.ok) {
    const minutes = Math.max(1, Math.ceil(limit.retryAfterMs / 60_000));
    return jsonError(
      `Too many checks from this network. Try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`,
      429,
    );
  }

  const deps = createLiveDeps();
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: StreamEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };
      try {
        for await (const event of runFactCheck(input, deps)) send(event);
      } catch (error) {
        console.error("factsnap check", error instanceof Error ? error.message : error);
        send({ type: "error", message: publicErrorMessage(error) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
