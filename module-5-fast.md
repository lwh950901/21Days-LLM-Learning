# 模块 5 一页纸速记：RAG、Chunking、向量检索与 Hybrid Search

## 1. 模块 5 核心句

模块 5 学的不是“把文档扔进向量库”，而是：

> 如何把企业文档变成可检索证据，并让 LLM 只基于可靠证据回答。

完整链路：

```text
离线索引：
文档解析
→ Chunking
→ Embedding
→ 向量存储
→ 增量更新

在线检索：
用户问题
→ Vector / Keyword / Hybrid Search
→ topK
→ minScore
→ Rerank
→ topN
→ 上下文
→ 回答或拒答
→ Quality Log
```

## 2. 离线索引 / 在线检索速记

### 离线索引

```text
PDF / Word / Markdown
→ 解析文本
→ 按标题、段落、列表等结构切分
→ 超长内容递归切分
→ 保存 source / headingPath 等 metadata
→ 生成 Chunk Embedding
→ 写入向量库
```

更新规则：

```text
未变化：复用向量
新增：Embedding + Insert
修改：Embedding + Update
删除：物理删除，或标记失效并强制过滤
```

### 在线检索

```text
Query Embedding
→ 初步召回
→ 阈值过滤
→ Rerank
→ 去重与版本过滤
→ 构造紧凑上下文
→ LLM 回答或后端拒答
```

面试句：

> 离线阶段负责把文档转换成可检索的 Chunk 和向量，在线阶段负责根据问题检索、过滤、重排和构造证据上下文。

## 3. Chunking 速记

```text
Fixed Chunking：固定长度，适合 baseline 或无结构文本
Structured Chunking：按标题、段落、列表、FAQ、日志事件切分
Recursive Chunking：先大结构，过长再逐级切小
```

推荐顺序：

```text
标题
→ 段落
→ 列表 / FAQ / 句子
→ 固定 Token / 字符长度兜底
```

Chunk 太大：

```text
主题混合
噪音增加
占用上下文
Token 成本高
```

Chunk 太小：

```text
证据被切断
标题与正文分离
命中后仍无法回答
```

overlap：

```text
太小：边界语义丢失
太大：重复 Chunk、噪音和成本增加
```

注意：

> `500～1000 tokens` 可以作为测试起点，不是通用最佳值。`demo6` 当前 `maxLength` 按字符长度工作，生产升级可换成 tokenizer。

## 4. headingPath 与 Metadata

`headingPath（标题层级路径）` 示例：

```text
权限管理 > 管理员 > 数据导出
账号管理 > 普通用户 > 数据导出
```

核心区别：

```text
放 metadata：便于过滤、追踪、调试
放 Chunk text：Embedding 模型和 LLM 才能看到
```

常用 metadata：

```text
documentId：原文档
chunkId：具体 Chunk
source：来源
headingPath：标题层级
chunkIndex：原文位置
contentHash：内容是否变化
version / status / effectiveAt：版本有效性
```

## 5. Embedding 与向量库速记

Embedding：

```text
Chunk → 向量
Query → 向量
两个向量 → 计算语义相似度
```

不要混淆：

```text
Embedding 向量：用于语义检索
contentHash：用于判断内容是否变化
```

向量库选型：

```text
学习 Demo：内存向量库 / Chroma
已有 PostgreSQL：先评估 pgvector
需要托管扩展：评估 Pinecone
```

选型依据：

```text
现有技术栈
数据规模
并发与延迟
metadata / 权限过滤
团队运维能力
成本和供应商依赖
```

核心句：

> pgvector 是 PostgreSQL 的向量扩展；Pinecone 是托管向量数据库。二者都不会替应用自动完成文档解析、Chunking、业务权限和答案生成。

## 6. Vector / Keyword / Hybrid Search

```text
Vector Search：语义相似、同义表达
Keyword Search：错误码、API 名、型号、条款编号
Hybrid Search：组合向量和关键词信号
```

示例：

```text
“怎么重置密码？” → Vector
“E1024 是什么？” → Keyword / Hybrid
“E1024 登录失败怎么处理？” → Hybrid
```

简单公式：

```text
finalScore = vectorScore * 0.7 + keywordScore * 0.3
```

最容易说错：

