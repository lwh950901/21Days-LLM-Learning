"use client";

import { useEffect, useRef, useState } from "react";
import type { DemoResult, TraceEvent } from "../src/workflow-core";

const interviewNotes = [
  "Workflow 适合业务步骤明确的 AI 任务，流程顺序由代码控制。",
  "State 是节点共享的工作台，每个 Node 只返回局部更新。",
  "Conditional Edge 根据 State 决定下一步，适合质量检查、重试和结束判断。",
  "Agent 适合局部不确定决策，工具执行仍由代码负责。",
  "Multi-Agent 只在职责拆分清楚时使用，例如分析 Agent 和执行 Agent。",
];

// ── Learning annotations ──

type LearningNote = { concept: string; interview: string };

const LEARNING_NOTES: Record<string, LearningNote> = {
  summarizeMeeting: {
    concept:
      "每个 Node 只负责一个步骤，接收 State 但只返回自己关心的 Partial<State>。",
    interview:
      "我把会议纪要流程拆成独立 Node，每个只做一件事，方便单独测试和复用。",
  },
  extractDecisions: {
    concept:
      "多个 Node 通过 State 共享数据——上游输出自动成为下游输入，无需手动传参。",
    interview:
      "State 是共享工作台，Node 只写自己那部分，不会不小心覆盖别人的字段。",
  },
  extractActionItems: {
    concept:
      "这里故意让 owner 留空，是为了触发后续的质量检查——用来演示 Conditional Edge 和 Loop。",
    interview:
      "我设计 Workflow 时会故意留一些边界 case，然后在质量检查节点统一兜底。",
  },
  detectRisks: {
    concept:
      "Edge 按固定顺序连接节点。风险检测放在纪要生成之前，确保输出包含风险提示。",
    interview:
      "固定边适合步骤明确的业务流程，比如审批、报告生成、多步数据处理。",
  },
  generateFinalMinutes: {
    concept:
      "这个 Node 读取上游所有字段（摘要、决策、待办、风险），拼接成最终纪要。",
    interview:
      "最后一步把前面所有结果拼成一份完整纪要，如果有字段缺失就用降级默认值。",
  },
  checkQuality: {
    concept:
      "质量检查节点评估 State 是否满足最低标准，返回 qualityScore 供条件边判断。",
    interview:
      "我在关键节点后面加了质量检查，不达标的自动进入修正循环，避免脏数据流出。",
  },
  "routeAfterQualityCheck": {
    concept:
      "Conditional Edge 的核心：根据 qualityScore 和 retryCount 决定下一步。",
    interview:
      "条件边的三路分支——通过→结束，不通过+有余量→修正，不通过+耗尽→报错。",
  },
  reviseMinutes: {
    concept:
      "Loop 修正节点：补齐缺失字段，retryCount+1，回到 checkQuality。maxRetries 防死循环。",
    interview:
      "修正节点只补字段不重做全流程，retryCount 上限防止死循环，生产环境还能加人工审核。",
  },
  getActionItems: {
    concept:
      "LLM 根据用户问题选择 getActionItems 工具，代码只负责执行——典型的 Agent 模式。",
    interview:
      "Agent 让 LLM 决定用哪个工具，但工具执行全在代码里，避免 LLM 直接操作数据。",
  },
  getRisks: {
    concept:
      "分析 Agent 同时判断需要查待办和风险，执行 Agent 顺序调用两个工具——Multi-Agent 协作的核心。",
    interview:
      "分析 Agent 拆解问题，执行 Agent 调工具，职责分开后每个 Agent 的 prompt 更简洁。",
  },
  analysisAgent: {
    concept:
      "分析 Agent 调用 LLM 动态判断需要哪些工具（getActionItems + getRisks）。无 API key 时自动降级为规则匹配。",
    interview:
      "Multi-Agent 中分析 Agent 的 prompt 只负责拆解意图，不直接操作数据——这是职责分离的关键。",
  },
  "executorAgent Observation": {
    concept:
      "执行 Agent 根据分析结果顺序调用工具，每次调用只读取 State，不修改任何字段。",
    interview:
      "执行 Agent 只读不写，所有副作用由 Workflow Node 控制——避免了 Agent 越权修改数据。",
  },
};

function getLearningNote(label: string): LearningNote | null {
  return LEARNING_NOTES[label] ?? null;
}

// ── Components ──

