# 模块 5 学习归档：RAG 工程、Chunking、向量检索与 Hybrid Search

## 1. 模块目标

本模块目标是掌握一条可以运行、可以排错、可以用于项目和面试表达的 RAG 工程链路，而不是只会说“把文档放进向量库，再让大模型回答”。

RAG（Retrieval-Augmented Generation，检索增强生成）解决的核心问题是：

> 在调用大模型之前，先从外部知识库检索与问题相关的证据，让模型基于证据回答，而不是依赖参数记忆或自由猜测。

本模块重点掌握：

1. RAG 基础链路：加载、切分、向量化、存储、检索、上下文构造、回答。
2. Chunking：固定切分、结构化切分、递归切分及其边界。
3. Embedding：把 Chunk 和查询转换成可计算相似度的向量。
4. 向量库选型：内存向量库、Chroma、pgvector、Pinecone 的项目取舍。
5. 检索质量：`topK`、`minScore`、Rerank、`topN`、上下文污染和无答案处理。
6. Hybrid Search：组合向量语义检索和关键词精确匹配。
7. 增量索引：处理新增、修改、未变化和删除的 Chunk。
8. Quality Log：记录检索各阶段，定位正确 Chunk 在哪里消失。
9. 项目表达：把 Demo 讲成一条可靠的企业知识库证据链路。

本模块不提前扩展 Memory、Guardrails、Prompt Injection、Observability、Evals、MCP 或 Agent Skills。

Demo 场景使用通用企业知识库，不绑定某一个具体业务项目：

```text
离线索引：
文档
→ 解析
→ Chunking
→ Embedding
→ 向量存储

在线检索：
用户问题
→ Query Embedding
→ Vector / Keyword / Hybrid Search
→ topK
→ minScore
→ Rerank
→ topN
→ 构造上下文
→ 回答或拒答
```

## 2. 诊断结果与纠正点

### 2.1 开场诊断结果

开场时已经能判断：

- 不能把整个知识库直接塞进 Prompt。
- Chunk 太大会消耗上下文并带来噪音。
- Chunk 太小会破坏语义完整性。
- `topK` 控制初步召回数量。
- 没有有效证据时不应该让模型自由回答。

当时的主要薄弱点：

```text
不了解结构化 Chunking 的实际代码落点
不了解 headingPath 的完整层级价值
不清楚向量库 Pinecone 和 pgvector 的定位
容易混淆召回问题与排序问题
容易混淆 topK、Rerank 输入数量和 topN
不了解 contentHash 和增量索引
不了解 Quality Log 如何产生、如何定位问题
项目面试表达不够自然
```

### 2.2 Chunk 大小与 overlap 纠正点

一开始对 Chunk 参数的理解主要停留在“太大不好，太小也不好”。

纠正后理解：

```text
Chunk 太大：
- 一个 Chunk 混入多个主题
- 相似内容被无关内容稀释
- 占用过多上下文和 Token
- Rerank 与 LLM 需要阅读更多噪音

Chunk 太小：
- 句子或段落被切断
- 证据不完整
- 标题与正文分离
- 检索命中后仍无法回答

overlap 太小：
- 边界语义可能丢失

overlap 太大：
- 重复内容增多
- 检索结果可能被近重复 Chunk 占满
- Token 成本增加
```

课程中形成的经验值是：可以从约 `500～1000 tokens` 和适度 overlap 开始测试，但这不是固定答案。实际参数要根据文档结构、问题类型、Embedding 模型和检索结果调整。

`demo6` 当前代码为了直观演示，`maxLength` 按字符长度执行，不是严格 Token 计数。生产升级时应使用与模型相匹配的 tokenizer 统计 Token。

### 2.3 结构化切分与递归兜底纠正点

最初容易把 Chunking 简化为固定 Token 切割。

纠正后理解：

```text
先利用文档已有结构：
标题
→ 段落
→ 列表或 FAQ 组合
→ 句子
→ 固定 Token / 字符长度兜底
```

不同文档可使用不同自然边界：

```text
Markdown / 制度文档：标题、段落、列表
FAQ：一个问题和答案组成一个 Chunk
日志：时间戳或事件边界
无标题纯文本：句子、Token 或字符长度兜底
```

核心纠正：结构化切分不是“永远不按长度切”，而是先保留自然语义单元，过长时再递归切分。

### 2.4 headingPath 纠正点

`headingPath` 表示标题层级路径，例如：

```text
权限管理 > 管理员 > 数据导出
账号管理 > 普通用户 > 数据导出
```

