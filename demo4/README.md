# Demo 4: Meeting Workflow

模块 3 的可视化 Demo：用 Next 页面观察 Workflow、Agent、LangGraph 与最小 Multi-Agent。

## 学习目标

- `State`：保存整条流程共享的数据。
- `Node`：每个节点只负责一个步骤，并返回 `Partial<State>`。
- `Edge`：按固定顺序进入下一个节点。
- `Conditional Edge`：根据质量分数和重试次数决定下一步。
- `Loop`：质量不通过时修正一次，并用 `maxRetries` 防止无限循环。

## 运行

```bash
npm run dev
```

打开：

```txt
http://localhost:3000
```

需要 Node.js 24+。

如果没有 `.env.local`，Demo 会自动降级为规则选择工具，不会调用 LLM。

## CLI 版本

```bash
npm run cli
```

CLI 会打印 Workflow Trace、Agent Trace 和 Multi-Agent Trace。

## DeepSeek 配置

参考 Demo2 的 OpenAI-compatible 配置：

```bash
OPENAI_API_KEY=your_api_key_here
OPENAI_BASE_URL=https://api.deepseek.com/v1
AI_MODEL_FAST=deepseek-v4-flash
```

本 Demo 为了节省 token，只让 LLM 做一件事：从 `getSummary`、`getDecisions`、`getActionItems`、`getRisks` 中选择一个工具。

## LangGraph 最小 Demo

```bash
npm install
npm run langgraph
```

这个版本不调用 LLM，只演示 `StateGraph`、`Node`、`Edge`、`Conditional Edge` 和 `Loop`。