function PhaseProgress({
  workflowDone,
  workflowTotal,
  agentDone,
  agentTotal,
  multiDone,
  multiTotal,
}: {
  workflowDone: number;
  workflowTotal: number;
  agentDone: number;
  agentTotal: number;
  multiDone: number;
  multiTotal: number;
}) {
  const phases = [
    {
      label: "Workflow",
      desc: "State → Node → Edge → Conditional Edge → Loop",
      done: workflowDone,
      total: workflowTotal,
    },
    {
      label: "Agent",
      desc: "Question → Tool Decision → Act → Observe → Answer",
      done: agentDone,
      total: agentTotal,
    },
    {
      label: "Multi-Agent",
      desc: "Analysis Agent + Executor Agent 协作",
      done: multiDone,
      total: multiTotal,
    },
  ];

  return (
    <section className="phase-progress">
      {phases.map((p) => {
        const pct = p.total > 0 ? Math.round((p.done / p.total) * 100) : 0;
        const active = p.done > 0 && p.done < p.total;
        return (
          <div
            key={p.label}
            className={`phase-bar${active ? " active" : ""}${p.done === p.total ? " done" : ""}`}
          >
            <div className="phase-header">
              <span className="phase-label">{p.label}</span>
              <span className="phase-count">
                {p.done}/{p.total}
              </span>
            </div>
            <span className="phase-track">
              <span className="phase-fill" style={{ width: `${pct}%` }} />
            </span>
            <span className="phase-desc">{p.desc}</span>
          </div>
        );
      })}
    </section>
  );
}

