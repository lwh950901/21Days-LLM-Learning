import { describe, expect, it } from "vitest";
import { getGenerationStatusLabel, isGenerating } from "../lib/state/generation-status";

describe("generation status helpers", () => {
  it("identifies only generating as an active generation state", () => {
    expect(isGenerating("generating")).toBe(true);
    expect(isGenerating("done")).toBe(false);
    expect(isGenerating("stopped")).toBe(false);
    expect(isGenerating("error")).toBe(false);
  });

  it("returns user-facing labels for all module 1 states", () => {
    expect(getGenerationStatusLabel("idle")).toBe("待输入");
    expect(getGenerationStatusLabel("generating")).toBe("生成中");
    expect(getGenerationStatusLabel("done")).toBe("已完成");
    expect(getGenerationStatusLabel("stopped")).toBe("已停止");
    expect(getGenerationStatusLabel("error")).toBe("出错");
  });
});
