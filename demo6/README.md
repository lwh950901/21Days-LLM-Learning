# Module 5 Demo 1: RAG Engineering Workbench

This demo shows a complete first RAG chain without forcing every run to spend API quota:

```text
Markdown document
-> recursive chunking
-> embedding
-> in-memory vector search
-> context construction
-> answer or refusal
-> retrieval quality log
```

By default the page uses a local keyword-style embedder so the demo is free to run. If `SILICONFLOW_API_KEY` is configured, the page can call SiliconFlow `BAAI/bge-m3` embeddings.

## Run

```bash
cp .env.example .env.local
npm run dev
```

Then open `http://localhost:3000`.

## Test

```bash
npm run test:rag
npm run typecheck
npm run build
```

## What This Demo Shows

- `Chunking`: Markdown is split by heading path first, then long sections are split by paragraph and sentence.
- `headingPath`: the title path, such as `权限管理 > 管理员 > 数据导出`, is stored in metadata and also copied into chunk text.
- `Embedding`: local embeddings are used by default; SiliconFlow BGE-M3 can be enabled from the UI.
- `Vector search`: chunks and query are embedded, then ranked by cosine similarity.
- `Hybrid search`: vector score and keyword score can be combined for queries with exact identifiers.
- `Rerank`: optional SiliconFlow `BAAI/bge-reranker-v2-m3` reorders topK candidates and keeps topN.
- `topK`: controls how many candidate chunks are returned.
- `minScore`: prevents low-relevance chunks from entering the context.
- `No-answer handling`: if no chunk crosses the threshold, the system refuses instead of inventing an answer.
- `Quality log`: every run records query, topK, minScore, matched chunks, scores, and answer status.

## Key Files

- `src/chunking.ts`: recursive Markdown chunking.
- `src/embeddings.ts`: SiliconFlow embedding client with file cache.
- `src/local-embedding.ts`: free local embedding fallback for learning.
- `src/vector-store.ts`: in-memory vector, keyword, and hybrid scoring.
- `src/rag.ts`: retrieval, context construction, refusal, and quality log.
- `src/reranker.ts`: SiliconFlow rerank API client and result-to-chunk mapping.
- `src/rag-demo.ts`: demo orchestration.
- `app/api/rag/route.ts`: Next API route for running the chain.
- `app/page.tsx`: visual RAG workbench.
- `tests/rag.test.ts`: chunking, retrieval, and refusal tests.

## Interview Expression

> I treat RAG as an evidence pipeline, not just a model prompt. First I chunk documents into retrievable units, preserving metadata such as source, headingPath, and chunkIndex. Then I embed chunks, retrieve topK candidates by similarity, filter weak matches with a threshold, build a compact context, and ask the model to answer only from that context.
>
> The important engineering points are chunk quality, retrieval quality, and no-answer behavior. I also consider Hybrid Search when the query contains exact identifiers such as error codes, order ids, API names, or contract clauses. If the retrieved chunks are irrelevant or below threshold, the system should refuse instead of letting the model guess.

## Quota Note

The UI defaults to local embeddings. Enable SiliconFlow only when you want to compare real embedding behavior. Embeddings are cached under `.cache/embeddings`, so repeated identical texts do not call the API again.
