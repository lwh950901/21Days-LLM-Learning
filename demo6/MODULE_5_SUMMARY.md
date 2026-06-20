# Module 5 Summary: RAG Engineering

## 1. RAG Is an Evidence Pipeline

RAG does not put the entire knowledge base into a prompt. It retrieves a small set of useful evidence before asking the LLM to answer.

```text
Offline indexing:
document -> parse -> chunk -> embed -> store

Online retrieval:
query -> retrieve -> filter -> rerank -> context -> answer or refuse
```

The main engineering goal is not merely to return an answer. It is to make the evidence pipeline accurate, compact, debuggable, and maintainable.

## 2. Chunking

- Fixed chunking is a fallback for text without reliable structure.
- Structured chunking follows headings, paragraphs, lists, FAQ groups, or timestamps.
- Recursive chunking uses natural boundaries first and a length limit as the final fallback.
- A chunk that is too large wastes context and mixes topics.
- A chunk that is too small breaks evidence and reduces retrieval quality.
- `headingPath` means the full title path, such as `Permissions > Admin > Export`. It belongs in metadata for filtering and debugging, and may also be copied into chunk text so embedding and the LLM can see it.

Chunk size and overlap are tuning parameters, not universal constants. They should be checked against real documents and queries.

## 3. Embedding and Vector Stores

Embedding converts chunks and queries into vectors for semantic similarity search. Documents and queries must use compatible embedding models and vector dimensions.

Vector store choices in this module:

- In-memory store or Chroma: suitable for learning and small demos.
- pgvector: suitable when PostgreSQL is already part of the application and its scale, filtering, concurrency, and latency meet requirements.
- Pinecone: suitable when the team needs managed vector infrastructure and scalable retrieval operations.

The vector database does not automatically own document parsing, chunk lifecycle, permission design, or answer generation. The application still manages those responsibilities.

## 4. Incremental Indexing

Useful identifiers and metadata include:

- `documentId`: identifies the source document.
- `chunkId`: identifies one retrievable unit.
- `contentHash`: detects whether chunk content changed.
- `source`: records where the chunk came from.
- `headingPath`: preserves structural context.
- `chunkIndex`: records the chunk position.
- `status`, `version`, and effective time: prevent obsolete evidence from being used.

On document updates, unchanged chunks reuse existing vectors. Modified and new chunks require embedding, while deleted chunks must be removed. `contentHash` detects changes but cannot replace an embedding vector.

## 5. Retrieval and Hybrid Search

Vector search is strong for semantic paraphrases. Keyword search is strong for exact identifiers such as error codes, API names, model numbers, and contract clauses. Hybrid Search combines both signals.

A weighted formula such as the following is only a starting point:

```text
finalScore = vectorScore * vectorWeight + keywordScore * keywordWeight
```

Weights may be adjusted based on query type, but retrieval quality must be checked with real examples rather than assumed from one formula.

## 6. topK, minScore, Rerank, and topN

- `topK`: initial candidate count.
- `minScore`: removes candidates below a relevance threshold.
- Rerank input limit: controls how many retrieved candidates the reranker can inspect.
- `topN`: final count kept after reranking.

Rerank can reorder existing candidates but cannot recover a chunk that never entered its input. Increasing `topN` cannot fix an overly small rerank input limit.

## 7. Context Construction and No-Answer Handling

The final context should contain compact, complementary, active evidence. Before building messages:

- remove duplicate or near-duplicate chunks;
- exclude obsolete versions;
- resolve evidence by version, effective time, status, and source authority;
- preserve source metadata;
- keep within a token budget;
- refuse when evidence is missing or unresolved conflicts remain.

Similarity measures relevance, not truth, freshness, or authority.

## 8. Retrieval Quality Log

This demo records four stages:

```text
retrievedCandidates
-> filteredCandidates
-> rerankedCandidates
-> selectedChunks
```

The stages locate different failures:

- Missing from initial candidates: indexing, chunking, embedding, query, search mode, metadata filter, or topK problem.
- Removed during filtering: minScore may be too high.
- Ranked poorly: reranker or candidate evidence may be weak.
- Ranked well but not selected: topN may be too small.

Tune one variable at a time and compare the log. Otherwise it is difficult to know why a result changed.

## 9. Demo Implementation

This project includes:

- recursive Markdown chunking with `headingPath`;
- local embeddings and optional SiliconFlow BGE-M3 embeddings;
- in-memory vector, keyword, and hybrid retrieval;
- optional SiliconFlow `BAAI/bge-reranker-v2-m3` reranking;
- `topK`, `minScore`, rerank input, and `topN` controls;
- grounded answer generation and no-answer handling;
- a four-stage retrieval quality log;
- automated tests for the main retrieval behavior.

## 10. Project Expression

> I built a complete RAG evidence pipeline rather than only wrapping an LLM prompt. Documents are split by structure with length fallback, embedded, and indexed with source and heading metadata. At query time the system supports vector and Hybrid Search, retrieves topK candidates, filters weak matches, reranks candidates, deduplicates context, and keeps topN evidence for grounded generation. It refuses unsupported answers and records every retrieval stage so failures can be traced to recall, filtering, ranking, or context selection.

