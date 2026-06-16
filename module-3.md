# 模块 3 学习归档：Workflow、Agent、LangGraph 与 Multi-Agent

## 1. 模块目标

本模块目标是把模块 2 的 Structured Output 与 Tool Calling 放进更可控的 AI 应用流程里，掌握企业级 AI 应用中常见的 Workflow、Agent、LangGraph 和最小 Multi-Agent 设计方法。

本模块不追求复杂 Agent 框架堆叠，而是重点掌握：

1. Workflow：把 AI 任务拆成稳定、可观测、可测试的步骤。
2. Agent：让模型在局部不确定任务中参与下一步决策。
3. ReAct：理解 Model、Tool、Observation、Loop 的工程含义。
4. LangGraph：用 StateGraph、Node、Edge、Conditional Edge 和 Loop 表达可执行流程。
5. Multi-Agent：只做最小双 Agent 协作，例如“分析 Agent + 执行 Agent”。
6. Prompt 策略：把 Prompt 拆到节点里，而不是写一个万能大 Prompt。

本模块的 Demo 选择“企业会议纪要”作为低复杂度场景，但学习目标不是会议纪要本身，而是通用 AI Workflow 建模能力：

```text
输入
→ 抽取
→ 分析 / 规划
→ 生成
→ 质量检查
→ 条件路由
→ 受控修正
→ 基于结果的 Agent 问答
```

这套模式可以迁移到 ProductCraft PRD 生成、AI PDF / 合同审查、客服工单处理、报告生成和简历筛选等企业级 AI 应用。

## 2. 诊断结果与纠正点

### 2.1 开场诊断结果

开场诊断 5 题全部答对，说明已经具备模块 3 的入口理解：

```text
Workflow：适合步骤明确的任务
Agent：适合模型参与下一步决策
Observation：工具执行后的结果
State：流程共享数据
Multi-Agent：不要一开始复杂化
```

最初判断正确：

- ProductCraft / 会议纪要这类产物生成更适合先做可控 Workflow。
- Workflow 和 Agent 的区别在于流程控制权。
- Observation 是工具结果，不是用户输入或最终回答。
- State 是节点共享和更新的流程数据。
- Multi-Agent 不应该为了炫技而滥用。

### 2.2 Workflow 练习纠正点

用户最初回答：

> 只用一个 Prompt 生成 PRD 的问题是不可控，LLM 生成内容差距会很大。

纠正后完整理解：

- 不只是内容差距大。
- 更关键是不可拆解、不可观测、不可定位失败点。
- 输出差时不知道是需求理解、用户画像、功能规划还是最终表达出了问题。

正确表达：

> 一次性 Prompt 很难定位失败发生在哪一步；Workflow 可以把 AI 任务拆成多个节点，每个节点有明确输入输出，方便观测、重试、测试和优化。

### 2.3 State / Node 练习纠正点

最初对“节点读取哪些字段、更新哪些字段”不够清楚。

纠正后理解：

```text
生成节点：读原始材料，写中间结果
检查节点：读中间结果，写检查结果
控制节点：读检查结果，决定下一步
```

例子：

```text
extractDecisions 读取：rawTranscript
extractDecisions 更新：decisions

checkQuality 读取：summary、decisions、actionItems、risks
checkQuality 更新：qualityScore、qualityIssues、currentStep
```

核心句：

> State 是全局工作台，Node 是只负责一个步骤的小函数。

### 2.4 Conditional Edge / Loop 纠正点

用户一开始把 `checkQuality` 节点本身理解成 Loop。

纠正后理解：

- `checkQuality` 只是节点。
- `routeAfterQualityCheck` 是条件边。
- `reviseMinutes -> checkQuality` 这条回边才形成 Loop。

正确理解：

```text
checkQuality
→ routeAfterQualityCheck
→ reviseMinutes
→ checkQuality
```

这条链路体现的是：

```text
Conditional Edge + Loop + maxRetries
```

面试表达：

