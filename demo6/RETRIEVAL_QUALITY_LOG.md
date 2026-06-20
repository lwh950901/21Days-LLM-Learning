# Retrieval Quality Log

The demo records a quality log for every query:

```ts
type QualityLog = {
  query: string;
  topK: number;
  minScore: number;
  retrievedCount: number;
  hasAnswer: boolean;
  reason: "answered" | "no_chunks" | "low_relevance";
  retrievedCandidates: CandidateLog[];
  filteredCandidates: CandidateLog[];
  rerankedCandidates: CandidateLog[];
  selectedChunks: CandidateLog[];
};
```

## Pipeline Stages

- `retrievedCandidates`: all initial topK candidates.
- `filteredCandidates`: candidates remaining after minScore filtering.
- `rerankedCandidates`: all filtered candidates ordered by rerankScore.
- `selectedChunks`: final topN chunks used to build context.

This makes it possible to identify exactly where the correct chunk disappeared.

## Why This Matters

RAG failures often look like model failures, but the real cause is usually retrieval:

- chunk too large: relevant answer is buried in noisy text.
- chunk too small: retrieved evidence is incomplete.
- topK too small: misses needed evidence.
- topK too large: context pollution.
- threshold too low: irrelevant chunks enter the prompt.
- threshold too high: valid evidence is filtered out.
- keywordScore high but vectorScore low: exact identifiers may need Hybrid Search.

## Interview Answer

> I would not debug a RAG system only by reading the final answer. I would log the query, topK, retrieval scores, matched chunk ids, source documents, headingPath, and whether the answer was supported by evidence. That lets me decide whether the issue is chunking, embedding, search parameters, or generation.
>
> A good RAG system should make retrieval visible enough that we can explain why an answer was produced or why the system refused.
