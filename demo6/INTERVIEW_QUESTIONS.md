# Module 5 Interview Questions

## 1. What Is the Complete RAG Pipeline?

> Offline, documents are parsed, chunked, embedded, and stored. Online, the query is embedded, candidates are retrieved and filtered, then reranked and compressed into a small evidence context. The LLM answers only from that context or refuses when the evidence is insufficient.

## 2. Why Not Put the Whole Knowledge Base in the Prompt?

> It consumes the context window and tokens, introduces unrelated noise, increases latency and cost, and makes grounded answers less reliable. Retrieval selects only the evidence needed for the current question.

## 3. How Do You Choose a Chunking Strategy?

> I prefer natural document structure such as headings, paragraphs, lists, or FAQ groups, then use token or character limits as a fallback for overlong sections. Fixed chunking is mainly a fallback for unstructured text. Chunk size and overlap must be tuned with real retrieval examples.

## 4. Why Preserve headingPath?

> A full heading path keeps a chunk connected to its business context, improves matching for scoped questions, and supports filtering and debugging. I store it in metadata and may copy it into chunk text when the embedding model and LLM need to see it.

## 5. How Do You Choose a Vector Store?

> For a learning demo I use an in-memory store or Chroma. If the application already uses PostgreSQL, I first evaluate pgvector against data scale, concurrency, latency, indexing, and tenant filters. If those requirements exceed the current database or the team wants managed scaling, I consider Pinecone.

## 6. When Should Hybrid Search Be Used?

> Vector search handles semantic similarity, while keyword search is strong for exact identifiers. Queries containing error codes, API names, model numbers, or contract clauses often benefit from Hybrid Search because pure semantic retrieval may underweight the exact token.

## 7. What Are topK, minScore, and topN?

> topK controls the initial candidate pool, minScore filters weak candidates, and topN controls how many reranked results enter the final context. They affect different pipeline stages and should not be treated as interchangeable parameters.

## 8. What Can Rerank Fix?

> Rerank can improve the order of candidates already retrieved by comparing the query and chunk more precisely. It cannot recover a correct chunk that was never retrieved or was removed before reaching the reranker.

## 9. How Do You Handle No-Answer Cases?

> I filter weak evidence before generation and require the model to answer only from the supplied context. If no reliable chunk remains, or the evidence conflicts without a trustworthy version signal, the system returns an explicit no-answer response instead of guessing.

## 10. How Do You Update an Indexed Document?

> I use stable document and chunk identifiers plus content hashes. Unchanged chunks reuse their vectors, modified and new chunks are embedded, and deleted chunks are removed. This reduces embedding cost and prevents obsolete content from polluting retrieval.

## 11. How Do You Diagnose a Wrong RAG Answer?

> I inspect a staged quality log. If the correct chunk never entered initial candidates, I investigate indexing, chunking, embeddings, search mode, query wording, filters, and topK. If it entered but disappeared later, I inspect minScore, rerank input, rerank order, deduplication, and topN.

## 12. How Do You Avoid Context Pollution?

> I keep only relevant and complementary evidence, remove near-duplicates, filter obsolete versions, preserve source metadata, and enforce a token budget. Similarity alone is insufficient because it does not prove freshness, authority, or correctness.

## 13. Project Design Question

Design a knowledge base that supports PDF, Word, and Markdown; document updates; semantic questions and exact identifiers; limited embedding quota; and no-answer handling.

A strong answer should cover:

- parsing and structured chunking with length fallback;
- stable IDs, content hashes, incremental embedding, and deletion;
- vector store selection based on scale, latency, filtering, and operations;
- vector and Hybrid Search selection;
- topK, threshold filtering, rerank input, and topN;
- context deduplication, version filtering, and token limits;
- refusal behavior and a staged retrieval quality log.

