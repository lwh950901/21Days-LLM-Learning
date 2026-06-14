# 模块 1：LLM 与 AI SDK 核心基础完整学习归档

## 一、模块目标

模块 1 的目标不是学习所有 AI 理论，而是掌握企业级 AI 应用开发中最基础、最常用的 LLM 调用链路。

完成本模块后，需要能做到：

- 说清用户输入到模型返回的完整链路。
- 区分 `system / user / assistant` messages。
- 理解模型无状态，以及为什么多轮对话要由应用层管理上下文。
- 区分 `UIMessage` 和 `ModelMessage`。
- 理解 Vercel AI SDK 的作用。
- 判断 `generateText` 和 `streamText` 的适用场景。
- 说清 Streaming 从模型到前端页面的完整数据流。
- 理解 `ReadableStream`、SSE、前端增量渲染。
- 理解 Abort 停止生成。
- 具备错误、超时、重试、token 成本、provider / model 切换意识。

## 二、诊断结果与纠正点

学习前的诊断题暴露出几个关键薄弱点：

1. 容易把基础 LLM 调用链路和 Tool Calling / ReAct / Agent 混在一起。
2. 曾误以为长文本更适合 `generateText`，实际要看是否需要实时交互。
3. 曾把 `streamText` 放到前端理解，实际 `streamText` 是后端调用，前端负责接收流并增量渲染。
4. 曾把停止生成理解成再发一条“请停止”的 user message，实际应中断当前请求。
5. 对 RAG、rerank、Agent 有工程意识，但模块 1 不展开这些内容，先聚焦最小调用链路。

纠正后的核心边界：

- 模块 1：LLM 调用、messages、Streaming、Abort、错误处理、token 成本、模型切换。
- 模块 2：Structured Output、Tool Calling。
- 模块 3：Workflow、Agent、LangGraph。
- RAG、rerank、复杂检索系统不作为模块 1 的重点。

## 三、LLM API 请求流程

企业级 AI 应用中的最小 LLM 请求流程：

```text
用户在前端输入业务问题
→ 前端发送请求到后端 API
→ 后端校验参数
→ 后端组织 system / user / history messages
→ 后端调用模型 provider
→ 模型返回文本或流式结果
→ 后端把结果返回给前端
→ 前端展示 loading / generating / done / error / stopped 状态
```

以 AI PDF 助手为例：

```text
用户输入：总结这份合同的风险点
→ 前端 POST /api/chat
→ 后端拿到用户问题和文档上下文
→ 后端构造 messages
→ 调用模型
→ 返回合同风险总结
→ 前端逐步展示
```

基础链路暂不包含 Tool Calling。Tool Calling 会多出：

```text
模型决定调用工具
→ 后端执行工具
→ 工具结果再放回 messages
→ 模型继续生成
```

这是模块 2 的内容。

## 四、Messages 分工

### 1. system message

`system` 放长期稳定规则，告诉模型“应该如何工作”。

适合放：

- 模型角色。
- 任务边界。
- 输出格式。
- 安全限制。
- 不确定时如何回答。
- 语气和业务风格。

示例：

```text
你是一个企业级 AI PDF 助手。你必须严格基于后端提供的文档上下文回答问题。
不要编造。若文档上下文中没有答案，请回答：“根据提供的文档，无法找到该信息。”
风险点请使用 [风险提示] 标记。
```

不适合放：

- 用户当前这一次具体问题。
- 每轮变化的临时输入。
- 未经过筛选的超长 PDF 全文。

### 2. user message

`user` 放用户当前这一次任务。

示例：

```text
这份采购合同有哪些交付风险？
```

真实项目里，后端可以包装 user message，例如加入相关文档片段：

```text
用户问题：
这份采购合同有哪些交付风险？

相关文档片段：
1. 供应商应在订单确认后尽快完成交付。
2. 验收标准为“甲方满意”。
```

注意：可以补充上下文和格式要求，但不要偷偷改变用户意图。

### 3. assistant message

`assistant` 放历史模型回复，用于多轮对话。

例如第一轮：

```text
user: 这份采购合同有哪些交付风险？
assistant: 主要有两个风险：交付日期不明确、验收标准不可量化。
```

第二轮用户问：

```text
第二个风险怎么改？
```

此时必须把上一轮 assistant 回复一起传给模型，否则模型不知道“第二个风险”指什么。

