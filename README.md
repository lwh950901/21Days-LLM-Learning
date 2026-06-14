# 21 天 AI 应用开发求职冲刺

> 周期 21 天 | 每日约 6 小时 | 目标 20k+ AI 应用开发岗位

---

## 学习路线大纲

| 模块 | 主题 | 天数 | 状态 |
| --- | --- | --- | --- |
| 1 | **LLM 与 AI SDK 核心基础** | Day 1-2 | ✅ 已完成 |
| 2 | Structured Output 与 Tool Calling | Day 3-4 | ⬜ 未开始 |
| 3 | Workflow、Agent 与 LangGraph | Day 5-7 | ⬜ 未开始 |
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