> 质量检查不通过时，我不会让模型无限自我修正，而是通过 Conditional Edge 决定是否进入修正节点，并用 retryCount / maxRetries 控制最大循环次数，避免成本、延迟和失败边界失控。

### 2.5 Agent / ReAct 纠正点

用户曾把 Act 表达成“模型工具调用”。

纠正后理解：

```text
Model Decision：模型选择工具
Act：代码执行工具
Observation：工具返回结果
Final Answer：基于 Observation 回答
```

关键边界：

> 模型只负责选择动作，工具执行必须由代码完成。

### 2.6 Multi-Agent 纠正点

当前 Demo 中：

```text
单 Agent：接入 AI SDK / DeepSeek，可用 LLM 选择工具
Multi-Agent：analysisAgent 已接 LLM（analyzeWithLLM）
```

LLM Multi-Agent 结构：

```text
analysisAgent
→ analyzeWithLLM（有 key 则 LLM，无 key 自动降级为规则匹配）
→ { requiredTools: [...], reason: "LLM 分析：..." }
→ executorAgent：执行多个只读工具，汇总 Observation
```

设计原则：

- analysisAgent 负责语义理解和意图拆解，适合 LLM。
- executorAgent 负责执行白名单工具，应继续由代码控制。
- LLM 调用失败或无 API key 时自动降级为 analysisAgentByRule，不会中断流程。

## 3. Workflow 核心知识点

### 3.1 Workflow 是什么

Workflow 是把复杂 AI 任务拆成一组明确步骤：

```text
每一步只做一件事
每一步有明确输入输出
每一步可以记录、检查、重试
流程顺序主要由代码控制
```

普通一次性 Prompt：

```text
用户输入 → LLM → 最终结果
```

Workflow：

```text
State → Node A → State 更新 → Node B → State 更新 → Node C → 最终结果
```

核心句：

> Workflow 负责流程可控，State 负责过程可见。

### 3.2 什么时候用 Workflow

适合 Workflow：

```text
业务步骤稳定
产物结构明确
需要质量检查
需要失败定位
需要控制重试和成本
```

例子：

```text
会议纪要
PRD 生成
合同审查
报告生成
客服工单处理
简历筛选
```

不适合直接上复杂 Agent 的原因：

- 路径不稳定。
- 成本不可控。
- 工具调用难约束。
- 失败难复现。
- 面试表达容易变成“让模型自己跑”。

### 3.3 通用 AI Workflow 模板

```text
Input：接收原始输入
Extract：抽取结构化信息
Analyze / Plan：分析或规划
Generate：生成业务产物
Validate：质量检查
Route：条件路由
Revise：根据问题修正
Answer：基于结果问答
```

通用图：

```text
Input
→ Extract
→ Analyze / Plan
→ Generate
→ Validate
→ Route
   → pass：Final Output
   → retry：Revise → Validate
   → fail：End with Issues
→ Agent Query
→ Tool Decision
→ Tool Execution
→ Observation
→ Answer
```

### 3.4 场景映射

会议纪要：

```text
会议记录
→ 摘要 / 决策 / 待办 / 风险
→ 会议纪要
→ 质量检查
→ 修正
```

ProductCraft：

```text
产品想法
→ 需求澄清 / 用户画像 / 功能规划
→ PRD
→ 质量检查
→ 修正
```

AI PDF / 合同审查：

```text
文档内容
→ 条款 / 风险 / 义务抽取
→ 审查报告
→ 质量检查
→ 修正
```

客服工单：

```text
用户问题
→ 意图分类 / 信息补全
→ 工具查询
→ 回复草稿
→ 质量检查
→ 升级人工或发送
```

简历筛选：

```text
简历内容
→ 技能 / 经历抽取
→ 岗位匹配分析
→ 面试建议
→ 质量检查
```

## 4. State / Node / Edge / Conditional Edge / Loop

### 4.1 State

State 是整条流程共享的数据工作台。

通常包含：