## 五、模型无状态

LLM API 本身是无状态的。

意思是：

```text
模型不会自动记住上一轮对话。
每一次请求，模型只能看到本次传入的 messages。
```

所以多轮对话不是模型自动提供的，而是应用层管理出来的。

企业级 AI 应用通常需要保存：

- `chatId`：当前会话。
- `userId`：当前用户。
- `documentId / projectId`：关联业务对象。
- `messages`：历史 user / assistant 对话。
- `businessContext`：PDF 片段、产品需求、客服对话等。
- `status`：生成中、完成、失败、已停止。

上下文不是越多越好。工程上需要控制：

- 短对话：带最近 N 轮 messages。
- 长对话：历史摘要 + 最近几轮。
- 文档问答：只带与当前问题相关的片段。

## 六、UIMessage 与 ModelMessage

### 1. UIMessage

`UIMessage` 面向前端展示和持久化。

它可能包含：

- `id`
- `role`
- `parts`
- `createdAt`
- `metadata`
- `status`
- `documentId`

它更关心 UI 如何渲染、如何保存、如何更新某条消息。

### 2. ModelMessage

`ModelMessage` 面向模型调用。

它只保留模型需要理解的内容：

- `system`
- `user`
- `assistant`
- 必要上下文

不应该把 UI 层的 `id`、`createdAt`、`metadata` 等字段全部原封不动丢给模型。

### 3. 常见链路

```text
前端 UIMessage[]
→ 后端接收并校验
→ convertToModelMessages(UIMessage[])
→ streamText({ messages: ModelMessage[] })
→ toUIMessageStreamResponse()
→ 前端继续用 UIMessage 展示
```

## 七、AI SDK 的作用

AI SDK 不是让模型更聪明，而是帮助开发者标准化 AI 应用工程链路。

不用 AI SDK 时，很多事情要自己处理：

- 不同 provider 的请求格式。
- 普通响应和流式响应。
- `ReadableStream / SSE`。
- 前端增量渲染协议。
- 停止生成。
- 错误处理。
- 消息格式转换。
- provider / model 切换。

使用 Vercel AI SDK 后，可以更关注业务逻辑：

- 如何组织上下文。
- 如何校验权限。
- 如何控制 token 成本。
- 如何处理错误状态。
- 如何设计用户体验。

面试表达：

```text
我使用 AI SDK 的原因不是简单封装 fetch，而是为了标准化模型调用、流式输出、前端消息协议和 provider 切换。
这样业务代码可以聚焦在上下文组织、权限校验、错误处理和用户体验上。
```

## 八、generateText 与 streamText

### 1. generateText

特点：

```text
请求发出
→ 等模型完整生成
→ 一次性拿到 text
→ 再返回给前端
```

适合：

- 后台任务。
- 短文本生成。
- 批处理摘要。
- 用户不在页面等待的任务。

### 2. streamText

特点：

```text
请求发出
→ 模型边生成边返回 chunk
→ 后端边转发
→ 前端边渲染
→ 用户可以看到生成过程，也可以停止
```

适合：

- 聊天。
- 长报告。
- AI PDF 总结。
- 合同风险分析。
- PRD / 产品分析生成。
- 用户正在页面等待的任务。

关键判断：

```text
长文本如果是用户实时等待，优先 streamText。
长文本如果是后台批处理，可以 generateText。
```

## 九、Streaming 完整数据流

Streaming 不是模型直接把字写到页面上，中间有完整链路：

```text
用户点击“生成”
→ 前端发送请求，并进入 generating 状态
→ 后端组织 messages
→ 后端调用 streamText
→ 模型开始生成 token / chunk
→ AI SDK 把模型输出包装成流
→ 后端返回 stream response
→ 前端接收流式数据
→ 前端逐步更新 assistant message
→ 生成完成后状态变成 done
```

更工程化的链路：

```text
Browser
→ POST /api/chat
→ Next.js Route Handler
→ streamText({ model, messages })
→ result.toUIMessageStreamResponse()
→ HTTP streaming response
→ useChat / 前端 reader 接收 chunk
→ UIMessage.parts 增量更新
→ React 重新渲染
```

Streaming 的价值：

- 更快看到首字。
- 长任务不显得卡死。
- 可以展示生成状态。
- 可以支持停止生成。
- 错误可以更早暴露。

