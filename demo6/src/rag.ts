import type {
  CandidateLog,
  QualityLog,
  RetrievedChunk,
  SearchMode,
} from "./types.ts";
import type { VectorStore } from "./vector-store.ts";
import { rerankRetrievedChunks, type RerankProvider } from "./reranker.ts";

export async function retrieveRelevantChunks(
  store: VectorStore,
  options: {
    query: string;
    topK: number;
    minScore: number;
    searchMode?: SearchMode;
  },
): Promise<RetrievedChunk[]> {
  return store.search(options.query, {
    topK: options.topK,
    minScore: options.minScore,
    searchMode: options.searchMode,
  });
}

export function buildContext(results: RetrievedChunk[]) {
  return results
    .map((result, index) => {
      const source = result.chunk.metadata.headingPath
        ? `${result.chunk.metadata.source} / ${result.chunk.metadata.headingPath}`
        : result.chunk.metadata.source;

      return [`[${index + 1}] ${source}`, result.chunk.text].join("\n");
    })
    .join("\n\n---\n\n");
}

function createQualityLog(
  query: string,
  topK: number,
  minScore: number,
  retrievedCandidates: RetrievedChunk[],
  filteredCandidates: RetrievedChunk[],
  rerankedCandidates: RetrievedChunk[],
  selectedChunks: RetrievedChunk[],
): QualityLog {
  const hasAnswer = selectedChunks.length > 0;

  // 分阶段保存候选，方便定位 chunk 是在召回、过滤还是重排阶段丢失。
  let reason: QualityLog["reason"];
  if (hasAnswer) {
    reason = "answered";
  } else if (retrievedCandidates.length > 0) {
    reason = "low_relevance";
  } else {
    reason = "no_chunks";
  }

  const toCandidateLogs = (results: RetrievedChunk[]): CandidateLog[] =>
    results.map((result) => ({
      id: result.chunk.id,
      source: result.chunk.metadata.source,
      headingPath: result.chunk.metadata.headingPath,
      score: Number(result.score.toFixed(4)),
      vectorScore: Number(result.vectorScore.toFixed(4)),
      keywordScore: Number(result.keywordScore.toFixed(4)),
      rerankScore:
        result.rerankScore === undefined
          ? undefined
          : Number(result.rerankScore.toFixed(4)),
    }));

  const selectedLogs = toCandidateLogs(selectedChunks);

  return {
    query,
    topK,
    minScore,
    retrievedCount: selectedChunks.length,
    hasAnswer,
    reason,
    retrievedCandidates: toCandidateLogs(retrievedCandidates),
    filteredCandidates: toCandidateLogs(filteredCandidates),
    rerankedCandidates: toCandidateLogs(rerankedCandidates),
    selectedChunks: selectedLogs,
    matchedChunks: selectedLogs,
  };
}

export async function answerWithRetrievedContext(
  store: VectorStore,
  options: {
    query: string;
    topK: number;
    minScore: number;
    searchMode?: SearchMode;
  },
  generateAnswer?: (context: string, query: string) => Promise<string>,
  rerank?: {
    provider: RerankProvider;
    topN: number;
  },
) {
  // RAG 检索 Pipeline：
  //   Stage 1 — 召回：取全部 topK 候选（minScore=-1，不截断），用于 QualityLog 分析
  //   Stage 2 — 粗筛：按 minScore 过滤，移除明显不相关的 chunk
  //   Stage 3 — 重排（可选）：BGE Reranker 联合 query + chunk 文本重新打分，保留 topN
  //   Stage 4 — 组装：buildContext 拼接最终进入 prompt 的上下文
  //
  // 为什么 rerank 在 minScore 过滤之后？
  //   低于 minScore 的 chunk 语义距离太远，即使 reranker 也救不回来，
  //   提前过滤可以减少 rerank API 的 token 消耗和延迟。
  //
  // 为什么先粗筛再重排而不是反过来？
  //   召回阶段追求高召回（宁可多捞），重排阶段追求高精度（精准截断）。
  //   topK 设置大一些（如 10-20），rerank 后再保留 topN（如 3-5），
  //   这是生产环境 RAG 的最常见模式。

  const allRetrieved = await retrieveRelevantChunks(store, {
    ...options,
    minScore: -1,
  });

  const filteredResults = allRetrieved.filter((r) => r.score >= options.minScore);
  const rerankedResults = rerank
    ? await rerankRetrievedChunks(
        options.query,
        filteredResults,
        rerank.provider,
        filteredResults.length,
      )
    : [];
  const results = rerank
    ? rerankedResults.slice(0, rerank.topN)
    : filteredResults;
  const hasAnswer = results.length > 0;
  const context = buildContext(results);
  const qualityLog = createQualityLog(
    options.query,
    options.topK,
    options.minScore,
    allRetrieved,
    filteredResults,
    rerankedResults,
    results,
  );

  if (!hasAnswer) {
    return {
      answer: "暂未检索到相关内容。",
      context,
      retrievedChunks: results,
      hasAnswer,
      qualityLog,
    };
  }

  const answer = generateAnswer
    ? await generateAnswer(context, options.query)
    : `基于检索到的 ${results.length} 个片段：\n\n${context}`;

  return {
    answer,
    context,
    retrievedChunks: results,
    hasAnswer,
    qualityLog,
  };
}