```text
原始输入：rawTranscript、productIdea、documentText
中间结果：summary、decisions、actionItems、risks
控制字段：currentStep、retryCount、maxRetries
质量字段：qualityScore、qualityIssues
最终输出：finalMinutes、prd、report
错误字段：error
```

会议纪要 Demo 中：

```ts
type MeetingWorkflowState = {
  rawTranscript: string;
  meetingTitle?: string;
  summary?: string;
  decisions?: string[];
  actionItems?: ActionItem[];
  risks?: string[];
  finalMinutes?: string;
  qualityScore?: number;
  qualityIssues?: string[];
  currentStep: string;
  retryCount: number;
  maxRetries: number;
  error?: string;
};
```

面试表达：

> State 是整条 AI Workflow 的共享上下文。每个节点只读取自己需要的字段，并返回局部更新。这样可以避免所有逻辑挤在一个 Prompt 里，也方便定位失败发生在哪个节点。

### 4.2 Node

Node 是流程里的一个处理步骤。

特点：

```text
读取 State 的部分字段
只完成一个职责
返回 Partial<State>
不应该随意重写整个 State
```

例子：

```text
summarizeMeeting：生成标题和摘要
extractDecisions：提取关键决策
extractActionItems：提取待办事项
detectRisks：识别风险
generateFinalMinutes：生成最终纪要
checkQuality：检查质量
reviseMinutes：修正纪要
```

### 4.3 Edge

Edge 表示固定流程顺序。

例子：

```text
summarizeMeeting
→ extractDecisions
→ extractActionItems
→ detectRisks
→ generateFinalMinutes
→ checkQuality
```

适合：

- 固定业务步骤。
- 不能乱序的流程。
- 面试中强调“流程由代码控制”。

### 4.4 Conditional Edge

Conditional Edge 是根据 State 决定下一步去哪。

例子：

```ts
function routeAfterQualityCheck(state) {
  if (state.qualityScore >= 80) return "end";
  if (state.retryCount < state.maxRetries) return "reviseMinutes";
  return "endWithIssues";
}
```

它不是生成节点，而是路由规则。

面试表达：

> 我把质量检查和流程路由拆开。checkQuality 只负责产出 qualityScore 和 qualityIssues，routeAfterQualityCheck 只负责根据这些字段决定下一步。这种拆法让生成逻辑、质量判断和流程控制分离，后续更容易测试和维护。

### 4.5 Loop

Loop = 条件边 + 回到前面某个节点 + 最大次数限制。

会议纪要 Demo：

```text
checkQuality
→ routeAfterQualityCheck
→ reviseMinutes
→ checkQuality
```

为什么要限制次数：

- 防止无限循环。
- 控制 token 成本。
- 控制响应时间。
- 让失败边界可解释。

面试表达：

> 质量检查不通过时，我不会让模型无限自我修正，而是通过 retryCount 和 maxRetries 限制循环次数。这样可以控制成本、延迟和失败边界，避免 Agent 一直跑下去。

## 5. Agent 与 ReAct

### 5.1 Agent 是什么

Agent 不是“会调用工具”这么简单。

Agent 的核心是：

```text
模型参与决定下一步动作
可能调用工具
读取 Observation
继续判断或输出答案
```

Workflow 和 Agent 区别：

```text
Workflow：代码决定流程
Agent：模型参与下一步决策
```

### 5.2 什么时候用 Agent

适合 Agent：

```text
不知道下一步该查哪个工具
用户问题路径不固定
需要模型根据上下文选择动作
需要基于工具结果继续回答
```

不适合 Agent：

```text
固定流程任务
简单一次性摘要
流程风险高但没有控制边界
为了显得高级而上 Agent
```

### 5.3 ReAct 工程含义

ReAct：

```text
Reason / Model Decision
→ Act
→ Observation
→ Reason / Final Answer
```

在 Demo4 中：

```text
Question：谁负责跑通 demo4？
Model Decision：decideToolWithAISDK 选择 getActionItems
Act：runMeetingTool 执行 getActionItems
Observation：返回待办事项
Final Answer：基于 Observation 回答
```

