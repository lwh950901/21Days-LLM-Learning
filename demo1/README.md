# Module 1 Demo: LLM 与 AI SDK 核心基础

这是 21 天 AI 应用开发求职冲刺模块 1 的最小可运行 Demo。

## 能力覆盖

- Next.js App Router + TypeScript
- Vercel AI SDK `streamText`
- `UIMessage` 到 `ModelMessage` 转换
- 前端增量渲染
- 停止生成
- 错误提示
- `idle / generating / done / stopped / error` 状态展示
- provider / model 配置集中管理

## 运行

```bash
npm install
cp .env.example .env.local
npm run dev
```

然后打开 `http://localhost:3000`。

## 环境变量

默认使用 Vercel AI Gateway 的字符串模型写法：

```bash
AI_GATEWAY_API_KEY=your_key_here
AI_MODEL_FAST=deepseek/deepseek-v4-flash
AI_MODEL_QUALITY=deepseek/deepseek-v4-pro
```

如需换 provider / model，只改 `.env.local` 或 `lib/ai/model.ts` 的映射，不需要改业务页面。