> `0.7 / 0.3` 只是起始权重，不是标准答案。要根据查询类型和真实检索结果调整。

## 7. topK / minScore / Rerank / topN

```text
topK：初步召回多少候选
minScore：过滤低分候选
rerankInputLimit：多少候选交给 Reranker
Rerank：重新排序收到的候选
topN：最终多少 Chunk 进入上下文
```

口诀：

```text
topK 管候选池。
minScore 管能否留下。
Rerank 管重新排序。
topN 管最终上下文。
```

关键场景：

```text
正确 Chunk 初召回第 8
Rerank 只收到前 5
→ 应增大 rerankInputLimit
→ 增大 topN 没用
```

核心句：

> Rerank 能重排已有候选，不能找回没有收到的 Chunk。

## 8. 上下文构造与无答案

进入 Prompt 前：

```text
去除近重复 Chunk
过滤 obsolete 旧版本
检查冲突证据
保留 source / headingPath
控制 Token 预算
只保留有信息增量的证据
```

相似度不代表：

```text
内容真实
版本最新
来源权威
当前有效
```

无答案双层处理：

```text
selectedChunks.length === 0
→ 后端直接拒答，不调用 LLM

调用 LLM
→ System Prompt 继续限制只能根据上下文回答
```

冲突证据：

```text
先检查 version / effectiveAt / status / source
无法判断有效版本
→ 不给确定答案
```

## 9. Quality Log 故障定位

四阶段：

```text
retrievedCandidates：初步召回
filteredCandidates：通过 minScore
rerankedCandidates：Rerank 后排序
selectedChunks：最终进入上下文
```

定位表：

| 正确 Chunk 在哪里消失 | 问题 | 优先检查 |
|---|---|---|
| 没进 retrievedCandidates | 召回 | 索引、Chunking、Embedding、检索模式、过滤、topK |
| 没进 filteredCandidates | 阈值过滤 | minScore |
| 没进 Rerank 输入 | 候选截断 | rerankInputLimit |
| Rerank 后排名下降 | 重排 | 查询、候选质量、Reranker |
| 排名高但没进上下文 | 最终选择 | topN、去重、版本过滤 |
| selectedChunks 正确但回答错 | 上下文 / 生成 | Prompt、证据格式、冲突处理 |

调参原则：

```text
先定位阶段
一次改一个变量
使用相同查询对比日志
```

## 10. 增量索引与删除策略

```text
documentId：标识原文档
chunkId：标识具体 Chunk
contentHash：判断内容是否变化
```

例子：原来 100 个 Chunk，更新后：

```text
80 个未变化：复用向量
10 个修改：重新 Embedding + Update
10 个删除：Delete 或标记失效
20 个新增：Embedding + Insert
```

需要 Embedding：

```text
10 个修改 + 20 个新增 = 30 个
```

删除策略：

```text
业务数据库：可保留历史版本和审计记录
在线向量索引：只允许 active 内容参与检索
```

逻辑删除后必须始终加 metadata 过滤，也可以定期物理清理无用向量。

## 11. Demo6 状态

路径：

```text
/Users/elvis/Desktop/21DaysLLMLearning/demo6
```

能力：

```text
Next.js RAG Workbench
Markdown 递归 Chunking
完整 headingPath
本地 Embedding fallback
可选 SiliconFlow BAAI/bge-m3
内存 Vector / Keyword / Hybrid Search
topK / minScore
可选 BAAI/bge-reranker-v2-m3
topN
DeepSeek 上下文回答
无答案处理
四阶段 Quality Log
```

关键文件：

```text
src/chunking.ts
src/embeddings.ts
src/vector-store.ts
src/reranker.ts
src/rag.ts
src/rag-llm.ts
app/api/rag/route.ts
app/page.tsx
tests/rag.test.ts
```

运行：

```bash
cd /Users/elvis/Desktop/21DaysLLMLearning/demo6
npm run dev
```

验证：

```bash
npm run test:rag
npm run typecheck
npm run build
```

已通过：

```text
test:rag：7/7
typecheck：通过
build：通过
```

当前边界：

```text
已实现：内存向量库和完整学习链路
生产升级：pgvector / Pinecone、完整文件解析、权限系统、性能验证
```

## 12. 60 秒面试表达

