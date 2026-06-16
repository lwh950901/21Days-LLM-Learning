# 模块 3 一页纸速记：Workflow、Agent、LangGraph 与 Multi-Agent

## 1. 模块 3 核心句

模块 3 学的不是某一个会议纪要业务，而是：

> 如何把 AI 任务建模成可控 Workflow，并在局部引入 Agent 决策。

通用模板：

```text
Input
→ Extract
→ Analyze / Plan
→ Generate
→ Validate
→ Route
→ Revise
→ Agent Query
```

## 2. 普通 LLM 调用 / Workflow / Agent / LangGraph / Multi-Agent

```text
普通 LLM 调用：一次性、低风险、无复杂流程
Workflow：步骤稳定，需要可控产出
Agent：下一步动作不确定，需要模型判断
LangGraph：状态、分支、循环明显
Multi-Agent：职责天然不同，拆开更清晰
```

面试句：

> 我会先判断任务复杂度，而不是默认上 Agent。简单摘要用普通 LLM 调用；步骤稳定的业务流程用 Workflow；需要模型动态选择工具时用 Agent；流程有状态、分支和循环时用 LangGraph；只有当任务天然存在分析、执行、审查等不同职责时，才引入最小 Multi-Agent。

## 3. Workflow 速记

Workflow = 代码控制流程。

适合：

```text
会议纪要
PRD 生成
合同审查
报告生成
客服工单
简历筛选
```

核心价值：

```text
可观测
可测试
可重试
可定位失败点
可控制成本
```

面试句：

> 对于步骤稳定的 AI 任务，我会优先设计成 Workflow，而不是完全自主 Agent。因为 Workflow 可以让每个节点的输入输出可观测、可测试、可重试，也更容易控制成本和失败边界。

## 4. State / Node / Edge / Conditional Edge / Loop

```text
State：整条流程共享的数据工作台
Node：一个职责单一的处理步骤
Edge：固定顺序
Conditional Edge：根据 State 决定下一步
Loop：条件边回到前面节点
```

Demo4 对应：

```text
State = MeetingWorkflowState
Node = summarizeMeeting / extractDecisions / checkQuality / reviseMinutes
Edge = summarizeMeeting -> extractDecisions
Conditional Edge = routeAfterQualityCheck
Loop = reviseMinutes -> checkQuality
```

质量检查循环：

```text
checkQuality
→ routeAfterQualityCheck
→ reviseMinutes
→ checkQuality
```

核心句：

> Loop 必须有 maxRetries，否则可能无限修正，导致 token 成本和响应时间失控。

## 5. Agent / ReAct 速记

Agent = 模型参与下一步决策。

ReAct：

```text
Model Decision
→ Act
→ Observation
→ Final Answer
```

Demo4：

```text
Question：谁负责跑通 demo4？
Model Decision：decideToolWithAISDK 选择 getActionItems
Act：runMeetingTool 执行工具
Observation：工具返回待办事项
Final Answer：基于 Observation 回答
```

最容易说错：

```text
不是“模型执行工具”
而是“模型选择工具，代码执行工具”
```

面试句：

> Agent 适合局部不确定决策，比如用户问题可能需要查摘要、决策、待办或风险。模型只负责选择工具，工具执行由代码完成，工具结果作为 Observation，再基于 Observation 回答。

## 6. Tool Calling 与 Agent 区别

Tool Calling：

```text
模型可以调用工具
```

Agent：

```text
围绕目标进行多步决策、工具调用、观察结果、继续判断
```

核心句：

> Tool Calling 是 Agent 的基础组件之一，但用了 Tool Calling 不等于一定做了 Agent。

## 7. LangGraph 速记

LangGraph = 用图结构表达 Workflow / Agent。

核心 API / 概念：

```text
StateGraph
START / END
addNode
addEdge
addConditionalEdges
compile()
invoke()
```

手写 Workflow 对应 LangGraph：

```text
State = StateGraph State
函数节点 = Node
固定顺序 = Edge
routeAfterQualityCheck = Conditional Edge
while 循环 = Loop
```

面试句：

> LangGraph 不是替我想业务流程，而是把我设计好的流程声明成一张可执行图。它适合表达有 State、分支、循环和多节点协作的 AI Workflow。

## 8. Multi-Agent 速记

模块 3 只做最小双 Agent：

```text
analysisAgent：分析问题，需要哪些信息
executorAgent：执行工具，汇总 Observation
```

适合：

```text
用户同时问多个意图
需要先规划再执行
分析和执行职责明显不同
```

不适合：

```text
一个工具就能解决
一个 Prompt 就能解决
只是为了显得高级
多个 Agent 做同一件事
```

当前 Demo4：

```text
Multi-Agent：analysisAgent 已接 LLM（analyzeWithLLM），无 key 自动降级规则
单 Agent：工具选择接 AI SDK / DeepSeek
```

