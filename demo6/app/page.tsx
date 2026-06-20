"use client";

import { useState } from "react";

import { sampleMarkdown } from "../src/sample-doc.ts";
import type {
  Chunk,
  ChunkingStrategy,
  QualityLog,
  RetrievedChunk,
  SearchMode,
} from "../src/types.ts";

type RagResult = {
  chunks: Chunk[];
  retrievedChunks: RetrievedChunk[];
  context: string;
  answer: string;
  hasAnswer: boolean;
  qualityLog: QualityLog;
  embeddingMode: string;
  answerMode?: string;
  searchMode?: SearchMode;
  rerankMode?: string;
};

// ── Learning notes ──

const LEARNING_NOTES: Record<string, { concept: string; interview: string }> = {
  chunking: {
    concept:
      "三种策略：fixed（固定长度切分，简单粗暴）、structured（按标题层级切分，保留结构信息）、recursive（结构化 + 段落递归，平衡 chunk 大小和语义完整性）。",
    interview:
      "chunk 大小影响召回：太大噪声多，太小语义碎片化。递归切分兼顾标题结构和语义边界，是我在生产环境的首选。",
  },
  embedding: {
    concept:
      "将文本映射为语义向量。SiliconFlow BGE-M3（远程 API，效果最好）或本地关键词哈希（不依赖网络，适合测试）。嵌入结果缓存到磁盘，重复文本不重复调用 API。",
    interview:
      "选 embedding 模型要看语义匹配能力和成本。BGE-M3 是开源模型中效果较好的，通过 SiliconFlow API 接入，按量计费。",
  },
  retrieval: {
    concept:
      "余弦相似度计算 query 向量与每个 chunk 向量的距离，topK 控制召回数量，minScore 过滤低相关度的 chunk。",
    interview:
      "topK 太大会引入噪声，太小会漏答。minScore 是质量防线——低于阈值的 chunk 即使被召回也不参与回答。",
  },
  qualityLog: {
    concept:
      "每次查询记录 QualityLog：命中数、是否有答案、失败原因（answered / low_relevance / no_chunks）、每个 chunk 的匹配分数。",
    interview:
      "QualityLog 是 RAG 可观测性的基础。没有它，你根本不知道用户提问时系统有没有正确召回。这是面试的加分项。",
  },
  llmAnswer: {
    concept:
      "开启 DeepSeek LLM 回答后，检索到的 chunk 作为上下文喂给 LLM，LLM 基于上下文生成最终答案。不开启时仅返回模板拼接。",
    interview:
      "RAG 的最后一步是让 LLM 基于检索结果生成答案。关键是限制 LLM 只根据上下文回答，不编造。prompt 里要明确'找不到就说找不到'。",
  },
  rerank: {
    concept:
      "先用向量或 Hybrid Search 召回 topK 候选，再由 BGE Reranker 同时读取 query 和每个 chunk，按答案相关性重新排序并保留 topN。",
    interview:
      "召回阶段追求不漏，Rerank 阶段追求精准。我用 BAAI/bge-reranker-v2-m3 将 query 和候选 chunk 联合打分，再压缩进入 prompt 的上下文。",
  },
};

function getLearningNote(label: string) {
  return LEARNING_NOTES[label] ?? null;
}

// ── Components ──

function JsonBlock({ value }: { value: unknown }) {
  return <pre>{JSON.stringify(value, null, 2)}</pre>;
}

function ChunkList({ chunks }: { chunks: Chunk[] }) {
  if (chunks.length === 0) {
    return <p className="empty">运行检索以查看生成的 chunk。</p>;
  }

  return (
    <div className="chunk-list">
      {chunks.map((chunk) => (
        <article className="chunk" key={chunk.id}>
          <header>
            <strong>{chunk.id}</strong>
            <span>{chunk.metadata.headingPath ?? "无标题路径"}</span>
            <span className="chunk-strategy">{chunk.metadata.strategy}</span>
          </header>
          <p>{chunk.text}</p>
        </article>
      ))}
    </div>
  );
}