曾出现的错误设计是只保留当前标题，或者在多个层级中二选一，导致 H1、H2、H3 上下文丢失。

纠正后理解：

- 完整保留从 H1 到当前标题的路径。
- 放进 metadata，便于过滤、追踪来源和排错。
- 如果希望 Embedding 模型和 LLM 看到标题上下文，还需要把标题路径复制进 Chunk 文本。
- 只存在 metadata 中的字段不会自动进入 messages。

核心句：

> metadata 服务检索系统，Chunk text 才会真正参与 Embedding 和 LLM 上下文。需要模型感知的结构信息，不能只藏在 metadata 中。

### 2.5 Hybrid Search 纠正点

最初已经能判断错误码等精确标识符适合关键词检索，但对混合权重公式存在疑问。

纠正后理解：

```text
Vector Search：擅长语义相似和不同表达
Keyword Search：擅长错误码、API 名、型号、条款编号等精确词
Hybrid Search：组合两类得分，提高覆盖能力
```

示例公式：

```text
finalScore = vectorScore * 0.7 + keywordScore * 0.3
```

`0.7 / 0.3` 不是通用标准，只是起始配置。查询包含精确标识符时可以提高关键词权重；自然语言表达较多时可以提高向量权重。最终需要用真实问题和检索日志验证。

### 2.6 topK / minScore / Rerank / topN 纠正点

本模块中最重要的参数边界：

```text
topK：初步召回多少候选 Chunk
minScore：过滤低于阈值的候选
rerankInputLimit：多少候选真正交给 Reranker
Rerank：对收到的候选重新排序
topN：Rerank 后最终保留多少 Chunk 进入上下文
```

关键纠正：

- 正确 Chunk 没进入 `retrievedCandidates`，属于召回问题。
- 正确 Chunk 已召回但被 `minScore` 删除，属于过滤问题。
- 正确 Chunk 排名第 8，但 Rerank 只收到前 5 个，应提高 Rerank 输入数量，不是提高 `topN`。
- Rerank 只能重排收到的候选，不能凭空找回未召回的 Chunk。
- 增大 `topK` 可能提高召回，也可能引入更多噪音、延迟和 Rerank 成本。

### 2.7 召回问题与排序问题纠正点

曾经把“系统已经返回 10 个候选，但正确 Chunk 不在里面”误判为排序问题。

纠正后判断标准：

```text
正确 Chunk 不在初始候选集：召回问题
正确 Chunk 在候选集中但后续消失：过滤、排序或截断问题
```

召回问题优先检查：

```text
文档是否解析成功
正确内容是否真正建立索引
Chunking 是否破坏证据
Embedding 模型和向量维度是否一致
查询表达是否需要改写
是否应该使用 Hybrid Search
metadata / 租户 / 权限过滤是否误删
topK 是否过小
```

过滤和排序问题优先检查：

```text
minScore 是否过高
Rerank 输入数量是否过小
Reranker 是否排序合理
topN 是否过小
上下文去重是否误删互补证据
```

### 2.8 增量索引与 contentHash 纠正点

最初只想到修改 Chunk 需要重新 Embedding，遗漏新增和删除情况。

纠正后的更新规则：

```text
未变化 Chunk：复用已有向量
新增 Chunk：生成 Embedding 并新增
修改 Chunk：重新 Embedding 并更新
删除 Chunk：从在线索引删除，或标记失效并强制过滤
```

`contentHash` 是内容哈希，用来判断内容是否变化，不是向量。新增 Chunk 即使有 `contentHash`，也没有历史向量可以复用，仍然需要 Embedding。

删除可分为：

```text
物理删除：直接从在线向量索引移除
逻辑删除：metadata 标记 status = obsolete / deleted，检索时强制过滤
```

企业系统可以在业务数据库保留历史版本和审计记录，但在线检索索引必须排除失效内容，并可通过定时任务清理无用向量。

### 2.9 上下文去重与版本冲突纠正点

曾经认为两个相关 Chunk 都应该放进上下文：

```text
Chunk A：病假需要在 24 小时内补交证明
Chunk B：病假需要在一天内补交证明
```

纠正后理解：两者提供的信息高度重复，通常只保留分数更高或来源更可靠的一条。相关不代表都有信息增量。

如果两条证据冲突：

```text
Chunk A：24 小时内补交
Chunk B：48 小时内补交
```

不能只凭相似度选择分数更高的一条，需要检查：