function TraceList({
  title,
  items,
}: {
  title: string;
  items: TraceEvent[];
}) {
  if (items.length === 0) {
    return (
      <section className="panel trace-panel trace-empty">
        <div className="panel-label">{title}</div>
        <p className="trace-waiting">等待执行...</p>
      </section>
    );
  }

  return (
    <section className="panel trace-panel">
      <div className="panel-label">{title}</div>
      <div className="trace-list">
        {items.map((item, index) => {
          const isLatest = index === items.length - 1;
          return (
            <article
              className={`trace-item${isLatest ? " current" : ""}`}
              key={`${item.stage}-${index}`}
            >
              <span className="trace-index">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <p className="trace-stage">{item.stage}</p>
                <h3>{item.label}</h3>
                <p>{item.detail}</p>
                {item.stateDiff && item.stateDiff.length > 0 && (
                  <div className="state-diff-tags">
                    {item.stateDiff.map((key) => (
                      <span key={key} className="state-tag">{key}</span>
                    ))}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function LearningPanel({ labels }: { labels: string[] }) {
  // Reverse so newest is at top
  const seen = new Set<string>();
  const entries = [...labels]
    .reverse()
    .map((label) => ({ label, note: getLearningNote(label) }))
    .filter((e) => {
      if (!e.note || seen.has(e.label)) return false;
      seen.add(e.label);
      return true;
    });

  if (entries.length === 0) {
    return (
      <section className="panel learning-panel">
        <div className="panel-label">Learning context</div>
        <p className="learning-placeholder">
          等待执行...每完成一步，这里会记录对应的核心概念和面试表达。
        </p>
      </section>
    );
  }

  return (
    <section className="panel learning-panel">
      <div className="panel-label">Learning context</div>
      <div className="learning-log">
        {entries.map((entry, i) => (
          <article
            key={`${entry.label}-${i}`}
            className={`learning-entry${i === 0 ? " enter" : ""}`}
          >
            <span className="learning-step">{entry.label}</span>
            <div className="learning-sections">
              <div>
                <h4>📖 核心概念</h4>
                <p>{entry.note!.concept}</p>
              </div>
              <div>
                <h4>💬 面试表达</h4>
                <p>{entry.note!.interview}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

// ── Page ──

export default function Page() {
  const [data, setData] = useState<DemoResult | null>(null);
  const [running, setRunning] = useState(false);

  const [workflowTrace, setWorkflowTrace] = useState<TraceEvent[]>([]);
  const [agentTrace, setAgentTrace] = useState<TraceEvent[]>([]);
  const [multiAgentTrace, setMultiAgentTrace] = useState<TraceEvent[]>([]);
  const [workflowLabels, setWorkflowLabels] = useState<string[]>([]);
  const [agentLabels, setAgentLabels] = useState<string[]>([]);
  const [multiAgentLabels, setMultiAgentLabels] = useState<string[]>([]);

  const abortRef = useRef<AbortController | null>(null);

  async function runDemo() {
    setData(null);
    setWorkflowTrace([]);
    setAgentTrace([]);
    setMultiAgentTrace([]);
    setWorkflowLabels([]);
    setAgentLabels([]);
    setMultiAgentLabels([]);
    setRunning(true);

    const workflowStages = new Set(["Node", "Conditional Edge", "Loop"]);
    const agentStages = new Set([
      "Question",
      "Model Decision",
      "Act",
      "Observation",
    ]);
    const multiAgentStages = new Set([
      "analysisAgent",
      "executorAgent Observation",
    ]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/demo", {
        cache: "no-store",
        signal: controller.signal,
      });

      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const msg = JSON.parse(line.slice(6)) as {
              type: string;
              stage?: string;
              label?: string;
              detail?: string;
              stateDiff?: string[];
              result?: DemoResult;
            };

            if (msg.type === "step" && msg.stage) {
              const event: TraceEvent = {
                stage: msg.stage,
                label: msg.label ?? "",
                detail: msg.detail ?? "",
                stateDiff: msg.stateDiff,
              };

              if (workflowStages.has(msg.stage)) {
                setWorkflowTrace((prev) => [...prev, event]);
                setWorkflowLabels((prev) => [...prev, msg.label || msg.stage || ""]);
              } else if (agentStages.has(msg.stage)) {
                setAgentTrace((prev) => [...prev, event]);
                setAgentLabels((prev) => [...prev, msg.label || msg.stage || ""]);
              } else if (multiAgentStages.has(msg.stage)) {
                setMultiAgentTrace((prev) => [...prev, event]);
                setMultiAgentLabels((prev) => [...prev, msg.label || msg.stage || ""]);
              }
            } else if (msg.type === "done" && msg.result) {
              setData(msg.result);
              setRunning(false);
            }
          } catch {
            // skip malformed
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        console.error("Stream error:", err);
      }
      setRunning(false);
    }
  }

  useEffect(() => {
    void runDemo();
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return (
    <main className="page-shell">
      {/* ── Hero ── */}
      <section className="hero">
        <div>
          <p className="eyebrow">Module 3 / Workflow Agent LangGraph</p>
          <h1>会议纪要流程控制台</h1>
          <p className="hero-copy">
            观察 State、Node、Conditional Edge、Loop、Agent 和 Multi-Agent
            如何协作。SSE 流式推送每一步真实执行进度。
          </p>
        </div>
        <button
          className="run-button"
          disabled={running}
          onClick={runDemo}
        >
          {running ? "Running…" : "Run workflow"}
        </button>
      </section>

      {/* ── Phase progress ── */}
      <PhaseProgress
        workflowDone={workflowTrace.length}
        workflowTotal={8}
        agentDone={agentTrace.length}
        agentTotal={4}
        multiDone={multiAgentTrace.length}
        multiTotal={3}
      />

      {/* ── Status strip ── */}
      <section className="status-strip">
        <div>
          <span>Quality</span>
          <strong>{data?.finalState.qualityScore ?? "--"}</strong>
        </div>
        <div>
          <span>Retry</span>
          <strong>{data?.finalState.retryCount ?? "--"}</strong>
        </div>
        <div>
          <span>Current step</span>
          <strong>{data?.finalState.currentStep ?? "waiting"}</strong>
        </div>
      </section>

      {/* ── Workflow ── */}
      <section className="stage-section">
        <div className="stage-header">
          <h2>1. Workflow</h2>
          <p>State → Node → Edge → Conditional Edge → Loop</p>
        </div>
        <div className="tab-content">
          <div className="tab-main">
            <TraceList
              title="Workflow Trace"
              items={workflowTrace}
            />
          </div>
          <aside className="tab-side">
            <LearningPanel labels={workflowLabels} />
            <section className="panel">
              <div className="panel-label">Final minutes</div>
              <pre className="minutes">
                {data?.finalState.finalMinutes ??
                  "Workflow 完成后这里会显示最终纪要..."}
              </pre>
            </section>
          </aside>
        </div>
      </section>

      {/* ── Agent ── */}
      <section className="stage-section">
        <div className="stage-header">
          <h2>2. Agent</h2>
          <p>Question → Tool Decision → Act → Observe → Answer</p>
        </div>
        <div className="tab-content">
          <div className="tab-main">
            <TraceList
              title="Agent Trace"
              items={agentTrace}
            />
          </div>
          <aside className="tab-side">
            <LearningPanel labels={agentLabels} />
            <section className="panel">
              <div className="panel-label">Agent answer</div>
              <p className="answer-text">
                {data?.agentAnswer ?? "Agent 执行中..."}
              </p>
            </section>
          </aside>
        </div>
      </section>

      {/* ── Multi-Agent ── */}
      <section className="stage-section">
        <div className="stage-header">
          <h2>3. Multi-Agent</h2>
          <p>Analysis Agent + Executor Agent 协作</p>
        </div>
        <div className="tab-content">
          <div className="tab-main">
            <TraceList
              title="Multi-Agent Trace"
              items={multiAgentTrace}
            />
          </div>
          <aside className="tab-side">
            <LearningPanel labels={multiAgentLabels} />
            <section className="panel">
              <div className="panel-label">Multi-Agent answer</div>
              <p className="answer-text">
                {data?.multiAgentAnswer ?? "Multi-Agent 执行中..."}
              </p>
            </section>
          </aside>
        </div>
      </section>

      {/* ── Interview ── */}
      <section className="panel interview-panel">
        <div className="panel-label">Interview expression</div>
        <div className="quote-list">
          {interviewNotes.map((note) => (
            <blockquote key={note}>{note}</blockquote>
          ))}
        </div>
      </section>
    </main>
  );
}