面试表达：

> ReAct 在工程上可以理解为 Model、Tool、Observation 的循环。模型先判断要做什么，代码执行工具，工具结果作为 Observation 返回给模型或后续逻辑，再基于 Observation 生成答案。核心是最终回答应该基于工具结果，而不是凭空编造。

### 5.4 Tool Calling 与 Agent 的区别

Tool Calling：

```text
模型可以调用工具。
```

Agent：

```text
模型围绕目标进行多步决策、工具调用、观察和继续判断。
```

结论：

> Tool Calling 是 Agent 的基础组件之一，但用了 Tool Calling 不等于一定做了 Agent。

## 6. LangGraph 核心知识点

### 6.1 LangGraph 是什么

LangGraph 是用图结构管理 Workflow / Agent 的工具。

核心概念：

```text
StateGraph：状态图
Node：节点
Edge：普通边
Conditional Edge：条件边
START / END：图的开始和结束
Loop：通过边回到已有节点
```

核心理解：

> LangGraph 不是替你想业务流程，而是帮你把业务流程声明成一张可执行的图。

### 6.2 手写 Workflow 与 LangGraph 的对应关系

```text
MeetingWorkflowState = LangGraph State
summarizeMeeting / checkQuality = Node
固定执行顺序 = Edge
routeAfterQualityCheck = Conditional Edge
while 循环 = Loop
```

### 6.3 LangGraph 最小 Demo

路径：

```text
/Users/elvis/Desktop/21DaysLLMLearning/demo4/src/langgraph-minimal.ts
```

能力：

- 定义 State。
- 注册节点。
- 注册普通边。
- 注册条件边。
- 修正节点回到质量检查，形成 Loop。
- 不接 LLM，只验证图结构。

运行：

```bash
cd /Users/elvis/Desktop/21DaysLLMLearning/demo4
npm run langgraph
```

验证结果：

```text
LangGraph Quality Score: 90
LangGraph Quality Issues: []
LangGraph Retry Count: 1
```

### 6.4 模块边界

模块 3 只学习：

```text
State
Node
Edge
Conditional Edge
Loop
最大循环次数
节点错误意识
```

暂不展开：

```text
Persistence
Checkpoint
threadId
Resume
Human-in-the-loop
```

这些留到模块 4。

## 7. Multi-Agent 最小协作

### 7.1 为什么不滥用 Multi-Agent

Multi-Agent 不等于越多越强。

滥用风险：

- 成本上升。
- 调试困难。
- 上下文膨胀。
- 责任边界不清。
- 输出不稳定。

适合 Multi-Agent：

```text
任务天然存在不同职责
需要先分析再执行
多个 Agent 的 Prompt 明显不同
拆分后更容易观察、测试和维护
```

不适合：

```text
一个工具就能解决
一个 Prompt 就能解决
只是为了显得高级
多个 Agent 做同一件事
```

### 7.2 Demo4 的 Multi-Agent

Demo4 的 Multi-Agent 已接入 LLM（analysisAgent → analyzeWithLLM）：

```text
analysisAgent：调用 LLM 分析用户问题，返回 requiredTools + reason
executorAgent：执行多个只读工具，收集 Observation
```

例子：

```text
用户问：谁负责 demo4？另外有什么风险？

analysisAgent：
requiredTools = ["getActionItems", "getRisks"]

executorAgent：
执行 getActionItems
执行 getRisks
汇总 Observation
```

### 7.3 LLM Multi-Agent 已实现

Multi-Agent 的 analysisAgent 已接入 LLM（`analyzeWithLLM`）：

```text
analysisAgent(question)
→ analyzeWithLLM(question)
  → 有 API key: LLM 返回 { tools: [...], reason: "..." }
  → 无 API key / 失败: 自动降级为 analysisAgentByRule（规则匹配）
→ executorAgent 执行白名单工具并汇总 Observation
```

