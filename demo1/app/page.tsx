"use client";

import { useChat } from "@ai-sdk/react";
import { useMemo, useState } from "react";
import {
  type GenerationStatus,
  getGenerationStatusLabel,
  isGenerating,
} from "../lib/state/generation-status";

const SAMPLE_QUESTIONS = [
  "这份采购合同有哪些交付风险？",
  "验收标准有什么问题？",
  "延期责任应该怎么改得更清楚？",
];

function textFromParts(parts: Array<{ type: string; text?: string }>) {
  return parts
    .filter((part) => part.type === "text")
    .map((part) => part.text ?? "")
    .join("");
}

export default function Home() {
  const [input, setInput] = useState("这份采购合同有哪些交付风险？");
  const [status, setStatus] = useState<GenerationStatus>("idle");
  const { messages, sendMessage, stop, error } = useChat({
    onFinish: () => setStatus("done"),
    onError: () => setStatus("error"),
  });

  const latestAnswer = useMemo(() => {
    const assistantMessages = messages.filter((message) => message.role === "assistant");
    const latest = assistantMessages.at(-1);
    return latest ? textFromParts(latest.parts) : "";
  }, [messages]);

  const submitQuestion = async (question = input) => {
    const trimmed = question.trim();
    if (!trimmed || isGenerating(status)) {
      return;
    }

    setStatus("generating");
    setInput("");
    await sendMessage({ text: trimmed });
  };

  const stopGeneration = () => {
    stop();
    setStatus("stopped");
  };

  return (
    <main className="workspace">
      <section className="briefing">
        <p className="eyebrow">Module 1 · LLM + AI SDK Core</p>
        <h1>合同风险分析助手</h1>
        <p className="summary">
          一个用于作品集的最小 AI SDK Demo：后端组织 messages，调用
          <code>streamText</code>，前端增量渲染，并支持停止生成、错误提示和状态展示。
        </p>
        <div className="status-row" aria-live="polite">
          <span className={`status status-${status}`}>{getGenerationStatusLabel(status)}</span>
          <span>Streaming · Abort · Error State</span>
        </div>
      </section>

      <section className="console" aria-label="合同风险分析工作台">
        <div className="context-panel">
          <h2>模拟合同上下文</h2>
          <ul>
            <li>交付日期写为“尽快完成”，没有明确日期。</li>
            <li>验收标准为“甲方满意”，缺少量化指标。</li>
            <li>延期只要求提前通知，未约定明确违约金。</li>
            <li>部分关键附件标注为“后续补充”。</li>
          </ul>
        </div>

        <div className="chat-panel">
          <div className="messages">
            {messages.length === 0 ? (
              <div className="empty-state">
                <span>Ready</span>
                <p>选择一个问题，或输入你自己的合同风险问题。</p>
              </div>
            ) : (
              messages.map((message) => (
                <article className={`message message-${message.role}`} key={message.id}>
                  <span>{message.role === "user" ? "用户" : "AI 助手"}</span>
                  <p>{textFromParts(message.parts)}</p>
                </article>
              ))
            )}
          </div>

          {error ? <p className="error">模型调用失败，请检查 API Key 或稍后重试。</p> : null}

          <div className="quick-actions">
            {SAMPLE_QUESTIONS.map((question) => (
              <button
                disabled={isGenerating(status)}
                key={question}
                onClick={() => submitQuestion(question)}
                type="button"
              >
                {question}
              </button>
            ))}
          </div>

          <form
            className="composer"
            onSubmit={(event) => {
              event.preventDefault();
              void submitQuestion();
            }}
          >
            <textarea
              disabled={isGenerating(status)}
              onChange={(event) => setInput(event.target.value)}
              placeholder="输入合同风险分析问题..."
              value={input}
            />
            <div className="composer-actions">
              <button disabled={!input.trim() || isGenerating(status)} type="submit">
                发送
              </button>
              <button
                className="secondary"
                disabled={!isGenerating(status) || !latestAnswer}
                onClick={stopGeneration}
                type="button"
              >
                停止
              </button>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
