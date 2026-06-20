import { NextResponse } from "next/server";

import { runRagDemo } from "../../../src/rag-demo.ts";
import { sampleMarkdown } from "../../../src/sample-doc.ts";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const result = await runRagDemo({
      markdown: String(body.markdown || sampleMarkdown),
      query: String(body.query || "管理员最多能导出多少条数据？"),
      source: String(body.source || "system-handbook.md"),
      maxLength: Number(body.maxLength || 160),
      topK: Number(body.topK || 3),
      minScore: Number(body.minScore ?? 0.1),
      useRealEmbeddings: Boolean(body.useRealEmbeddings),
      useLlmAnswer: Boolean(body.useLlmAnswer),
      chunkingStrategy: (["fixed", "structured", "recursive"].includes(body.chunkingStrategy)
        ? body.chunkingStrategy
        : "recursive") as "fixed" | "structured" | "recursive",
      searchMode: (["vector", "keyword", "hybrid"].includes(body.searchMode)
        ? body.searchMode
        : "vector") as "vector" | "keyword" | "hybrid",
      useReranker: Boolean(body.useReranker),
      rerankTopN: Math.max(1, Number(body.rerankTopN || 3)),
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "RAG demo failed.",
      },
      { status: 500 },
    );
  }
}
