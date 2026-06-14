export type GenerationStatus = "idle" | "generating" | "done" | "stopped" | "error";

export function isGenerating(status: GenerationStatus) {
  return status === "generating";
}

export function getGenerationStatusLabel(status: GenerationStatus) {
  const labels: Record<GenerationStatus, string> = {
    idle: "待输入",
    generating: "生成中",
    done: "已完成",
    stopped: "已停止",
    error: "出错",
  };

  return labels[status];
}