Streaming 的边界：

- 后台批处理不一定需要。
- 很短的分类任务不一定需要。
- 需要严格一次性 JSON 解析时要谨慎。

## 十、ReadableStream 与 SSE

`ReadableStream` 是浏览器 / Node 中的底层可读数据流。

`SSE` 是 Server-Sent Events，一种基于 HTTP 的服务端事件推送格式。

可以这样理解：

```text
ReadableStream 更底层。
SSE 是一种约定好的文本事件协议。
```

在 AI SDK 项目中，通常不需要直接手写完整 SSE。

更常见是：

```text
streamText 负责生成服务端流
toUIMessageStreamResponse 负责转成前端能消费的响应
前端 useChat 或 reader 负责接收并增量渲染
```

面试表达：

```text
Streaming 不是一次性 JSON 返回，而是后端保持 HTTP 流式响应，前端不断读取 chunk 并更新 UI。
ReadableStream 是底层数据流接口，SSE 是常见服务端事件推送协议。
```

## 十一、前端增量渲染

前端收到 chunk 后，不应该每个 chunk 新增一条 assistant message。

错误做法：

```text
assistant: 这份
assistant: 合同
assistant: 存在两个
assistant: 交付风险
```

正确做法：

```text
先创建一条 assistant message
→ 后续 chunk 持续追加到这条 message 的 content 或 parts
```

状态也要同步维护：

- `idle`
- `generating`
- `done`
- `error`
- `stopped`

企业级 AI 应用还需要：

- 输入框是否禁用。
- 发送按钮 / 停止按钮切换。
- 当前 assistant message 是否正在生成。
- 错误提示。
- 停止后的部分内容保留。

## 十二、Abort 停止生成

停止生成不是给模型再发一条 user message：

```text
请停止生成。
```

正确做法是中断当前请求。

完整链路：

```text
用户点击“停止生成”
→ 前端调用 stop() 或 AbortController.abort()
→ 当前 HTTP streaming 请求被中断
→ 后端感知 request.signal 已 aborted
→ AI SDK / provider 停止继续消费或生成
→ 前端保留已经生成的部分内容
→ 状态从 generating 变成 stopped
```

更稳妥的表达：

```text
后端感知 abort signal 后，中断当前模型调用或停止继续消费模型输出。
```

因为不同 provider 对取消请求的支持程度可能不同。

## 十三、错误、超时和重试

AI 应用不能只处理 happy path。

常见错误：

- 参数错误：messages 格式不对、缺少 model。
- 鉴权错误：API key 错误或过期。
- 限流错误：请求太频繁。
- 超时错误：模型生成太慢。
- 网络错误：请求中断。
- 内容错误：模型返回空内容或不符合预期。

前端状态至少要区分：

- `generating`
- `done`
- `error`
- `timeout`
- `stopped`

重试策略：

- 用户主动停止：不重试。
- 429 rate limit：谨慎退避重试。
- 参数错误：不重试。
- API key 错误：不重试。
- 网络临时错误：可有限重试。

面试表达：

```text
我不会只做 happy path。AI 应用里模型调用要区分生成中、完成、失败、超时和用户停止。
后端需要捕获 provider 错误，并区分 abort、timeout、rate limit 等场景。
重试要有限制，只对临时错误重试，不对参数错误、鉴权错误或用户主动停止重试。
```

## 十四、Token、上下文和成本

Token 可以理解为模型处理文本的基本单位。

```text
成本 ≈ 输入 token + 输出 token × 模型单价
```

不能把所有内容都塞给模型。

错误做法：

```text
用户上传 100 页合同后，每次提问都把全文、所有历史消息、完整 system prompt 一起发给模型。
```

问题：

- 成本高。
- 延迟高。
- 可能超过上下文窗口。
- 无关内容会干扰回答。
- 输入占满后，模型没有足够输出空间。

改法：

- 只选择与当前问题相关的业务上下文。
- 历史对话只保留最近几轮。
- 长历史做摘要。
- system prompt 保持稳定简洁。
- 给输出预留 token 空间。
- 设置合理最大输出长度和超时策略。

RAG、rerank 可以作为后续能力，但模块 1 先建立上下文预算意识。

## 十五、Provider 和模型切换

Provider 是模型服务商。

例如：

- OpenAI
- Anthropic
- Google
- DeepSeek
- Groq