executorAgent 仍然由代码执行白名单工具，不直接调用 LLM。

降级策略：

- 配置了 `.env.local` 中的 DeepSeek key → LLM 分析
- 没配置 key 或 LLM 调用失败 → 自动降级为规则匹配
- 两种路径的 Trace 中 reason 字段会标注 "LLM 分析" 或 "规则分析"

面试表达：

> 我会优先把 Multi-Agent 做成规则版，先验证职责拆分是否合理。需要更强语义理解时，再把 analysisAgent 升级为 LLM + Structured Output，让模型只输出 requiredTools 和 reason。同时必须保留规则版作为 fallback，避免 LLM 不可用时流程中断。executorAgent 仍然由代码执行白名单工具，这样可以兼顾灵活性和可控性。

## 8. Prompt 策略

### 8.1 Node Prompt 单一职责

每个 Node 的 Prompt 只做一件事：

```text
摘要节点：只生成摘要
决策节点：只提取决策
待办节点：只提取待办
质量节点：只检查质量
修正节点：只针对质量问题修正
```

不要写一个万能 Prompt：

```text
请总结会议、提取决策、生成待办、判断风险、写最终纪要、检查质量、自动修正。
```

### 8.2 State 输入边界

传给模型的不是整个 State，而是当前节点需要的字段。

例子：

```text
checkQuality：
需要 summary、decisions、actionItems、risks、finalMinutes

reviseMinutes：
需要 finalMinutes、qualityIssues、必要的 summary / decisions / actionItems / risks
```

好处：

- 减少 token。
- 降低噪声。
- 减少模型漂移。
- 失败更容易定位。

### 8.3 Tool Decision Prompt

Agent 选择工具时，Prompt 要限制输出。

当前 Demo：

```text
只允许返回 getSummary / getDecisions / getActionItems / getRisks
```

更好的升级方式：

```json
{
  "tool": "getActionItems"
}
```

或 Multi-Agent：

```json
{
  "requiredTools": ["getActionItems", "getRisks"],
  "reason": "用户同时询问负责人和风险"
}
```

### 8.4 Loop Prompt

修正节点不要从零重写。

应该输入：

```text
当前 finalMinutes
qualityIssues
必要的中间结果
```

面试表达：

> 修正类 Prompt 不应该让模型从零重写，而应该给它当前版本、质量问题和必要的结构化中间结果，让它针对缺口做最小修正。这样能降低 token 消耗，也能避免每次修正都把原本正确的内容改坏。

## 9. 选型判断

遇到 AI 应用需求，先问 4 个问题：

```text
1. 业务步骤是否稳定？
2. 下一步是否需要模型动态判断？
3. 是否需要分支、循环、质量检查？
4. 是否真的存在多个不同职责？
```

对应选择：

```text
简单一次性任务 → 普通 LLM 调用
步骤稳定 → Workflow
下一步动作不确定 → Agent
状态 / 分支 / 循环明显 → LangGraph
职责天然不同 → Multi-Agent
```

判断表：

| 场景 | 首选方案 | 原因 |
| --- | --- | --- |
| 把一段文字压缩成 100 字摘要 | 普通 LLM 调用 | 一次性、低风险、无复杂流程 |
| 会议纪要、PRD、报告生成 | Workflow | 步骤稳定，质量可检查 |
| 不知道查订单、查知识库还是转人工 | Agent | 需要模型选择动作 |
| 质量检查失败后修正一次 | LangGraph / Workflow Loop | 需要条件边和最大次数 |
| 用户同时问负责人、风险、决策 | Multi-Agent | 先分析多意图，再执行多个工具 |

面试表达：

> 我会先判断任务复杂度，而不是默认上 Agent。简单摘要用普通 LLM 调用；步骤稳定的业务流程用 Workflow；需要模型动态选择工具时用 Agent；流程有状态、分支和循环时用 LangGraph；只有当任务天然存在分析、执行、审查等不同职责时，才引入最小 Multi-Agent。