```text
version：版本
effectiveAt：生效时间
updatedAt：更新时间
status：是否 active / obsolete
source：来源是否权威
```

相似度只表示相关性，不表示真实性、时效性或权威性。如果无法消除冲突，系统不应该生成确定答案。

### 2.10 无答案处理纠正点

早期方案主要依赖 System Prompt 要求模型回答“暂无相关内容”。

纠正后采用双层处理：

```text
selectedChunks.length === 0
→ 后端直接返回暂无相关内容
→ 不调用 LLM

存在候选并调用 LLM
→ System Prompt 继续限制只能根据上下文回答
```

后端直接拒答更确定、更快、更省 Token；System Prompt 是调用模型后的第二层兜底。二者不是二选一。

## 3. RAG 完整工程链路

### 3.1 离线索引阶段

离线索引负责把原始文档转换成可检索的 Chunk 和向量：

```text
上传 PDF / Word / Markdown
→ 文档解析与文本清洗
→ 按标题、段落、列表等结构切分
→ 超长内容递归切分
→ 补充 metadata
→ 计算 documentId / chunkId / contentHash
→ 为新增和修改 Chunk 生成 Embedding
→ 写入向量库
→ 删除或停用失效 Chunk
```

职责重点：

- 解析不同文件格式。
- 保证 Chunk 是可独立检索的语义单元。
- 保存来源和标题路径。
- 控制重复 Embedding 请求。
- 文档更新时避免旧内容继续被召回。

> **面试回答**
>
> 离线索引阶段，我会先解析不同格式的文档，优先按照标题、段落和列表等自然结构切分，超长部分再按 Token 或字符限制递归切分。每个 Chunk 保存 documentId、chunkId、source、headingPath 和 contentHash。新增和修改 Chunk 才重新生成 Embedding，未变化 Chunk 复用向量，失效 Chunk 从在线索引删除或标记为不可检索。

### 3.2 在线检索阶段

在线阶段负责根据用户问题找到证据并构造回答上下文：

```text
用户问题
→ 查询分析
→ Query Embedding
→ Vector / Keyword / Hybrid Search
→ 召回 topK
→ minScore 过滤
→ Rerank 候选
→ 保留 topN
→ 去重与版本过滤
→ 构造带来源的上下文
→ LLM 基于证据回答
→ 或后端直接拒答
→ 写入 Quality Log
```

职责重点：

- 根据查询类型选择检索方式。
- 在召回率、精度、上下文长度和成本之间取舍。
- 不把无关或失效证据交给 LLM。
- 记录每个阶段，保证问题可定位。

> **面试回答**
>
> 在线阶段，我会先对问题向量化，并根据查询类型选择向量检索或 Hybrid Search。系统召回 topK 后使用 minScore 过滤，再把候选交给 Reranker 重排，保留 topN。最终对证据去重、过滤旧版本并控制上下文 Token；没有可靠证据时由后端直接拒答，整个过程通过 Quality Log 记录。

## 4. Chunking 核心知识点

### 4.1 固定切分

固定切分按照固定字符数或 Token 数切割文本。

适合：

```text
快速建立 baseline
没有稳定标题和段落的纯文本
作为递归切分的最后兜底
```

风险：

```text
切断句子或段落
标题与正文分离
表格行或 FAQ 组合被拆开
无 overlap 时边界语义丢失
```

> **面试回答**
>
> 固定切分实现简单，适合作为无结构文本的 baseline 或最终兜底，但它不了解语义边界，容易切断句子、段落和标题关系。我不会把固定长度当成所有文档的默认最佳方案。

### 4.2 结构化切分

结构化切分利用文档已有边界：

```text
Markdown 标题
段落
列表
FAQ 问答组
日志事件或时间戳
合同条款
```

优点：更接近完整语义单元，命中后更容易为 LLM 提供完整证据。

风险：一个标题下面仍可能有非常长的正文，所以必须继续做长度兜底。

> **面试回答**
>
> 对有明确结构的文档，我优先按照标题、段落、列表、FAQ 组合或日志事件切分。这样比纯固定长度更容易保留完整语义，但结构化切分不是终点，过长 section 仍需要递归切分。

### 4.3 递归切分

递归切分按照从大到小的边界逐步处理：

```text
标题 section
→ 段落
→ 句子
→ 固定 Token / 字符长度
```

`demo6` 当前实现：

```text
H1 / H2 / H3 headingPath
→ 段落
→ 句子
→ 固定字符长度与少量字符 overlap
```