function RetrievalList({ results }: { results: RetrievedChunk[] }) {
  if (results.length === 0) {
    return <p className="empty">没有 chunk 通过 minScore 阈值。</p>;
  }

  return (
    <div className="retrieval-list">
      {results.map((result, index) => (
        <article className="hit" key={result.chunk.id}>
          <div className="hit-score">
            <span>#{index + 1}</span>
            <strong>{result.score.toFixed(4)}</strong>
          </div>
          <div>
            <h3>{result.chunk.metadata.headingPath}</h3>
            <p className="score-line">
              final {result.score.toFixed(4)} · vector{" "}
              {result.vectorScore.toFixed(4)} · keyword{" "}
              {result.keywordScore.toFixed(4)}
              {result.rerankScore === undefined
                ? ""
                : ` · rerank ${result.rerankScore.toFixed(4)}`}
            </p>
            <p>{result.chunk.text}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

function LearningPanel({ step }: { step: string }) {
  const note = getLearningNote(step);
  if (!note) return null;

  return (
    <section className="panel learning-panel">
      <h2>Learning context</h2>
      <div>
        <h4>📖 {step === "qualityLog" ? "Quality Log" : step === "rerank" ? "Rerank 重排" : step === "llmAnswer" ? "LLM 回答" : step === "embedding" ? "Embedding" : step === "retrieval" ? "检索" : "Chunking"}</h4>
        <p>{note.concept}</p>
      </div>
      <div>
        <h4>💬 面试表达</h4>
        <p>{note.interview}</p>
      </div>
    </section>
  );
}

// ── Page ──

export default function Page() {
  const [markdown, setMarkdown] = useState(sampleMarkdown);
  const [query, setQuery] = useState("管理员最多能导出多少条数据？");
  const [source, setSource] = useState("system-handbook.md");
  const [maxLength, setMaxLength] = useState(160);
  const [topK, setTopK] = useState(3);
  const [minScore, setMinScore] = useState(0.1);
  const [useRealEmbeddings, setUseRealEmbeddings] = useState(false);
  const [useLlmAnswer, setUseLlmAnswer] = useState(false);
  const [chunkingStrategy, setChunkingStrategy] = useState<ChunkingStrategy>("recursive");
  const [searchMode, setSearchMode] = useState<SearchMode>("vector");
  const [useReranker, setUseReranker] = useState(false);
  const [rerankTopN, setRerankTopN] = useState(3);
  const [result, setResult] = useState<RagResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState("");
  const [activeStep, setActiveStep] = useState("");

  async function runDemo() {
    setError("");
    setIsRunning(true);
    setActiveStep("chunking");

    const response = await fetch("/api/rag", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        markdown,
        query,
        source,
        maxLength,
        topK,
        minScore,
        useRealEmbeddings,
        useLlmAnswer,
        chunkingStrategy,
        searchMode,
        useReranker,
        rerankTopN,
      }),
    });

    const payload = await response.json();
    setIsRunning(false);

    if (!response.ok) {
      setError(payload.message ?? "RAG 执行失败。");
      return;
    }

    setResult(payload);
    setActiveStep("");
  }

  const resultSteps = result
    ? [
        "chunking",
        "embedding",
        "retrieval",
        ...(result.rerankMode !== "off" ? ["rerank"] : []),
        result.answerMode === "deepseek-llm" ? "llmAnswer" : "qualityLog",
      ]
    : [];

  return (
    <main className="shell">
      {/* ── Hero ── */}
      <section className="hero">
        <div>
          <p className="eyebrow">Module 5 / RAG Engineering</p>
          <h1>RAG 工程控制台</h1>
          <p className="lead">
            切分、嵌入、检索、质量评估。从 Markdown 到可召回 chunk，观察每一步如何影响最终答案。
          </p>
        </div>
        <div className="status-ribbon">
          <span>Embedding 模式</span>
          <strong>{result?.embeddingMode ?? "local-keyword"}</strong>
          <span style={{ marginTop: 4 }}>回答模式</span>
          <strong>{result?.answerMode ?? "pending"}</strong>
          <span style={{ marginTop: 4 }}>检索模式</span>
          <strong>{result?.searchMode ?? searchMode}</strong>
          <span style={{ marginTop: 4 }}>Rerank</span>
          <strong>{result?.rerankMode ?? "off"}</strong>
        </div>
      </section>

      {/* ── Learning strip ── */}
      <div className="learning-strip">
        <div className={activeStep === "chunking" ? "highlight" : ""}>
          <span>Chunking</span>
          <strong>{chunkingStrategy === "fixed" ? "固定长度切分" : chunkingStrategy === "structured" ? "标题层级切分" : "标题 + 段落递归切分"}</strong>
        </div>
        <div className={activeStep === "embedding" ? "highlight" : ""}>
          <span>Retrieval</span>
          <strong>topK={topK} + minScore={minScore}</strong>
        </div>
        <div className={activeStep === "qualityLog" ? "highlight" : ""}>
          <span>Quality log</span>
          <strong>记录命中与失败原因</strong>
        </div>
      </div>

      {/* ── Workbench ── */}
      <section className="workbench">
        <aside className="control-panel">
          <label htmlFor="source">文档名称</label>
          <input
            id="source"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          />

          <label htmlFor="markdown">Markdown 文档</label>
          <textarea
            id="markdown"
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
          />

          <label htmlFor="query">提问</label>
          <input
            id="query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          <label>Chunking 策略</label>
          <div className="strategy-group">
            {(["fixed", "structured", "recursive"] as ChunkingStrategy[]).map((s) => (
              <label key={s} className="radio-label">
                <input
                  type="radio"
                  name="strategy"
                  value={s}
                  checked={chunkingStrategy === s}
                  onChange={() => setChunkingStrategy(s)}
                />
                {s === "fixed" ? "固定长度" : s === "structured" ? "标题层级" : "递归切分"}
              </label>
            ))}
          </div>

          <label>检索模式</label>
          <div className="strategy-group">
            {(["vector", "keyword", "hybrid"] as SearchMode[]).map((mode) => (
              <label key={mode} className="radio-label">
                <input
                  type="radio"
                  name="searchMode"
                  value={mode}
                  checked={searchMode === mode}
                  onChange={() => setSearchMode(mode)}
                />
                {mode === "vector"
                  ? "向量"
                  : mode === "keyword"
                    ? "关键词"
                    : "Hybrid"}
              </label>
            ))}
          </div>

          <div className="form-grid">
            <label>
              Max length
              <input
                type="number"
                min={40}
                value={maxLength}
                onChange={(e) => setMaxLength(Number(e.target.value))}
              />
            </label>
            <label>
              topK
              <input
                type="number"
                min={1}
                max={10}
                value={topK}
                onChange={(e) => setTopK(Number(e.target.value))}
              />
            </label>
            <label>
              Min score
              <input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value))}
              />
            </label>
          </div>

          <label className="toggle">
            <input
              type="checkbox"
              checked={useRealEmbeddings}
              onChange={(e) => setUseRealEmbeddings(e.target.checked)}
            />
            使用 SiliconFlow BGE-M3 嵌入（需配置 SILICONFLOW_API_KEY）
          </label>

          <label className="toggle">
            <input
              type="checkbox"
              checked={useLlmAnswer}
              onChange={(e) => setUseLlmAnswer(e.target.checked)}
            />
            使用 DeepSeek LLM 生成答案（需配置 OPENAI_API_KEY）
          </label>

          <label className="toggle">
            <input
              type="checkbox"
              checked={useReranker}
              onChange={(e) => setUseReranker(e.target.checked)}
            />
            使用 SiliconFlow BGE Reranker（需配置 SILICONFLOW_API_KEY）
          </label>

          {useReranker && (
            <label>
              Rerank topN
              <input
                type="number"
                min={1}
                max={topK}
                value={rerankTopN}
                onChange={(e) => setRerankTopN(Number(e.target.value))}
              />
            </label>
          )}

          <button onClick={runDemo} disabled={isRunning}>
            {isRunning ? "执行中..." : "运行 RAG 检索"}
          </button>

          {error && <p className="error">{error}</p>}
        </aside>

        <section className="main-panel">
          <div className="output-grid">
            <section className="panel">
              <h2>Chunks ({result?.chunks.length ?? 0})</h2>
              <ChunkList chunks={result?.chunks ?? []} />
            </section>

            <section className="panel">
              <h2>检索命中 ({result?.retrievedChunks.length ?? 0})</h2>
              <RetrievalList results={result?.retrievedChunks ?? []} />
            </section>

            <section className="panel">
              <h2>答案</h2>
              <pre>{result?.answer ?? "运行 RAG 检索以生成答案。"}</pre>
            </section>

            <LearningPanel step={activeStep || (result ? resultSteps[resultSteps.length - 1] : "")} />
          </div>

          {result && (
            <section className="panel quality-panel">
              <h2>Quality log</h2>
              <JsonBlock value={result.qualityLog} />
            </section>
          )}
        </section>
      </section>
    </main>
  );
}
