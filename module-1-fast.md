# 模块 1 一页纸速记版：LLM 与 AI SDK 核心基础

## 1. 最小 LLM 调用链路

```text
前端输入
→ 后端 API
→ 参数校验
→ 组织 system / user / history messages
→ 调用模型 provider
→ 返回普通文本或 stream
→ 前端展示 idle / generating / done / stopped / error
```

面试关键词：后端统一调用、上下文管理、权限、错误处理、模型切换。

## 2. Messages 分工

```text
system：长期规则、角色、边界、输出要求
user：当前这一次任务
assistant：历史模型回复，用于多轮上下文
```

注意：`assistant` 不是“改写错误答案”的地方，主要是历史回复。

## 3. 模型无状态

```text
LLM API 不会自动记住上一轮。
每次请求只能看到本次传入的 messages。
```

多轮对话靠应用层管理：

```text
chatId + history messages + businessContext
```

历史不是越多越好，要控制 token 和上下文干扰。

## 4. UIMessage vs ModelMessage

```text
UIMessage：给前端展示和持久化用
ModelMessage：给模型调用用
```

常见链路：

```text
UIMessage[]
→ convertToModelMessages()
→ streamText()
→ toUIMessageStreamResponse()
```

不要把 `id / createdAt / metadata / status` 等 UI 字段原样塞给模型。

## 5. AI SDK 的作用

AI SDK 主要解决工程胶水：

```text
模型调用
流式输出
前端消息协议
停止生成
错误处理
provider / model 切换
```

它不会替你做业务上下文设计。

## 6. generateText vs streamText

```text
generateText：一次性返回完整结果
streamText：边生成边返回 chunk
```

选择依据不是文本长短，而是交互方式：

```text
后台批处理 → generateText
用户正在页面等待 → streamText
聊天 / 长报告 / PDF 总结 / 质检总结 → streamText
```

## 7. Streaming 数据流

```text
Browser
→ POST /api/chat
→ Next.js Route Handler
→ streamText({ model, messages })
→ stream response
→ 前端接收 chunk
→ 追加到同一条 assistant message
→ React 增量渲染
```

Streaming 不是模型直接写页面。

## 8. ReadableStream 与 SSE

```text
ReadableStream：底层数据流接口
SSE：基于 HTTP 的服务端事件推送协议
```

用 AI SDK 时，不一定手写 `EventSource`，通常用 SDK 的 stream response / UI hook。

## 9. 前端增量渲染

错误：

```text
每个 chunk 新增一条 assistant message
```

正确：

```text
先创建一条 assistant message
后续 chunk 追加到这一条 message
```

状态至少要有：

```text
idle / generating / done / stopped / error
```

## 10. Abort 停止生成

停止生成不是再发一条：

```text
请停止生成
```

正确链路：

```text
前端 stop() / AbortController.abort()
→ 中断当前 streaming 请求
→ 后端感知 abort signal
→ 中断模型调用或停止消费模型输出
→ 前端保留已生成内容
→ 状态改为 stopped
```

## 11. 错误、超时、重试

```text
用户主动停止：不重试
429 限流：谨慎退避重试
参数错误：不重试
API key 错误：不重试
网络临时错误：可有限重试
```

不要无脑重试。

## 12. Token、上下文、成本

不要把全文和所有历史都塞给模型。

问题：

```text
成本高
延迟高
可能超过上下文窗口
无关内容干扰回答
输出空间被挤占
```

改法：

```text
只传相关业务上下文
保留最近几轮历史
长历史做摘要
system prompt 简洁
为输出预留 token
```

## 13. Provider / Model 切换

```text
Provider：模型服务商
Model：具体模型
```

不要在业务代码里到处写死模型。

推荐抽象：

```text
fast：快速问答
quality：复杂分析
cheap：批量摘要
```

模块 1 Demo：

```text
deepseek-v4-flash
deepseek-v4-pro
```

## 14. 60 秒面试表达

我做 AI 应用时会通过后端统一组织 LLM 调用链路。前端负责输入和状态展示，后端负责参数校验、组织 messages、调用模型和处理错误。因为 LLM API 是无状态的，多轮对话需要应用层保存 chatId、历史 messages 和业务上下文。对于用户实时等待的长文本场景，我会使用 `streamText` 做流式输出，前端把 chunk 追加到同一条 assistant message，并维护 `idle / generating / done / stopped / error` 状态。停止生成时不是再发 prompt，而是用 abort 中断当前请求。同时我会控制 token 成本，并把 provider / model 抽象到配置层，方便按成本、速度和质量切换模型。

## 15. 最容易说错的点

```text
错：长文本一定用 generateText
对：用户实时等待的长文本优先 streamText

错：streamText 在前端调用
对：streamText 在后端调用，前端接收流

错：停止生成就是发“请停止”
对：停止生成是 abort 当前请求

错：历史越多越好
对：上下文要控制 token、相关性和输出空间

错：SSE 和 ReadableStream 完全一样
对：ReadableStream 是底层流接口，SSE 是事件协议
```