Model 是服务商下面的具体模型。

工程上不建议在每个接口里写死模型：

```text
model: openai("gpt-4o-mini")
```

更推荐抽象成：

```text
fast model：快速问答
quality model：复杂分析
cheap model：批量摘要
```

好处：

- 控制成本。
- 控制延迟。
- 控制质量。
- 方便切换 provider。
- 方便故障兜底。
- 方便不同业务场景选择不同模型。

本模块 Demo 已按 DeepSeek 接入：

- `deepseek-v4-flash`
- `deepseek-v4-pro`

## 十六、模块 1 Demo 状态

代码路径：

```text
/Users/elvis/Desktop/21DaysLLMLearning/part1
```

技术栈：

- Next.js
- TypeScript
- Vercel AI SDK
- DeepSeek API
- `deepseek-v4-flash`
- `deepseek-v4-pro`

Demo 能力：

- 前端输入业务问题。
- 后端组织 messages。
- 调用 DeepSeek 模型。
- 使用 `streamText` 流式返回。
- `UIMessage` 转 `ModelMessage`。
- 前端增量渲染。
- 支持停止生成。
- 错误提示。
- 状态展示。
- 模型配置抽离。

测试状态：

```text
DeepSeek API / 模型接入：已处理
测试：已通过
```

## 十七、面试表达草稿

### 1. LLM 调用链路

我做 AI 应用时不会让前端直接裸调模型，而是通过后端统一组织调用链路。前端负责收集用户输入和展示状态，后端负责校验参数、组织 system / user / history messages、调用模型 provider，并把结果以普通响应或流式响应返回前端。这样更方便做权限控制、上下文管理、错误处理和模型切换。

### 2. Streaming 与用户体验

在长文本生成场景，比如合同风险分析、PDF 总结、客服质检总结或 PRD 生成中，我会优先使用 Streaming。后端通过 Vercel AI SDK 的 `streamText` 接收模型增量输出，再返回给前端；前端把 chunk 追加到同一条 assistant message 上，实现增量渲染。这样用户能更快看到首字，也能中途停止生成。

### 3. 无状态与上下文管理

我理解 LLM API 本身是无状态的，多轮对话不是模型自动记住的，而是应用层通过 `chatId`、history messages 和业务上下文管理出来的。比如用户第二轮问“第二个风险怎么改”，后端必须带上第一轮问题和模型回答，否则模型不知道“第二个风险”指什么。

### 4. 错误、停止与状态展示

我会把 AI 生成流程设计成明确的状态机，比如 `idle / generating / done / stopped / error`。用户点击停止时，不是再发一条“请停止”的 prompt，而是通过 `AbortController` 或 AI SDK UI 的 `stop()` 中断当前流式请求，并保留已生成内容。错误场景则要区分参数错误、限流、超时、网络错误和用户主动停止。

### 5. 模型切换与成本控制

我不会把具体模型名散落在业务代码里，而是把 provider 和 model 抽象到配置层。业务代码只表达它需要 fast、quality 或 cheap 这类能力，再由配置映射到具体模型。这样便于根据成本、延迟、质量和可用性做模型切换，也方便后续接入不同 provider。

## 十八、高频面试题

### 1. 一个 AI 应用从用户输入到模型返回，完整链路是什么？

考点：

- 是否理解 AI 应用不是前端直接调模型。
- 是否知道后端要组织 messages。
- 是否能说出状态展示和错误处理。

参考答案：

```text
前端收集用户输入，发送到后端 API；后端校验参数，组织 system / user / history messages，调用模型 provider；
模型返回普通文本或流式结果；后端把结果转成前端可消费的响应；前端展示 loading、generating、done、error、stopped 等状态。
```

追问：

```text
为什么不建议前端直接调用模型 API？
```

回答要点：

- API key 不能暴露在前端。
- 后端需要做权限校验。
- 后端需要组织上下文。
- 后端需要统一错误处理和日志。
- 后端方便做模型切换和成本控制。

### 2. `system`、`user`、`assistant` message 分别放什么？

考点：

- 是否理解 messages 的角色分工。
- 是否知道多轮对话需要历史 assistant message。

参考答案：

```text
system 放长期稳定规则，比如角色、边界、输出格式和安全限制。
user 放当前这一次用户任务。
assistant 放历史模型回复，用于多轮对话上下文。
```