> **面试回答**
>
> 我不会先问 Chunk 应该固定多少 Token，而会先看文档是否有标题、段落、列表或 FAQ 等自然结构。递归切分先保留较大的语义边界，过长时再逐步降级，固定长度只作为最后兜底。

### 4.4 Chunk Metadata

常用字段：

```ts
type ChunkMetadata = {
  source: string;
  headingPath?: string;
  chunkIndex: number;
  strategy: "fixed" | "structured" | "recursive";
};
```

工程扩展字段：

```text
documentId
chunkId
contentHash
version
status
effectiveAt
tenantId
permissionScope
```

其中权限字段属于生产升级设计，本 Demo 未实现完整企业权限系统。

## 5. Embedding 与向量存储

### 5.1 Embedding 是什么

Embedding（嵌入向量）把文本转换成数字向量，使系统可以计算语义相似度。

```text
文档 Chunk → Embedding Model → Chunk Vector
用户问题 → 同一 Embedding Model → Query Vector
Query Vector 与 Chunk Vector → 相似度计算
```

关键边界：

- 文档和查询要使用兼容的 Embedding 模型。
- 向量维度必须一致。
- Embedding 不是答案生成模型。
- `contentHash` 不能替代向量。
- 重复内容可以通过缓存和 Hash 减少 API 请求。

`demo6` 默认使用本地轻量方案，避免每次练习消耗 API 额度；配置 SiliconFlow API Key 后可调用 `BAAI/bge-m3`。

> **面试回答**
>
> Embedding 的作用是把文档和查询映射到同一个向量空间，用相似度找语义相关内容。为了控制成本，我会缓存结果，并通过 contentHash 只重新向量化新增或修改的 Chunk。

### 5.2 内存向量库

本 Demo 使用内存向量库：

```text
Chunk Embedding
→ 保存在进程内存
→ Query Embedding
→ 计算 cosine similarity
→ 返回 topK
```

优点：

- 代码可读，便于观察完整链路。
- 不需要额外数据库。
- 适合学习、测试和小型 Demo。

限制：

- 服务重启后数据消失。
- 不适合大规模数据和多实例部署。
- 不是生产持久化方案。

### 5.3 pgvector

pgvector 是 PostgreSQL 的向量扩展，为 PostgreSQL 增加向量字段、距离计算和向量索引能力。

适合：

```text
应用已经使用 PostgreSQL
文档、Chunk、metadata 和业务数据希望统一管理
需要 SQL 过滤和事务能力
当前规模、并发和延迟可以满足
```

选型时需要验证：

```text
数据规模
并发
延迟
索引方式
租户与权限过滤
数据库运维能力
```

### 5.4 Pinecone

Pinecone 是托管向量数据库服务，负责向量记录的存储、检索、索引和托管扩展。

它不自动负责：

```text
原始文档解析
Chunking 设计
业务权限设计
Prompt 构造
LLM 回答
完整文档生命周期
```

适合团队希望减少自建向量检索运维，并需要托管扩展能力的场景。

### 5.5 向量库选型结论

```text
学习 Demo：内存向量库或 Chroma
已有 PostgreSQL 的企业应用：优先评估 pgvector
需要托管扩展能力：评估 Pinecone
```

不是按“哪个更高级”选择，而是根据：

```text
现有技术栈
数据规模
并发与延迟
metadata / 权限过滤
团队运维能力
成本
供应商依赖
```

> **面试回答**
>
> 学习 Demo 中我使用内存向量库，让检索逻辑更容易观察。生产环境如果已有 PostgreSQL，我会先验证 pgvector 在规模、并发、延迟和权限过滤下是否满足要求；如果团队更需要托管扩展能力，再评估 Pinecone，而不是只按流行度选型。

## 6. Vector、Keyword 与 Hybrid Search

### 6.1 Vector Search

Vector Search（向量检索）根据语义相似度找内容。

```text
问题：怎么重置账号密码？
文档：用户可以在账号安全页面修改密码。
```

即使字面不完全一致，也可能得到较高向量相似度。

适合：

- 自然语言问答。
- 同义表达。
- 用户问题与文档措辞不同。

### 6.2 Keyword Search

Keyword Search（关键词检索）根据精确词匹配。

```text
问题：E1024 是什么意思？
文档：E1024：用户 token 已过期，请重新登录。
```

适合：

```text
错误码
API 名
产品型号
订单号
合同条款编号
专业缩写
```

### 6.3 Hybrid Search

Hybrid Search（混合检索）组合向量和关键词得分。

