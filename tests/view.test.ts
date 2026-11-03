import { describe, expect, it } from "vitest";
import { SAMPLE_REPLAY } from "@/lib/samples";
import { applyEvent, emptyView, scoreRingState, type CheckView } from "@/lib/view";

describe("check view", () => {
  it("plays the sample replay into a finished Indonesian result", () => {
    let view = emptyView;
    for (const event of SAMPLE_REPLAY) view = applyEvent(view, event, true);
    expect(view.phase).toBe("done");
    expect(view.preview).toBe(true);
    expect(view.language).toBe("Indonesian");
    expect(view.claims).toHaveLength(2);
    expect(view.claims.every((claim) => claim.verdict === "False")).toBe(true);
    expect(view.score).toBe(0);
    expect(scoreRingState(view)).toBe("final");
    expect(view.shareText).toContain("turnbackhoax.id");
  });

  it("keeps the score ring pending until the final result arrives", () => {
    let view: CheckView = { ...emptyView, phase: "running", status: "Playing a sample result…" };
    expect(scoreRingState(view)).toBe("pending");

    for (const event of SAMPLE_REPLAY) {
      view = applyEvent(view, event, true);
      if (event.type !== "done") {
        expect(view.score).toBeNull();
        expect(scoreRingState(view)).toBe("pending");
      }
      if (event.type === "status" && event.message === "Judging claim 2…") {
        expect(view.claims[0]?.verdict).toBe("False");
        expect(view.claims[1]?.verdict).toBeUndefined();
      }
    }

    expect(view.status).toBe("Check complete");
    expect(view.score).toBe(0);
    expect(scoreRingState(view)).toBe("final");
    expect(scoreRingState({ ...view, phase: "running", score: 0 })).toBe("pending");
    expect(scoreRingState({ ...emptyView, phase: "error", score: 0 })).toBe("hidden");
  });
});
