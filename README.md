# 21 天 AI 应用开发求职冲刺

> 周期 21 天 | 每日约 6 小时 | 目标 20k+ AI 应用开发岗位

---

## 学习路线大纲

| 模块 | 主题 | 天数 | 状态 |
| --- | --- | --- | --- |
| 1 | **LLM 与 AI SDK 核心基础** | Day 1-2 | ✅ 已完成 |
| 2 | Structured Output 与 Tool Calling | Day 3-4 | ✅ 已完成 |
| 3 | Workflow、Agent、LangGraph 与 Multi-Agent | Day 5-7 | ✅ 已完成 |
| 4 | State、Persistence、Checkpoint、HITL | Day 8-9 | ⬜ 未开始 |
| 5 | RAG 工程 | Day 10-12 | ⬜ 未开始 |
| 6 | Memory 与 Guardrails | Day 13-14 | ⬜ 未开始 |
| 7 | Observability、Evals 与 MCP | Day 15-16 | ⬜ 未开始 |
| 8 | ProductCraft 整合、部署与项目包装 | Day 17-19 | ⬜ 未开始 |
| 9 | 简历、面试与投递 | Day 20-21 | ⬜ 未开始 |

---

## 模块 1 完成概要 ✅

> 📄 [完整学习归档](module-1.md) · [一页纸速记版](module-1-fast.md) · 💻 [Demo 代码](demo1/)

### 学习内容

- **LLM API 调用链路**：用户输入 → 后端组织 messages → 模型调用 → 流式返回 → 前端渲染
- **Messages 角色分工**：`system`（长期规则）/ `user`（当前任务）/ `assistant`（历史回复）
- **模型无状态**：多轮对话由应用层管理，非模型自动记忆
- **UIMessage vs ModelMessage**：前端消息与模型输入的分离，`convertToModelMessages` 转换
- **AI SDK 工程价值**：标准化模型调用、流式输出、消息协议、provider 切换
- **generateText vs streamText**：按交互场景选择，非按文本长短
- **Streaming 完整数据流**：模型 → `streamText` → HTTP stream response → 前端增量渲染
- **ReadableStream / SSE**：底层流接口 vs 服务端事件推送协议
- **Abort 停止生成**：中断当前请求流，非发送"请停止"prompt
- **错误处理**：区分鉴权/限流/超时/网络/参数错误，重试仅对临时错误
- **Token 与成本**：控制输入长度，预留输出空间，按需选择模型档位
- **Provider/Model 抽象**：业务代码用 fast/quality 配置，不写死具体模型名

### 代码产出

[demo1/](demo1/) — 合同风险分析助手 Demo

| 能力 | 技术实现 |
| --- | --- |
| 流式对话 | `streamText` + `useChat` |
| 消息转换 | `convertToModelMessages` (UIMessage → ModelMessage) |
| 增量渲染 | 前端 chunk 追加到同一条 assistant message |
| 停止生成 | `stop()` 中断当前请求，保留已生成内容 |
| 状态展示 | `idle → generating → done / stopped / error` |
| 模型切换 | `fast` / `quality` 配置抽离，惰性加载 env |
| API 接入 | `@ai-sdk/openai` chat completions 兼容模式 |

### 高频面试题

模块 1 覆盖 11 道高频题，含调用链路、messages 分工、无状态、Streaming、Abort、错误处理、Token 成本、Provider 切换等方向。

### 面试表达（5 条核心方向）

1. **LLM 调用链路**：不裸调模型，通过后端统一组织，方便权限、上下文、错误和切换管理
2. **Streaming 与体验**：长文本优先 streamText，后端流式返回，前端增量追加，支持中途停止
3. **无状态与上下文管理**：模型不自动记忆，应用层通过 chatId + history 管理多轮对话
4. **错误、停止与状态**：状态机驱动，停止中断请求而非再发 prompt，错误分场景处理
5. **模型切换与成本**：抽象 fast/quality/cheap 配置层，按成本、延迟、质量灵活切换

---

## 模块 2 完成概要 ✅

> 📄 [完整学习归档](module-2.md) · [一页纸速记版](module-2-fast.md) · 💻 [Structured Output Demo](demo2/) · [Tool Calling Demo](demo3/)

### 学习内容

**Structured Output**
- Zod Schema → AI SDK 转成模型可理解的结构约束 → 模型按结构生成 → 校验 → 前端消费
- `Output.object({ schema })` vs `json_object` 兼容模式：DeepSeek 不支持 `json_schema`，需降级为 `response_format: json_object` + prompt 内嵌格式 + Zod 后端校验
- 关键思维：Structured Output 解决"输出能否被系统稳定消费"，不保证内容质量
- `confidence` 字段体现工程意识：模型不确定性可量化，前端据此决定是否需要人工介入

**Tool Calling**
- AI SDK `tool()` + `inputSchema` + `execute`：模型决策、后端执行、副作用受控
- 只读工具（searchCompetitors）vs 业务工具（saveProject）：`risk: "readonly" | "business"`
- `stopWhen: stepCountIs(N)` 控制最大工具调用步数
- 工具调用日志：每次调用记录 toolName、risk、status、input、result
- 工具错误处理：模拟 timeout / save fail，错误收敛到业务提示