## 10. 本模块 Demo 状态

### demo4：Workflow / Agent / LangGraph / Multi-Agent

路径：

```text
/Users/elvis/Desktop/21DaysLLMLearning/demo4
```

能力：

- 手写 Workflow Demo。
- Next 可视化页面。
- AI SDK / DeepSeek 工具选择 Agent。
- LangGraph 最小 Demo。
- LLM Multi-Agent 协作 Demo（analysisAgent 接 LLM，无 key 自动降级规则）。
- SSE 流式 Trace。
- Learning context 和面试表达辅助区。

技术栈：

- Next.js App Router。
- TypeScript。
- Vercel AI SDK。
- DeepSeek OpenAI-compatible 接入。
- LangGraph.js。
- Zod。
- Node test runner。

关键文件：

```text
/Users/elvis/Desktop/21DaysLLMLearning/demo4/src/workflow-core.ts
/Users/elvis/Desktop/21DaysLLMLearning/demo4/src/langgraph-minimal.ts
/Users/elvis/Desktop/21DaysLLMLearning/demo4/src/index.ts
/Users/elvis/Desktop/21DaysLLMLearning/demo4/app/page.tsx
/Users/elvis/Desktop/21DaysLLMLearning/demo4/app/api/demo/route.ts
/Users/elvis/Desktop/21DaysLLMLearning/demo4/tests/multi-agent.test.ts
```

运行页面：

```bash
cd /Users/elvis/Desktop/21DaysLLMLearning/demo4
npm run dev
```

页面地址：

```text
http://localhost:3000
```

CLI 验证：

```bash
npm run dev:no-env
npm run langgraph
npm run test:multi-agent
```

已验证：

```text
npm run test:multi-agent：通过
npm run langgraph：通过
npm run dev:no-env：通过
```

说明：

```text
npm run build 曾因 .next/trace-build 写权限被沙箱拒绝，之前有一次构建通过；最终改动后未再次完成构建验证。
Multi-Agent 的 analysisAgent 已接 LLM（analyzeWithLLM），无 key 时自动降级规则匹配。
当前 Demo 是学习型可视化 Demo，不是完整生产系统。
Persistence / Checkpoint / HITL 未展开，留到模块 4。
```

## 11. 面试表达草稿

### 11.1 30 秒版本

> 我做了一个模块 3 Demo，把 AI 任务建模成可控 Workflow：输入、抽取、生成、质量检查、条件路由和受控修正。外层流程由代码控制，局部不确定任务用 Agent 做工具选择，复杂状态和循环用 LangGraph 表达，Multi-Agent 只做最小的分析 Agent + 执行 Agent。

### 11.2 60 秒版本

> 这个 Demo 的重点不是会议纪要业务本身，而是通用 AI Workflow 设计。会议原文先进入 Workflow，经过摘要、决策、待办、风险、纪要生成和质量检查等节点；质量不通过时，通过 Conditional Edge 进入 reviseMinutes，并用 maxRetries 防止无限循环。之后用户可以基于结果提问，单 Agent 用 AI SDK / DeepSeek 选择工具，工具执行由代码完成，Observation 再用于回答。Multi-Agent 部分只做最小职责拆分：analysisAgent 判断需要哪些信息，executorAgent 执行多个工具并汇总结果。

### 11.3 项目经历版本

> 我在模块 3 中实现了一个可视化 AI Workflow Demo。它包含手写 Workflow、LangGraph 最小图、AI SDK 工具选择 Agent 和 LLM Multi-Agent（analysisAgent 接 LLM，无 key 自动降级规则）。通过前端页面可以看到每一步 Trace、State 变化、质量检查、修正循环和 Agent 工具选择过程。这个 Demo 可以迁移到 ProductCraft PRD 生成、AI PDF 合同审查、客服工单处理等场景。

## 12. 高频面试题

### 题 1：Workflow 和 Agent 的区别是什么？

答：