> 我实现了一个企业知识库 RAG Demo，为内部 AI 助手提供基于企业文档的可靠问答能力。离线阶段按照标题、段落和列表等结构切分文档，超长内容再递归切分，并保留来源和标题层级路径。在线阶段支持向量检索和 Hybrid Search，让自然语言问题以及错误码等精确标识符都能被检索。
>
> 系统先召回 topK，经过 minScore 过滤和 Rerank 后保留 topN，再对证据去重、过滤失效版本并构造上下文。没有有效 Chunk 时后端直接拒答；调用 LLM 时仍限制只能根据上下文回答。我还实现了四阶段 Quality Log，用于判断正确 Chunk 是在召回、过滤、重排还是最终选择阶段丢失。
>
> 当前 Demo 使用内存向量库。生产环境中，我会根据现有技术栈、数据规模、并发、延迟和权限过滤要求，在 pgvector、Pinecone 等方案中进行选型。

## 13. 高频题速答

### 为什么不能把整个知识库放进 Prompt？

> 会占用上下文和 Token，引入大量噪音，提高延迟和成本，也不利于模型聚焦正确证据。

### 如何选择 Chunking 策略？

> 先按标题、段落、列表、FAQ 等自然结构切分，超长内容再按句子和 Token 或字符长度递归切分，固定长度只做兜底。

### headingPath 为什么要完整保留？

> 它让 Chunk 保留上级业务语境。只写“数据导出”可能混淆管理员和普通用户，完整路径能改善检索、过滤和排错。

### metadata.headingPath 为什么不一定够？

> metadata 不会自动进入 Embedding 输入或 messages。需要模型感知时，还要把标题路径写进 Chunk text。

### 什么时候使用 Hybrid Search？

> 知识库同时包含自然语言和错误码、API 名、型号、条款编号等精确标识符时使用。

### topK 和 topN 有什么区别？

> topK 是初步召回候选数量，topN 是 Rerank 后最终进入上下文的数量。

### minScore 太高会怎样？

> 正确 Chunk 可能已被召回，却在过滤阶段被删除。

### Rerank 能找回没召回的 Chunk 吗？

> 不能。Rerank 只能重新排序它收到的候选。

### contentHash 是 Embedding 吗？

> 不是。contentHash 判断内容是否变化，Embedding 向量用于语义检索。

### 新增 Chunk 有 contentHash，为什么还要 Embedding？

> 因为它没有可复用的历史向量，仍需要生成检索向量。

### 没有有效 Chunk 时怎么处理？

> 后端直接拒答，不调用 LLM；调用 LLM 时仍通过 System Prompt 限制只能根据上下文回答。

### 两个高分 Chunk 冲突怎么办？

> 检查版本、生效时间、状态和来源权威性，不能只选相似度更高的一条；无法消除冲突就拒绝给确定答案。

### 如何诊断错误回答？

> 查看四阶段 Quality Log，先判断是召回问题，还是过滤、排序、截断或生成问题，再单变量调参。

## 14. 面试前 10 分钟检查

必须能说清：

```text
1. 离线索引和在线检索分别做什么
2. Fixed / Structured / Recursive Chunking 的区别
3. headingPath 为什么既可能放 metadata，也可能放 text
4. Embedding 和 contentHash 的区别
5. Vector / Keyword / Hybrid Search 的适用场景
6. topK / minScore / rerankInputLimit / topN 的边界
7. 正确 Chunk 没进初始候选为什么是召回问题
8. Rerank 为什么不能找回未收到的 Chunk
9. 如何做上下文去重和版本过滤
10. 为什么无 Chunk 时后端直接拒答
11. Quality Log 四阶段分别是什么
12. 内存向量库、pgvector、Pinecone 如何选
13. demo6 实现了什么，哪些仍是生产升级项
```

最容易说错：

```text
Chunk 越大越好
overlap 越多越安全
metadata 会自动进入 messages
返回了候选就不算召回问题
增大 topN 可以修复 Rerank 输入过小
Rerank 可以找回没召回的证据
contentHash 可以替代向量
相关 Chunk 都应该放进上下文
相似度高就代表内容最新、正确
只靠 System Prompt 才能拒答
Demo 已经接入 pgvector 或 Pinecone
```

最终结论：

> 模块 5 已完成严格理解验收。代码、运行、练习、总结、高频面试题和项目表达均已通过。
