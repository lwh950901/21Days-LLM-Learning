# Rerank

This demo optionally calls SiliconFlow `BAAI/bge-reranker-v2-m3` after initial retrieval.

```text
query
-> vector / keyword / hybrid retrieval (topK)
-> minScore filtering
-> BGE reranker (topN)
-> context construction
-> answer
```

## API

```http
POST https://api.siliconflow.cn/v1/rerank
```

```json
{
  "model": "BAAI/bge-reranker-v2-m3",
  "query": "管理员最多能导出多少条数据？",
  "documents": ["候选 chunk A", "候选 chunk B"],
  "top_n": 3,
  "return_documents": false
}
```

The API returns the original document `index` and a `relevance_score` from 0 to 1. The demo maps each index back to its retrieved chunk and stores the value as `rerankScore`.

## topK vs topN

- `topK`: number of candidates returned by the first retrieval stage.
- `topN`: number of candidates retained after reranking.

The first stage tries not to miss evidence. Reranking then removes weaker candidates before context construction.

## Interview Answer

> Vector or Hybrid Search is the recall stage: it quickly finds topK possibly relevant chunks. A reranker is the precision stage: it reads the query and each candidate chunk together, then judges which chunk best supports the answer.
>
> In this demo I use SiliconFlow `BAAI/bge-reranker-v2-m3`. I retrieve a broader candidate set, apply minScore, rerank the remaining chunks, and keep only topN for the prompt. This reduces context pollution while preserving recall.