> Workflow 是代码控制流程，适合步骤明确、稳定可预测的任务；Agent 是模型参与下一步决策，适合路径不确定、需要工具选择或多步推理的任务。在 Demo4 中，主流程用 Workflow，用户基于结果提问时用 Agent 选择工具。

### 题 2：为什么外层不用完全自主 Agent？

答：

> 因为产物生成通常有稳定业务步骤，比如抽取、分析、生成和质量检查。用 Workflow 可以让每个节点输入输出可观测、可测试、可重试。Agent 只放在局部不确定任务里，比如根据用户问题选择查询哪个工具。

### 题 3：State 在 Workflow / LangGraph 中有什么作用？

答：

> State 是整条流程共享的数据工作台，保存原始输入、中间结果、控制字段、质量结果和最终输出。每个节点读取需要的字段，并返回局部更新。这样失败时可以定位是哪一个节点出了问题。

### 题 4：Node 应该怎么设计？

答：

> Node 应该职责单一，只读取必要 State 字段，并返回 Partial<State>。比如摘要节点只生成 summary，质量检查节点只生成 qualityScore 和 qualityIssues，不应该一个节点同时完成所有任务。

### 题 5：Conditional Edge 是什么？

答：

> Conditional Edge 是根据 State 决定下一步走向的路由规则。比如质量检查后，如果 qualityScore 达标就结束；如果不达标且 retryCount 小于 maxRetries，就进入修正节点；如果达到上限，就带问题结束。

### 题 6：为什么要限制 Loop 次数？

答：

> AI 流程如果没有最大循环次数，可能在检查失败和修正之间无限运行，导致 token 成本、延迟和用户等待时间失控。所以我会用 retryCount 和 maxRetries 控制循环边界。

### 题 7：ReAct 的工程含义是什么？

答：

> ReAct 可以理解为 Model、Tool、Observation 的循环。模型先判断要做什么，代码执行工具，工具结果作为 Observation 返回，再基于 Observation 生成答案。关键是最终回答要基于工具结果，而不是凭空编造。

### 题 8：Tool Calling 和 Agent 有什么区别？

答：

> Tool Calling 是模型调用工具的能力，重点在工具定义、参数校验和执行。Agent 是围绕目标进行多步决策的流程，可能包含多次工具选择、Observation 和循环。Tool Calling 是 Agent 的基础组件之一，但有工具调用不等于一定是 Agent。

### 题 9：LangGraph 解决了什么问题？

答：

> LangGraph 用图结构组织 Workflow / Agent，核心是 StateGraph、Node、Edge、Conditional Edge 和 Loop。相比手写 if/while，它更适合表达复杂但仍需要可控的 AI 流程。

### 题 10：什么时候适合 Multi-Agent？

答：

> 当任务天然存在不同职责，并且拆分后更清晰时，才适合 Multi-Agent。比如分析 Agent 负责拆解用户意图，执行 Agent 负责调用工具和汇总 Observation。如果一个工具或一个 Prompt 就能解决，就不应该为了炫技拆多个 Agent。

### 题 11：如何控制 Agent 成本和风险？

答：

> 我会限制工具白名单，控制每轮最大 token，设置最大循环次数，并尽量让模型输出结构化结果。对于副作用工具要加审批或人工确认；对于只读工具，也要记录工具调用日志和 Observation，方便排查问题。

### 题 12：如何把模块 2 放进模块 3？

答：

> 模块 2 的 Structured Output 和 Tool Calling 是模块 3 的基础。Structured Output 可以作为节点输出契约，Tool Calling 可以作为 Agent 的动作能力。模块 3 则进一步负责把这些能力组织成 Workflow、条件分支、修正循环和局部 Agent 决策。

### 题 13：Multi-Agent 为什么不应该滥用？

答：

> Multi-Agent 会增加上下文成本、调试难度和责任边界复杂度。如果任务本身没有明显职责分工，一个 Agent 或一个 Workflow 就能解决，就不应该拆多个 Agent。Multi-Agent 应该服务于清晰分工，而不是服务于炫技。