追问：

```text
如果用户第二轮问“第二个风险怎么改”，为什么要带上上一轮 assistant message？
```

回答要点：

- 模型无状态。
- “第二个风险”依赖上一轮回答。
- 不带历史，模型无法解析指代。
- 后端需要重新组装必要上下文。

### 3. 为什么说 LLM API 是无状态的？

考点：

- 是否理解多轮对话由应用层管理。
- 是否知道 chatId / messages / businessContext 的作用。

参考答案：

```text
模型不会自动记住上一轮请求。每次调用时，模型只能看到本次传入的 messages。
因此多轮对话需要应用层保存 chatId、历史 messages 和业务上下文，并在每次请求时重新组装必要上下文。
```

追问：

```text
是不是历史越多越好？
```

回答要点：

- 不是。
- 历史越多 token 成本越高。
- 可能超过上下文窗口。
- 无关历史会干扰模型。
- 应保留最近几轮，长历史做摘要。

### 4. `UIMessage` 和 `ModelMessage` 有什么区别？

考点：

- 是否区分前端消息和模型输入。
- 是否知道不能把 UI 字段全部传给模型。

参考答案：

```text
UIMessage 面向前端展示和持久化，可能包含 id、parts、createdAt、metadata、status。
ModelMessage 面向模型调用，只保留模型需要理解的 system / user / assistant 内容。
使用 AI SDK 时，后端通常通过 convertToModelMessages 把 UIMessage 转成 ModelMessage。
```

追问：

```text
为什么不直接把 UIMessage 原样传给模型？
```

回答要点：

- UI 字段对模型无意义。
- 会浪费 token。
- 可能污染 prompt。
- 不利于控制上下文。

### 5. `generateText` 和 `streamText` 怎么选？

考点：

- 是否知道选择依据不是单纯文本长短。
- 是否能结合交互场景判断。

参考答案：

```text
generateText 适合后台任务、短文本生成、批处理等不需要实时展示的场景。
streamText 适合聊天、长报告、PDF 总结、合同风险分析等用户正在页面等待的场景。
选择关键不是文本长短，而是是否需要实时交互和增量渲染。
```

追问：

```text
系统每天凌晨自动为 100 份文档生成摘要，用哪个？
```

回答要点：

- 用 `generateText` 更简单。
- 这是后台批处理。
- 用户不在页面等待。
- 不需要实时增量渲染。

### 6. Streaming 的完整数据流是什么？

考点：

- 是否理解 Streaming 是端到端链路。
- 是否知道 `streamText` 在后端。
- 是否知道前端增量渲染。

参考答案：

```text
前端发起请求并进入 generating 状态；后端组织 messages 后调用 streamText；
模型逐步生成内容；后端返回 stream response；
前端接收 chunk 并追加到当前 assistant message；
完成后状态变 done，失败变 error，用户停止变 stopped。
```

追问：

```text
Streaming 是模型直接把字写到页面上吗？
```

回答要点：

- 不是。
- 模型先把增量输出给后端。
- 后端通过 HTTP streaming response 返回给前端。
- 前端接收 chunk 后更新 UI。

### 7. SSE 和 `ReadableStream` 是什么关系？

考点：

- 是否能区分底层流接口和事件协议。
- 是否知道 AI SDK 不一定要求手写 SSE。

参考答案：

```text
ReadableStream 是底层数据流接口，SSE 是一种基于 HTTP 的服务端事件推送协议。
AI SDK 做 Streaming 时，不一定需要手写 EventSource，通常使用 SDK 提供的 UI message stream response 或封装好的前端 hook。
```

追问：

```text
使用 AI SDK 时前端一定要自己写 EventSource 吗？
```

回答要点：

- 不一定。
- AI SDK UI 通常已封装流式消息协议。
- 可以用 `useChat` 或 fetch reader。
- 除非需要自定义底层协议。

### 8. 如何实现停止生成？

考点：

- 是否知道停止生成是 abort 当前请求。
- 是否避免错误地发送“请停止”的 prompt。

参考答案：

```text
用户点击停止后，前端调用 AbortController.abort() 或 AI SDK UI 的 stop()，中断当前 streaming 请求。
后端感知 abort signal 后，中断模型调用或停止继续消费模型输出。
前端保留已生成内容，并把状态切换为 stopped。
```

