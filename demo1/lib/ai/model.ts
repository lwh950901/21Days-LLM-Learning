import { createOpenAI } from "@ai-sdk/openai";

let _fastModel: ReturnType<ReturnType<typeof createOpenAI>["chat"]> | null = null;
let _qualityModel: ReturnType<ReturnType<typeof createOpenAI>["chat"]> | null = null;

function getOpenAI() {
  return createOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
  });
}

function getFastModel() {
  if (!_fastModel) {
    const id = process.env.AI_MODEL_FAST ?? "gpt-4o-mini";
    console.log("Initializing fast model:", id, "baseURL:", process.env.OPENAI_BASE_URL);
    _fastModel = getOpenAI().chat(id);
  }
  return _fastModel;
}

function getQualityModel() {
  if (!_qualityModel) {
    const id = process.env.AI_MODEL_QUALITY ?? "gpt-4o";
    console.log("Initializing quality model:", id);
    _qualityModel = getOpenAI().chat(id);
  }
  return _qualityModel;
}

export type ModelProfile = "fast" | "quality";

export function getModel(profile?: string) {
  if (profile === "quality") {
    return getQualityModel();
  }
  return getFastModel();
}
