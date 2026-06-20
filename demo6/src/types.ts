export type ChunkingStrategy = "fixed" | "structured" | "recursive";
export type SearchMode = "vector" | "keyword" | "hybrid";

export type Chunk = {
  id: string;
  text: string;
  metadata: {
    source: string;
    headingPath?: string;
    chunkIndex: number;
    strategy: ChunkingStrategy;
  };
};

export type RetrievedChunk = {
  chunk: Chunk;
  score: number;
  vectorScore: number;
  keywordScore: number;
  rerankScore?: number;
};

export type CandidateLog = {
  id: string;
  source: string;
  headingPath?: string;
  score: number;
  vectorScore: number;
  keywordScore: number;
  rerankScore?: number;
};

export type QualityLog = {
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
  matchedChunks: CandidateLog[];
};