```text
finalScore = vectorScore * vectorWeight
           + keywordScore * keywordWeight
```

`demo6` 的简单示例权重为：

```text
vectorScore * 0.7 + keywordScore * 0.3
```

这是演示用起点，不是固定标准。生产系统可使用 BM25 与向量检索合并候选，再交给 Reranker。

> **面试回答**
>
> 向量检索擅长语义相似，关键词检索擅长精确标识符。企业知识库通常同时包含自然语言和错误码、API 名等精确词，因此我会根据查询类型使用 Hybrid Search，并通过真实查询调节权重，而不是固定套用一个公式。

## 7. 检索参数与 Rerank

### 7.1 topK

`topK` 是初步召回候选数量。

```text
topK 太小：可能漏掉正确证据
topK 太大：候选噪音、延迟和 Rerank 成本上升
```

`topK` 不是越大越好，也不能修复文档未索引、Chunking 错误或检索方式错误。

### 7.2 minScore

`minScore` 是初步相关度阈值。

```text
低于 minScore
→ 不进入后续上下文
```

```text
阈值太低：无关 Chunk 进入后续阶段
阈值太高：正确 Chunk 被误删
```

如果正确 Chunk 已在 `retrievedCandidates`，却没有进入 `filteredCandidates`，优先检查 `minScore`。

### 7.3 Rerank

Rerank（重排）让模型同时阅读查询与候选 Chunk，重新判断证据相关性。

```text
初步检索：快速扩大候选池
Reranker：更精细地比较问题与每个候选
```

`demo6` 可选使用 SiliconFlow：

```text
BAAI/bge-reranker-v2-m3
```

流程：

```text
topK 候选
→ minScore 过滤
→ Reranker 重新排序
→ topN
```

### 7.4 topN 与 Rerank 输入数量

必须区分：

```text
rerankInputLimit：Reranker 能看到多少候选
topN：重排后最终留下多少候选
```

如果正确 Chunk 在初召回第 8 名，但只把前 5 名交给 Rerank，提高 `topN` 没有作用。正确做法是扩大 Rerank 输入候选池。

> **面试回答**
>
> topK 控制初步召回候选池，minScore 过滤弱候选，Rerank 对收到的候选重新排序，topN 控制最终进入上下文的数量。如果正确 Chunk 没有进入 Rerank 输入，提高 topN 无法解决问题。

## 8. 上下文构造与无答案处理

### 8.1 上下文不是 selectedChunks 的简单拼接

进入上下文前还要处理：

```text
近重复 Chunk 去重
失效版本过滤
来源与 headingPath 保留
冲突证据检查
Token 预算控制
按相关性与信息增量排序
```

高分但重复的 Chunk 不应占满上下文；高分但 `status = obsolete` 的 Chunk 也不能作为证据。

### 8.2 上下文污染

上下文污染包括：

```text
低相关 Chunk
近重复 Chunk
旧版本内容
相互冲突但未标记的证据
过长 Chunk 中的大量无关内容
```

后果：

- LLM 更难判断核心证据。
- 重复内容被过度放大。
- 旧版本与新版本混合。
- Token 成本增加。
- 回答可能看似合理但依据错误。

### 8.3 无答案处理

推荐流程：

```text
没有有效 selectedChunks
→ 后端直接返回“暂未检索到相关内容”
→ 不调用 LLM

存在 selectedChunks
→ 构造上下文并调用 LLM
→ System Prompt 限制只能依据上下文回答
```

如果证据冲突且无法判断有效版本，也应该拒绝给出确定答案。

> **面试回答**
>
> 我不会把所有高分结果直接拼进 Prompt，而会去重、过滤失效版本、保留来源并控制 Token。没有可靠 Chunk 时由后端直接拒答，避免额外延迟和模型猜测；调用 LLM 时仍用 System Prompt 限制只能基于上下文回答。

## 9. Quality Log 与故障诊断

### 9.1 Quality Log 是什么

Quality Log（检索质量日志）是应用在每次查询时记录的结构化检索过程，不是模型自动生成的答案评价。

`demo6` 记录：

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

### 9.2 四阶段日志

```text
retrievedCandidates：初步召回的 topK
filteredCandidates：通过 minScore 的候选
rerankedCandidates：完成 Rerank 后的完整排序
selectedChunks：最终进入上下文的 topN
```

### 9.3 故障定位矩阵