### 题 14：Multi-Agent 的 analysisAgent 如何接 LLM？

答：

> 我会优先升级 analysisAgent，让它用 LLM + Structured Output 输出 requiredTools 和 reason。executorAgent 仍然由代码执行白名单工具并汇总 Observation。这样既利用模型理解复杂问题的能力，也避免模型越权调用工具。

### 题 15：模块 3 的通用能力是什么？

答：

> 模块 3 的通用能力是把 AI 任务建模成可控图流程：输入、抽取、分析、生成、质量检查、条件路由、受控修正和基于结果的 Agent 问答。这套结构可以迁移到 PRD 生成、合同审查、客服工单、报告生成等企业场景。

## 13. 项目设计题

### 题目

请设计一个“ProductCraft PRD 生成 Workflow”，要求包含 Workflow、Agent、LangGraph 和最小 Multi-Agent 的设计说明。

### 标准答题结构

#### 1. Workflow 主链路

```text
产品想法
→ 需求澄清
→ 信息充分性判断
→ 用户画像
→ 功能规划
→ PRD 生成
→ 质量检查
→ 通过 / 修正 / 带问题结束
```

#### 2. State 设计

```text
rawIdea
clarifyingQuestions
enoughInfo
personas
features
prdDraft
qualityScore
qualityIssues
retryCount
maxRetries
finalPrd
```

#### 3. Node 设计

```text
clarifyRequirements
judgeInfoEnough
generatePersonas
planFeatures
generatePrd
checkQuality
revisePrd
```

#### 4. Conditional Edge

```text
judgeInfoEnough：
enough → generatePersonas
notEnough → askUserMore

checkQuality：
qualityScore >= 80 → END
qualityScore < 80 && retryCount < maxRetries → revisePrd
qualityScore < 80 && retryCount >= maxRetries → END_WITH_ISSUES
```

#### 5. Agent 位置

适合放 Agent 的地方：

```text
竞品查询：根据 PRD 方向选择 searchCompetitors
用户追问：根据问题选择查 personas / features / prdDraft
质量分析：判断 PRD 缺少哪类信息
```

#### 6. Multi-Agent 最小设计

```text
analysisAgent：
分析用户追问或 PRD 缺口，需要查哪些信息

executorAgent：
执行只读工具或读取 State 字段，汇总 Observation
```

#### 7. 面试表达

> ProductCraft 的 PRD 生成任务有明确业务步骤，所以外层用 Workflow 控制流程；质量检查和修正通过 Conditional Edge 和 Loop 完成；工具选择或用户追问这种局部不确定任务用 Agent；如果问题包含多个意图，再使用最小 Multi-Agent，把分析和执行拆开。

## 14. 掌握度判断

### 已掌握

- 能区分普通 LLM 调用、Workflow、Agent、LangGraph 和 Multi-Agent。
- 能解释 State、Node、Edge、Conditional Edge、Loop。
- 能解释 ReAct 中 Model Decision、Act、Observation 的工程含义。
- 能写出受控修正循环，并用 maxRetries 控制边界。
- 能用 LangGraph 表达最小图流程。
- 能解释为什么 Multi-Agent 不应滥用。
- 能把会议纪要 Demo 抽象成通用 AI Workflow 模板。

### 仍需加强

- Multi-Agent 的 analysisAgent 已接 LLM（analyzeWithLLM），失败时自动降级为规则匹配。
- 前端页面是学习型 Demo，不是生产级系统。
- Persistence、Checkpoint、Resume、HITL 尚未学习，留到模块 4。
- 需要继续练习把同一套 Workflow 模板迁移到 ProductCraft、AI PDF、客服工单等场景。

### 当前判断

模块 3 满足完成标准：

```text
核心概念掌握：通过
项目代码完成：通过
功能可以运行：通过
练习通过：通过
章节总结完成：通过
高频面试题完成：通过
```

结论：

```text
模块 3 可以标记为完成。
```
