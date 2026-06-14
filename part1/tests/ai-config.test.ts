import { describe, expect, it } from "vitest";
import { getModel } from "../lib/ai/model";

describe("model profile configuration", () => {
  it("returns language model instances for fast and quality profiles", () => {
    expect(getModel("fast")).toBeDefined();
    expect(getModel("quality")).toBeDefined();
    expect(getModel("fast").modelId).toBe("gpt-4o-mini");
    expect(getModel("quality").modelId).toBe("gpt-4o");
  });

  it("returns the same cached instance on repeated calls", () => {
    expect(getModel("fast")).toBe(getModel("fast"));
    expect(getModel("quality")).toBe(getModel("quality"));
  });

  it("falls back to the fast profile for unknown profile names", () => {
    expect(getModel("unknown")).toBe(getModel("fast"));
    expect(getModel()).toBe(getModel("fast"));
  });
});
