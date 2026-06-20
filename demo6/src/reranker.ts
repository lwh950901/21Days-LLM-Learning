import type { RetrievedChunk } from "./types.ts";

const RERANK_MODEL = "BAAI/bge-reranker-v2-m3";
const DEFAULT_BASE_URL = "https://api.siliconflow.cn/v1";

export type RerankScore = {
  index: number;
  relevanceScore: number;
};

export type RerankProvider = (
  query: string,
  documents: string[],
  topN: number,
) => Promise<RerankScore[]>;

export async function rerankRetrievedChunks(
  query: string,
  results: RetrievedChunk[],
  rerank: RerankProvider,
  topN = results.length,
): Promise<RetrievedChunk[]> {
  if (results.length === 0) return [];

  const scores = await rerank(
    query,
    results.map((result) => result.chunk.text),
    Math.min(topN, results.length),
  );

  const reranked: RetrievedChunk[] = [];

  for (const item of scores) {
    const result = results[item.index];
    if (!result) continue;
    reranked.push({ ...result, rerankScore: item.relevanceScore });
  }

  return reranked.sort(
    (a, b) => (b.rerankScore ?? 0) - (a.rerankScore ?? 0),
  );
}

export function createSiliconFlowReranker(options: {
  apiKey?: string;
  baseUrl?: string;
} = {}): RerankProvider {
  const apiKey = options.apiKey ?? process.env.SILICONFLOW_API_KEY;
  const baseUrl =
    options.baseUrl ?? process.env.SILICONFLOW_BASE_URL ?? DEFAULT_BASE_URL;

  return async (query, documents, topN) => {
    if (!apiKey) {
      throw new Error("Missing SILICONFLOW_API_KEY for rerank API calls.");
    }

    const response = await fetch(`${baseUrl}/rerank`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: RERANK_MODEL,
        query,
        documents,
        top_n: topN,
        return_documents: false,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Rerank API failed: ${response.status} ${await response.text()}`,
      );
    }

    const payload = (await response.json()) as {
      results: Array<{ index: number; relevance_score: number }>;
    };

    return payload.results.map((result) => ({
      index: result.index,
      relevanceScore: result.relevance_score,
    }));
  };
}