LLM 分析 + 降级：

```text
analyzeWithLLM
→ 有 API key: LLM 返回 { tools: [...], reason: "LLM 分析：..." }
→ 无 key / 失败: 自动降级为 analysisAgentByRule（规则匹配）

executorAgent 仍由代码执行白名单工具
```

面试句：

> 我不会默认把 AI 应用设计成复杂 Multi-Agent。只有当任务天然存在不同职责时，才做最小拆分。分析 Agent 负责拆解意图，执行 Agent 负责调用工具并汇总 Observation。

## 9. Prompt 策略速记

不要写万能大 Prompt。

按节点拆：

```text
摘要节点：只摘要
决策节点：只提取决策
待办节点：只提取待办
质量节点：只检查质量
修正节点：只根据 qualityIssues 修正
```

State 输入要克制：

```text
只传当前节点需要的字段
不要默认传全部历史
```

修正节点输入：

```text
当前 finalMinutes
qualityIssues
必要的 summary / decisions / actionItems / risks
```

面试句：

> 我在 Workflow / Agent 里不会写一个巨大的万能 Prompt，而是把 Prompt 拆到不同节点中。每个 Prompt 只对应一个职责，并且只接收必要的 State 字段。

## 10. Demo4 状态

路径：

```text
/Users/elvis/Desktop/21DaysLLMLearning/demo4
```

能力：

```text
Workflow Demo
Agent 小功能
LangGraph 最小 Demo
Multi-Agent 协作 Demo
Next 可视化页面
SSE 流式 Trace
```

关键文件：

```text
demo4/src/workflow-core.ts
demo4/src/langgraph-minimal.ts
demo4/src/index.ts
demo4/app/page.tsx
demo4/app/api/demo/route.ts
demo4/tests/multi-agent.test.ts
```

运行：

```bash
cd /Users/elvis/Desktop/21DaysLLMLearning/demo4
npm run dev
```

页面：

```text
http://localhost:3000
```

验证：

```bash
npm run dev:no-env
npm run langgraph
npm run test:multi-agent
```

已通过：

```text
npm run test:multi-agent
npm run langgraph
npm run dev:no-env
```

## 11. 60 秒面试表达

> 我做了一个模块 3 Demo，把 AI 任务建模成可控 Workflow：输入、抽取、生成、质量检查、条件路由和受控修正。外层流程由代码控制，局部不确定任务用 Agent 做工具选择，复杂状态和循环用 LangGraph 表达，Multi-Agent 只做最小的分析 Agent + 执行 Agent。

> 这个 Demo 的重点不是会议纪要业务本身，而是通用 AI Workflow 设计。它可以迁移到 ProductCraft PRD 生成、AI PDF 合同审查、客服工单处理等场景。

## 12. 高频题速答

### Workflow 和 Agent 区别？

> Workflow 是代码控制流程；Agent 是模型参与下一步决策。

### 为什么不用完全自主 Agent？

> 业务步骤稳定时，用 Workflow 更可控、可观测、可重试；Agent 只放在局部不确定任务里。

### Conditional Edge 是什么？

> 根据 State 决定下一步走向的路由规则。

### 为什么要 maxRetries？

> 防止无限循环，控制 token 成本、延迟和失败边界。

### ReAct 是什么？

> Model Decision → Act → Observation → Final Answer。

### Act 是模型执行工具吗？

> 不是。模型选择工具，代码执行工具。

### LangGraph 解决什么问题？

> 用图结构表达有 State、分支、循环的 AI Workflow / Agent。

### 什么时候用 Multi-Agent？

> 任务天然有不同职责，例如分析和执行，拆开后更清晰时才用。

### 当前 Multi-Agent 接 LLM 了吗？

> 已接。analysisAgent 调用 analyzeWithLLM，有 API key 时用 LLM 分析，无 key 或失败时自动降级为规则匹配。executorAgent 仍由代码执行白名单工具。

### 模块 3 的通用能力是什么？

> 把 AI 任务建模成可控图流程，并在局部引入 Agent 决策。

## 13. 面试前 10 分钟检查

必须能说清：

```text
1. Workflow / Agent / LangGraph / Multi-Agent 怎么选
2. State / Node / Edge / Conditional Edge / Loop 分别是什么
3. 为什么质量检查后要有 maxRetries
4. ReAct 中 Act 和 Observation 分别是什么
5. 为什么工具执行要由代码控制
6. Multi-Agent 为什么不应该滥用
7. 会议纪要 Demo 如何迁移到 ProductCraft / 合同审查 / 客服工单
```

最容易说错：

```text
用了 Tool Calling ≠ 做了 Agent
模型选择工具 ≠ 模型执行工具
checkQuality 是节点，不是 Loop 本身
reviseMinutes -> checkQuality 才形成 Loop
Multi-Agent 不是越多越强
模块 3 不讲 Persistence / Checkpoint / HITL
```