| 现象 | 问题类型 | 优先检查 |
|---|---|---|
| 正确 Chunk 不在 retrievedCandidates | 召回问题 | 索引、Chunking、Embedding、检索模式、过滤条件、topK |
| 正确 Chunk 被 filteredCandidates 排除 | 阈值过滤问题 | minScore 是否过高 |
| 正确 Chunk 未进入 Rerank 输入 | 候选截断问题 | rerankInputLimit |
| 正确 Chunk Rerank 后排名很低 | 重排问题 | 候选内容、Reranker、查询表达 |
| 正确 Chunk 排名较高但未进入上下文 | 最终截断问题 | topN、去重与版本过滤 |
| selectedChunks 正确但回答错误 | 上下文或生成问题 | Prompt、证据格式、冲突、模型输出约束 |

### 9.4 调参原则

```text
先定位正确 Chunk 在哪一步消失
一次尽量只调整一个变量
用相同查询对比日志
不要把所有参数同时调大或调低
```

否则无法判断改善来自哪个参数，也可能同时增加噪音、延迟和成本。

> **面试回答**
>
> 我不会只看最终答案排查 RAG，而会记录初始召回、阈值过滤、Rerank 和最终选择四个阶段。如果正确 Chunk 从未进入候选，这是召回问题；如果进入后消失，则检查 minScore、Rerank 输入、排序和 topN。这样可以进行单变量调优，而不是盲目改参数。

## 10. Demo6 实现归档

### 10.1 路径

```text
/Users/elvis/Desktop/21DaysLLMLearning/demo6
```

### 10.2 能力覆盖

```text
Next.js 可视化 RAG Workbench
Markdown 结构化与递归 Chunking
完整 headingPath
本地 Embedding fallback
可选 SiliconFlow BAAI/bge-m3
内存向量存储
Vector / Keyword / Hybrid Search
topK 与 minScore
可选 SiliconFlow BAAI/bge-reranker-v2-m3
topN 上下文压缩
可选 DeepSeek 基于上下文回答
无答案处理
四阶段 Quality Log
自动化测试
```

### 10.3 关键文件

```text
app/page.tsx
app/api/rag/route.ts
src/chunking.ts
src/embeddings.ts
src/local-embedding.ts
src/vector-store.ts
src/reranker.ts
src/rag.ts
src/rag-llm.ts
src/rag-demo.ts
src/types.ts
tests/rag.test.ts
```

### 10.4 核心文件职责

```text
src/chunking.ts：Markdown 标题路径、段落和长度兜底切分
src/embeddings.ts：SiliconFlow Embedding 请求与缓存
src/local-embedding.ts：免额度的本地学习 fallback
src/vector-store.ts：向量、关键词和混合得分
src/reranker.ts：Rerank API 与 Chunk 映射
src/rag.ts：检索、过滤、重排、上下文、拒答和 Quality Log
src/rag-llm.ts：基于检索上下文生成回答
app/api/rag/route.ts：Next.js API 路由
app/page.tsx：检索模式、参数和结果可视化
```

### 10.5 当前实现边界

已实现：

```text
完整学习型 RAG 链路
内存向量存储
可选真实 Embedding / Rerank / LLM API
检索参数控制
质量日志
自动测试
```

未实现，属于生产升级项：

```text
pgvector 持久化集成
Pinecone 持久化集成
完整 PDF / Word 文件解析器
完整租户和权限系统
大规模性能压测
```

### 10.6 运行与验证

```bash
cd /Users/elvis/Desktop/21DaysLLMLearning/demo6
npm run dev
```

默认页面：

```text
http://localhost:3000
```

验证：

```bash
npm run test:rag
npm run typecheck
npm run build
```

## 11. 文档产出

### 11.1 CHUNKING_STRATEGY.md

覆盖：

```text
Fixed Chunking
Structured Chunking
Recursive Chunking
自然结构与长度兜底
面试回答
```

### 11.2 VECTOR_DB_CHOICE.md

覆盖：

```text
内存向量库
Chroma
pgvector
Pinecone
Demo 与生产选型边界
```

### 11.3 HYBRID_SEARCH.md

覆盖：

```text
Vector Score
Keyword Score
加权组合
错误码和精确标识符场景
```

### 11.4 RERANK.md

覆盖：

```text
初步召回与精排
BAAI/bge-reranker-v2-m3
topK 与 topN
Rerank API
```

### 11.5 RETRIEVAL_QUALITY_LOG.md

覆盖：

```text
四阶段候选日志
召回与过滤、排序诊断
检索质量排错方法
```

### 11.6 MODULE_5_SUMMARY.md

覆盖：