**Provider 兼容踩坑**
- DeepSeek 不支持 `response_format: json_schema` → `json_object` + prompt 格式说明
- `Output.object({ schema })` 不兼容 → 手动 `JSON.parse` + Zod `parse`
- `maxOutputTokens` 太小导致 JSON 截断 → 不设限制或设足够大
- reasoning model 超时 → 用 fast 模型 + 合理 timeout

### 代码产出

| Demo | 路径 | 核心能力 |
| --- | --- | --- |
| Structured Output | [demo2/](demo2/) | Zod ProductBrief · `json_object` 兼容 · 前端可编辑表单 · confidence 展示 |
| Tool Calling | [demo3/](demo3/) | `searchCompetitors` + `saveProject` · 工具日志 · 错误展示 · 白名单约束 |

### 面试表达

1. **Structured Output**：不是让模型"格式更好"，而是让下游代码可稳定消费。Zod 定义契约，模型生成，SDK/后端校验，三者各司其职
2. **Tool Calling**：模型是决策者不是执行者。后端提供白名单、校验参数、执行副作用、记录日志，模型只在白名单中选择
3. **Provider 兼容**：不同 provider 对 structured output / tool calling 的支持不同，需要降级策略。DeepSeek 不支持 `json_schema`，切为 `json_object` + prompt 配合
4. **工具风险分级**：readonly 工具可自动调用，business 工具需确认或限制频率，日志记录所有调用链

---

## 模块 3 完成概要 ✅

> 📄 [完整学习归档](module-3.md) · [一页纸速记版](module-3-fast.md) · 💻 [Demo 代码](demo4/)

### 学习内容

**Workflow**
- 手写 Workflow 引擎：State / Node / Edge / Conditional Edge / Loop
- State 是全局共享工作台，Node 只返回 `Partial<State>`
- Conditional Edge 根据 `qualityScore` 和 `retryCount` 三路路由
- Loop = Conditional Edge 回到已访问节点 + `maxRetries` 防止无限循环
- 通用 Workflow 模板可迁移到 PRD 生成、合同审查、客服工单等场景

**Agent (ReAct)**
- Model Decision → Act → Observation → Final Answer
- 模型只选择工具，代码执行工具（模型不直接操作数据）
- 接入 AI SDK / DeepSeek 做工具选择，无 API key 时自动降级为规则
- Tool Calling 是 Agent 的基础组件，但 Tool Calling ≠ Agent

**LangGraph**
- `StateGraph` / `addNode` / `addEdge` / `addConditionalEdges` / `compile()`
- 手写 Workflow 与 LangGraph 的 1:1 对应关系
- 最小 Demo 不接 LLM，只验证图结构、条件边和循环

**Multi-Agent**
- 最小双 Agent：analysisAgent（LLM 分析意图）+ executorAgent（代码执行工具）
- `analyzeWithLLM` 调用 LLM 返回多工具列表 + reason
- 无 API key 或 LLM 失败时自动降级为 `analysisAgentByRule`
- executorAgent 始终由代码执行白名单工具，不直接调用 LLM

**Prompt 策略**
- 每个 Node 的 Prompt 只做一件事，不写万能大 Prompt
- 只传当前节点需要的 State 字段，减少 token 和噪声
- 修正节点输入当前版本 + 质量问题，不做从零重写

### 代码产出

[demo4/](demo4/) — 会议纪要 Workflow 控制台

| 能力 | 技术实现 |
| --- | --- |
| Workflow 引擎 | 手写 7 个 Node + Conditional Edge + Loop（`maxRetries`） |
| Agent (ReAct) | AI SDK / DeepSeek 工具选择 + 规则降级 |
| LangGraph | `StateGraph` 最小图，State / Node / Edge / Conditional Edge 完整对应 |
| Multi-Agent (LLM) | `analyzeWithLLM` → analysisAgent → executorAgent，失败降级规则 |
| 可视化页面 | Next.js App Router + SSE 流式 Trace + PhaseProgress |
| 学习面板 | 每步对应 📖 核心概念 + 💬 面试表达，按阶段独立累积 |
| State 可视化 | `stateDiff` tag 展示每步修改了哪些 State 字段 |
| SSE 流式推送 | `ReadableStream` + `text/event-stream`，后端每步实时推事件 |
| 可配置延迟 | `DemoRunOptions.delayMs` 控制学习 Demo 速度 |

### 面试表达

1. **Workflow vs Agent 选择**：步骤稳定用 Workflow（代码控制），路径不确定用 Agent（模型决策），外层 Workflow + 局部 Agent 是最常见模式
2. **Conditional Edge + Loop**：质量检查不通过时通过条件边进入修正，`maxRetries` 防止无限循环，控制成本和失败边界
3. **ReAct 边界**：模型选择工具 ≠ 模型执行工具。Act 是代码执行，Observation 是工具结果，Final Answer 基于 Observation
4. **Multi-Agent 设计**：只在职责天然不同时拆分。analysisAgent 负责语义理解（接 LLM），executorAgent 执行白名单工具（纯代码），LLM 不可用时规则兜底
