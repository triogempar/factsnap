import { describe, expect, it } from "vitest";
import { SAMPLE_REPLAY } from "@/lib/samples";
import { applyEvent, emptyView } from "@/lib/view";

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
    expect(view.shareText).toContain("turnbackhoax.id");
  });
});