```text
完整 RAG 工程链路
核心知识点
Demo 实现
生产升级边界
项目表达
```

### 11.7 INTERVIEW_QUESTIONS.md

覆盖：

```text
高频面试题
项目设计题
端到端项目表达
```

## 12. 严格理解验收结果

本模块没有因为 Demo 跑通或能复述术语就直接判定掌握。

验收方式：

```text
概念解释
错误设计判断
业务场景选择
参数故障定位
代码和日志验证
项目设计题
面试表达
```

最终结果：

```text
RAG 完整链路：通过
Chunking 策略：通过
headingPath：通过
Embedding 与增量索引：通过
向量库选型：通过
Hybrid Search：通过
topK / minScore / Rerank / topN：通过
召回与排序问题诊断：通过
上下文污染与版本冲突：通过
无答案处理：通过
Quality Log：通过
项目设计与面试表达：通过
```

关键回补：

```text
结构化切分仍需要长度兜底
headingPath 要保留完整层级
metadata 不会自动进入 messages
正确 Chunk 不在初始候选集属于召回问题
Rerank 无法重排没有收到的 Chunk
topN 不能修复 Rerank 输入过小
新增和修改 Chunk 都需要 Embedding
contentHash 不是向量
相关 Chunk 不等于都要进入上下文
相似度不代表内容最新或有效
无 Chunk 时后端直接拒答，System Prompt 继续兜底
```

## 13. 验证结果

在 Demo6 中已验证：

```bash
npm run test:rag
npm run typecheck
npm run build
```

结果：

```text
npm run test:rag：7/7 通过
npm run typecheck：通过
npm run build：通过
```

测试覆盖：

```text
完整 headingPath 写入 metadata 和 Chunk text
超长 section 按段落继续切分
向量相似度排序
低相关结果拒答
Hybrid Search 提升错误码精确匹配
Reranker 重新排序
四阶段 Quality Log
```

Build 路由：

```text
/
/_not-found
/api/rag
```

## 14. 高频面试题

### 14.1 什么是完整的 RAG 链路？

> 离线阶段先解析文档、切分 Chunk、生成 Embedding 并写入向量库；在线阶段把问题向量化，通过向量或混合检索召回 topK，使用阈值过滤和 Rerank 提高精度，再保留 topN 构造上下文。没有可靠证据时拒答，有证据时让 LLM 只根据上下文回答。

### 14.2 为什么不能把整个知识库放进 Prompt？

> 整个知识库会大量占用上下文和 Token，引入无关噪音，提高延迟和成本，还可能让模型无法聚焦正确证据。RAG 的价值是先检索，再只提供当前问题需要的证据。

### 14.3 如何选择 Chunking 策略？

> 我优先利用标题、段落、列表、FAQ 或日志事件等自然结构，过长内容再按句子和 Token 或字符长度递归切分。固定切分主要用于无结构文本或最终兜底，参数需要通过真实检索问题验证。

### 14.4 headingPath 为什么重要？

> headingPath 保存 Chunk 所处的完整标题层级，避免“数据导出”这类相同小标题失去管理员或普通用户等上级语境。它可以放在 metadata 用于过滤和排错，也可以复制进 Chunk text，让 Embedding 模型和 LLM 感知结构。

### 14.5 向量检索和关键词检索有什么区别？

> 向量检索擅长语义相似和不同表达，关键词检索擅长错误码、API 名、型号和条款编号等精确匹配。知识库同时包含两类信息时，可以使用 Hybrid Search 合并候选。

### 14.6 Hybrid Search 权重为什么不是固定的？

> 不同查询对语义和精确词的依赖不同。自然语言问题通常更依赖向量得分，错误码等查询更依赖关键词得分，因此权重只能作为起点，需要根据真实查询和质量日志调整。

### 14.7 topK、minScore 和 topN 有什么区别？

> topK 是初步召回候选数量，minScore 是过滤弱候选的阈值，topN 是 Rerank 后最终进入上下文的数量。它们作用在不同阶段，不能互相替代。

### 14.8 Rerank 能解决什么，不能解决什么？

> Rerank 可以更精细地比较问题和已有候选，改善候选排序；但它无法找回没有进入候选集或没有传给 Reranker 的 Chunk。初始召回和 Rerank 输入池仍然必须覆盖正确证据。

### 14.9 如何处理文档更新？

> 我会使用稳定的 documentId、chunkId 和 contentHash 做增量索引。未变化 Chunk 复用向量，新增和修改 Chunk 重新生成 Embedding，删除 Chunk 从在线索引移除或标记失效并强制过滤。

