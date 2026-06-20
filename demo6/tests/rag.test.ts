import test from "node:test";
import assert from "node:assert/strict";

import { chunkMarkdown } from "../src/chunking.ts";
import { createInMemoryVectorStore } from "../src/vector-store.ts";
import { answerWithRetrievedContext, retrieveRelevantChunks } from "../src/rag.ts";
import { rerankRetrievedChunks } from "../src/reranker.ts";

const sampleMarkdown = `
# 权限管理

## 管理员

### 数据导出

管理员每次最多导出 10000 条数据。

# 账号管理

## 普通用户

### 数据导出

普通用户每次最多导出 1000 条数据。
`;

test("chunkMarkdown keeps full headingPath in metadata and chunk text", () => {
  const chunks = chunkMarkdown(sampleMarkdown, { strategy: "recursive",
    source: "system-handbook.md",
    maxLength: 120,
  });

  assert.equal(chunks.length, 2);
  assert.equal(
    chunks[0].metadata.headingPath,
    "权限管理 > 管理员 > 数据导出",
  );
  assert.match(chunks[0].text, /标题路径：权限管理 > 管理员 > 数据导出/);
  assert.equal(chunks[0].metadata.chunkIndex, 0);
  assert.equal(chunks[0].metadata.source, "system-handbook.md");
});

test("chunkMarkdown splits an overlong section by paragraphs", () => {
  const chunks = chunkMarkdown(
    `
# 导出规则

第一段说明普通用户每次最多导出 1000 条数据。

第二段说明管理员每次最多导出 10000 条数据。

第三段说明导出任务超过 5 分钟会进入后台处理。
`,
    {
      source: "export.md",
      maxLength: 60,
      strategy: "recursive",
    },
  );

  assert.ok(chunks.length >= 2);
  assert.equal(chunks[0].metadata.headingPath, "导出规则");
  assert.ok(chunks.every((chunk) => chunk.text.includes("标题路径：导出规则")));
});

test("retrieveRelevantChunks ranks vector-similar chunks above unrelated chunks", async () => {
  const chunks = chunkMarkdown(sampleMarkdown, { strategy: "recursive",
    source: "system-handbook.md",
    maxLength: 120,
  });

  const store = createInMemoryVectorStore({
    embed: async (texts) =>
      texts.map((text) => [
        text.includes("管理员") ? 1 : 0,
        text.includes("普通用户") ? 1 : 0,
        text.includes("导出") ? 1 : 0,
      ]),
  });

  await store.index(chunks);

  const results = await retrieveRelevantChunks(store, {
    query: "管理员最多能导出多少条数据？",
    topK: 2,
    minScore: 0.1,
  });

  assert.equal(results[0].chunk.metadata.headingPath, "权限管理 > 管理员 > 数据导出");
  assert.ok(results[0].score > results[1].score);
});

test("answerWithRetrievedContext refuses when no retrieved chunk crosses threshold", async () => {
  const store = createInMemoryVectorStore({
    embed: async (texts) =>
      texts.map((text) => [
        text.includes("退款") ? 1 : 0,
        text.includes("发票") ? 1 : 0,
      ]),
  });

  await store.index(
    chunkMarkdown(sampleMarkdown, { strategy: "recursive",
      source: "system-handbook.md",
      maxLength: 120,
    }),
  );

  const result = await answerWithRetrievedContext(store, {
    query: "退款需要多久到账？",
    topK: 3,
    minScore: 0.2,
  });

  assert.equal(result.hasAnswer, false);
  assert.match(result.answer, /暂未检索到相关内容/);
  assert.equal(result.qualityLog.reason, "low_relevance");
});

test("hybrid search promotes exact keyword matches for identifiers", async () => {
  const chunks = chunkMarkdown(
    `
# 登录异常

登录失败通常和 token 过期、权限失效、会话超时有关。

# 错误码

E1024：用户 token 已过期，请重新登录。
`,
    {
      source: "errors.md",
      maxLength: 120,
      strategy: "recursive",
    },
  );

  const store = createInMemoryVectorStore({
    embed: async (texts) =>
      texts.map((text) => [
        text.includes("登录") ? 1 : 0,
        text.includes("token") ? 1 : 0,
      ]),
  });

  await store.index(chunks);

  const vectorResults = await retrieveRelevantChunks(store, {
    query: "错误码 E1024 是什么意思？",
    topK: 2,
    minScore: 0,
    searchMode: "vector",
  });
  const hybridResults = await retrieveRelevantChunks(store, {
    query: "错误码 E1024 是什么意思？",
    topK: 2,
    minScore: 0,
    searchMode: "hybrid",
  });

  assert.notEqual(vectorResults[0].chunk.metadata.headingPath, "错误码");
  assert.equal(hybridResults[0].chunk.metadata.headingPath, "错误码");
  assert.ok(hybridResults[0].keywordScore > 0);
});

test("reranker reorders retrieved chunks by answer relevance", async () => {
  const chunks = chunkMarkdown(
    `
# 导出权限

管理员可以进入数据导出页面，并管理导出任务权限。

# 导出上限

管理员每次最多导出 10000 条数据。
`,
    {
      source: "export.md",
      maxLength: 120,
      strategy: "recursive",
    },
  );

  const retrieved = chunks.map((chunk, index) => ({
    chunk,
    score: index === 0 ? 0.9 : 0.8,
    vectorScore: index === 0 ? 0.9 : 0.8,
    keywordScore: 0,
  }));

  const reranked = await rerankRetrievedChunks(
    "管理员最多能导出多少条数据？",
    retrieved,
    async () => [
      { index: 1, relevanceScore: 0.98 },
      { index: 0, relevanceScore: 0.42 },
    ],
  );

  assert.equal(reranked[0].chunk.metadata.headingPath, "导出上限");
  assert.equal(reranked[0].rerankScore, 0.98);
  assert.equal(reranked[1].rerankScore, 0.42);
});

test("quality log records retrieval, filtering, reranking, and selection stages", async () => {
  const chunks = chunkMarkdown(sampleMarkdown, {
    strategy: "recursive",
    source: "system-handbook.md",
    maxLength: 120,
  });

  const store = createInMemoryVectorStore({
    embed: async (texts) =>
      texts.map((text) => [
        text.includes("管理员") ? 1 : 0,
        text.includes("普通用户") ? 1 : 0,
      ]),
  });
  await store.index(chunks);

  const result = await answerWithRetrievedContext(
    store,
    {
      query: "管理员最多能导出多少条数据？",
      topK: 2,
      minScore: 0,
      searchMode: "vector",
    },
    undefined,
    {
      provider: async () => [
        { index: 0, relevanceScore: 0.97 },
        { index: 1, relevanceScore: 0.21 },
      ],
      topN: 1,
    },
  );

  assert.equal(result.qualityLog.retrievedCandidates.length, 2);
  assert.equal(result.qualityLog.filteredCandidates.length, 2);
  assert.equal(result.qualityLog.rerankedCandidates.length, 2);
  assert.equal(result.qualityLog.selectedChunks.length, 1);
  assert.equal(result.qualityLog.selectedChunks[0].rerankScore, 0.97);
});