追问：

```text
为什么不是再发一条 user message：“请停止生成”？
```

回答要点：

- 那会变成新的模型请求。
- 不一定能停止当前请求。
- 会污染对话历史。
- 正确做法是中断当前请求流。

### 9. AI 调用失败时如何处理？

考点：

- 是否能区分错误类型。
- 是否知道重试不能无脑做。

参考答案：

```text
需要区分错误类型。用户主动停止不重试；429 限流可以退避重试；
参数错误和 API key 错误不重试；网络临时错误可以有限重试。
前端要有明确错误提示，后端要记录日志并返回可读错误。
```

追问：

```text
429 rate limit 应该立刻重试吗？
```

回答要点：

- 不应该立刻无脑重试。
- 可能加重限流。
- 应使用退避策略。
- 或提示用户稍后再试。

### 10. 如何控制 token 和成本？

考点：

- 是否知道输入和输出都计入成本。
- 是否能说出上下文预算。

参考答案：

```text
不要把全文、所有历史消息、长 system prompt 都塞给模型。
应只传相关业务上下文，保留最近几轮历史，长历史做摘要，system prompt 保持简洁，并为输出预留 token 空间。
模型选择也要按成本、延迟和质量做配置。
```

追问：

```text
PDF 问答是不是应该每次把整份 PDF 全文都传给模型？
```

回答要点：

- 不应该。
- 成本高、延迟高。
- 可能超过上下文窗口。
- 无关内容会干扰回答。
- 应传相关片段，后续可结合 RAG。

### 11. 为什么 provider / model 不应该写死在业务代码里？

考点：

- 是否具备企业级模型配置意识。
- 是否知道成本、质量、延迟、可用性不同。

参考答案：

```text
不应该在每个 API route 里写死具体模型。
更合理的是把 provider 和 model 抽象到配置层，例如 fast、quality、cheap。
业务代码只表达能力需求，具体模型可以根据成本、延迟、质量和可用性调整。
```

追问：

```text
客服质检、合同分析、后台批量摘要可以用同一个模型吗？
```

回答要点：

- 可以先用同一个，但不建议长期强绑定。
- 快速问答可用 fast。
- 复杂分析可用 quality。
- 后台批量摘要可用 cheap。
- 企业级应用要保留切换空间。

## 十九、项目设计题

题目：

```text
设计一个客服质检助手。用户输入一段客服对话，系统生成质检问题总结。
只要求模块 1 范围，不设计 RAG、Tool Calling、Agent、数据库大系统。
```

参考答案：

```text
1. 场景：
客服质检助手，用户输入客服对话，系统生成质检问题总结。

2. 前端输入：
客服对话文本、质检目标、业务类型。
可选输入包括客户等级、质检标准版本。

3. messages：
system 放质检助手角色、评分边界、输出要求和不编造规则。
user 放本次客服对话和质检目标。
如果支持多轮追问，再带最近几轮 user / assistant history。

4. 模型调用方式：
使用 streamText。因为质检总结可能较长，用户正在页面等待，流式输出能更快看到结果，也方便中途停止。

5. 前端状态：
idle、generating、done、stopped、error。
生成中禁用输入或切换为停止按钮，失败时显示可读错误。

6. 停止生成：
前端调用 AbortController.abort() 或 AI SDK UI 的 stop()，中断当前 streaming 请求。
后端感知 abort signal 后，中断模型调用或停止消费模型输出。
前端保留已生成内容，并把状态改为 stopped。
```

## 二十、掌握度判断

当前模块 1 掌握度：约 85% - 90%。

已掌握：

- LLM API 调用链路。
- messages 角色分工。
- 模型无状态。
- UIMessage / ModelMessage。
- AI SDK 的工程价值。
- `generateText / streamText` 使用边界。
- Streaming 数据流。
- ReadableStream / SSE。
- 前端增量渲染。
- Abort 停止生成。
- 错误、超时、重试。
- token、上下文和成本意识。
- provider / model 配置意识。

仍需继续熟练：

- AI SDK 具体 API 的手写熟练度。
- 在真实项目中多练 `streamText`、`useChat`、错误处理和停止生成。
- 面试表达需要继续围绕真实 Demo 练习。

结论：

```text
模块 1 可以判定通过。
可以进入模块 2：Structured Output 与 Tool Calling。
```