### 14.10 如何处理没有答案的情况？

> 如果过滤和重排后没有有效 selectedChunks，后端直接返回暂无相关内容，不调用 LLM。存在候选并调用模型时，System Prompt 仍限制只能根据上下文回答，形成两层保护。

### 14.11 如何诊断 RAG 回答错误？

> 我会查看四阶段 Quality Log。正确 Chunk 没进入初始候选属于召回问题，应检查索引、Chunking、Embedding、查询、检索模式和过滤条件；已进入候选后消失，则检查 minScore、Rerank 输入、排序、去重和 topN。

### 14.12 如何避免上下文污染？

> 我会去掉近重复 Chunk，过滤失效版本和低相关内容，保留来源信息，并控制 Token 预算。相似度只代表相关性，不能替代版本、生效时间、状态和来源权威性判断。

### 14.13 如何选择向量库？

> 学习 Demo 可以使用内存向量库或 Chroma。已有 PostgreSQL 的应用可以先评估 pgvector；如果规模、延迟、过滤或团队运维条件不满足，且希望使用托管扩展能力，再评估 Pinecone。选型依据是需求，不是流行度。

## 15. 项目设计题

题目：

```text
设计一个企业知识库系统：
支持 PDF、Word、Markdown；
文档会新增、修改和删除；
同时包含自然语言和 E1024 等精确标识符；
Embedding API 有额度限制；
没有可靠证据时不能让模型猜测。
```

参考回答：

> 离线阶段我会先解析不同格式文档，按照标题、段落、列表等自然结构进行 Chunking，超长内容再按 Token 长度递归切分。每个 Chunk 保存 documentId、chunkId、contentHash、source、headingPath、版本和状态。新增和修改 Chunk 请求 Embedding，未变化 Chunk 复用向量，删除或失效 Chunk 从在线索引排除。
>
> 在线阶段先分析查询并生成 Query Embedding。自然语言问题使用向量检索，包含错误码和精确标识符时使用 Hybrid Search。系统召回 topK，经过 minScore 过滤后，把足够宽的候选池交给 Reranker，再保留 topN。构造上下文前进行去重、版本过滤和 Token 控制。
>
> 如果没有可靠 selectedChunks，后端直接返回暂无相关内容；调用 LLM 时仍通过 System Prompt 限制只能根据证据回答。系统记录 retrievedCandidates、filteredCandidates、rerankedCandidates 和 selectedChunks，用于判断问题发生在召回、过滤、排序还是上下文选择阶段。向量库会根据现有技术栈、规模、并发、延迟和权限过滤要求，在 pgvector 与 Pinecone 等方案之间选型。

## 16. 项目表达

> 我实现了一个企业知识库 RAG Demo，为内部 AI 助手提供基于企业文档的可靠问答能力。离线阶段按照标题、段落和列表等结构切分文档，超长内容再递归切分，并保留来源和标题层级路径。在线阶段支持向量检索和 Hybrid Search，让自然语言问题以及错误码等精确标识符都能被检索。
>
> 系统先召回 topK，经过 minScore 过滤和 Rerank 后保留 topN，再对证据去重、过滤失效版本并构造上下文。没有有效 Chunk 时后端直接拒答；调用 LLM 时仍限制只能根据上下文回答。我还实现了四阶段 Quality Log，用于定位正确 Chunk 是在召回、过滤、重排还是最终选择阶段丢失。
>
> 当前 Demo 使用内存向量库，便于学习和观察完整链路。进入生产环境后，我会根据现有技术栈、数据规模、并发、延迟和权限过滤要求，评估 pgvector 或 Pinecone，并补充持久化文件解析、增量索引和权限控制。

## 17. 模块 5 完成判定

模块 5 已完成：

```text
核心概念掌握：通过
项目代码完成：通过
功能可以运行：通过
练习通过：通过
章节总结完成：通过
高频面试题完成：通过
项目设计题完成：通过
项目表达完成：通过
```

必须产出：

```text
文档切分 Demo：完成
Chunking 策略对比：完成
向量库选型说明：完成
RAG 问答 Demo：完成
检索质量记录：完成
Hybrid Search：完成
模块 5 总结：完成
高频面试题与项目表达：完成
```

最终结论：

> 模块 5 已通过严格理解验收，可以标记完成。持久化 pgvector 或 Pinecone 接入属于明确的生产升级项，不影响本学习 Demo 的完成判定。
