import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

export type ActionItem = {
  owner: string;
  task: string;
  deadline?: string;
};

export type MeetingWorkflowState = {
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

export type TraceEvent = {
  stage: string;
  label: string;
  detail: string;
  stateDiff?: string[];
};

export type TraceCallback = (event: TraceEvent) => void;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

type StateUpdate = Partial<MeetingWorkflowState>;
type RouteResult = "end" | "reviseMinutes" | "endWithIssues";
export type MeetingToolName =
  | "getSummary"
  | "getDecisions"
  | "getActionItems"
  | "getRisks";

export type AnalysisResult = {
  requiredTools: MeetingToolName[];
  reason: string;
};

export type DemoResult = {
  finalState: MeetingWorkflowState;
  workflowTrace: TraceEvent[];
  agentTrace: TraceEvent[];
  agentAnswer: string;
  multiAgentTrace: TraceEvent[];
  multiAgentAnswer: string;
};

export type DemoRunOptions = {
  delayMs?: number;
};

function applyUpdate(
  state: MeetingWorkflowState,
  update: StateUpdate
): MeetingWorkflowState {
  return {
    ...state,
    ...update,
  };
}

function pushTrace(
  trace: TraceEvent[],
  stage: string,
  label: string,
  detail: string,
  onTrace?: TraceCallback,
  stateDiff?: string[]
) {
  const event: TraceEvent = { stage, label, detail, stateDiff };
  trace.push(event);
  onTrace?.(event);
}

async function summarizeMeeting(): Promise<StateUpdate> {
  return {
    meetingTitle: "AI 会议纪要 Workflow 评审会",
    summary: "会议讨论了模块 3 Demo 的范围，决定先完成可控 Workflow，再迁移到 LangGraph。",
    currentStep: "summarizeMeeting",
  };
}

async function extractDecisions(): Promise<StateUpdate> {
  return {
    decisions: [
      "先实现会议纪要 Workflow 的最小闭环。",
      "第一版不接真实 LLM，用固定输出帮助理解流程结构。",
    ],
    currentStep: "extractDecisions",
  };
}

async function extractActionItems(): Promise<StateUpdate> {
  return {
    actionItems: [
      {
        owner: "",
        task: "跑通 demo4 的 Workflow 最小示例",
        deadline: "今天",
      },
    ],
    currentStep: "extractActionItems",
  };
}

async function detectRisks(): Promise<StateUpdate> {
  return {
    risks: [
      "如果一开始接入真实模型，容易把注意力从 Workflow 结构转移到 API 细节。",
    ],
    currentStep: "detectRisks",
  };
}

async function generateFinalMinutes(
  state: MeetingWorkflowState
): Promise<StateUpdate> {
  return {
    finalMinutes: formatMinutes(state),
    currentStep: "generateFinalMinutes",
  };
}

function formatMinutes(state: MeetingWorkflowState): string {
  return [
    `# ${state.meetingTitle ?? "会议纪要"}`,
    "",
    `摘要：${state.summary ?? "暂无摘要"}`,
    "",
    "关键决策：",
    ...(state.decisions ?? []).map((decision) => `- ${decision}`),
    "",
    "待办事项：",
    ...(state.actionItems ?? []).map(
      (item) =>
        `- ${item.task}，负责人：${item.owner || "待确认"}，截止时间：${item.deadline ?? "待确认"}`
    ),
    "",
    "风险与阻塞：",
    ...(state.risks ?? []).map((risk) => `- ${risk}`),
  ].join("\n");
}

async function checkQuality(
  state: MeetingWorkflowState
): Promise<StateUpdate> {
  const issues: string[] = [];

  if (!state.summary) {
    issues.push("缺少会议摘要。");
  }

  if (!state.decisions || state.decisions.length === 0) {
    issues.push("缺少关键决策。");
  }

  if (!state.actionItems || state.actionItems.length === 0) {
    issues.push("缺少待办事项。");
  }

  const hasIncompleteActionItem = state.actionItems?.some(
    (item) => !item.owner || !item.task
  );

  if (hasIncompleteActionItem) {
    issues.push("待办事项缺少负责人或任务内容。");
  }

  return {
    qualityScore: issues.length === 0 ? 90 : 60,
    qualityIssues: issues,
    currentStep: "checkQuality",
  };
}

function routeAfterQualityCheck(state: MeetingWorkflowState): RouteResult {
  if ((state.qualityScore ?? 0) >= 80) {
    return "end";
  }

  if (state.retryCount < state.maxRetries) {
    return "reviseMinutes";
  }

  return "endWithIssues";
}

async function reviseMinutes(
  state: MeetingWorkflowState
): Promise<StateUpdate> {
  const fixedActionItems = (state.actionItems ?? []).map((item) => ({
    owner: item.owner || "待确认负责人",
    task: item.task,
    deadline: item.deadline ?? "待确认时间",
  }));

  return {
    actionItems: fixedActionItems,
    finalMinutes: `${formatMinutes({
      ...state,
      actionItems: fixedActionItems,
    })}\n\n修正说明：已根据质量问题补充待办负责人和截止时间。`,
    retryCount: state.retryCount + 1,
    currentStep: "reviseMinutes",
  };
}

async function runWorkflow(
  initialState: MeetingWorkflowState,
  onTrace?: TraceCallback,
  options: DemoRunOptions = {}
): Promise<{ state: MeetingWorkflowState; trace: TraceEvent[] }> {
  const trace: TraceEvent[] = [];
  let state = initialState;
  const stepDelay = options.delayMs ?? 0;

  const orderedNodes = [
    ["summarizeMeeting", summarizeMeeting],
    ["extractDecisions", extractDecisions],
    ["extractActionItems", extractActionItems],
    ["detectRisks", detectRisks],
  ] as const;

  for (const [nodeName, node] of orderedNodes) {
    await delay(stepDelay);
    state = applyUpdate(state, await node());
    const diffs: Record<string, string[]> = {
      summarizeMeeting: ["meetingTitle", "summary", "currentStep"],
      extractDecisions: ["decisions", "currentStep"],
      extractActionItems: ["actionItems", "currentStep"],
      detectRisks: ["risks", "currentStep"],
    };
    pushTrace(trace, "Node", nodeName, `更新 currentStep=${state.currentStep}`, onTrace, diffs[nodeName] ?? []);
  }

  await delay(stepDelay);
  state = applyUpdate(state, await generateFinalMinutes(state));
  pushTrace(trace, "Node", "generateFinalMinutes", "生成第一版会议纪要。", onTrace, ["finalMinutes", "currentStep"]);

  while (true) {
    await delay(stepDelay);
    state = applyUpdate(state, await checkQuality(state));
    const next = routeAfterQualityCheck(state);

    pushTrace(
      trace,
      "Conditional Edge",
      "routeAfterQualityCheck",
      `qualityScore=${state.qualityScore}, issues=${state.qualityIssues?.length ?? 0}, next=${next}`,
      onTrace,
      []
    );

    if (next === "end") {
      return { state, trace };
    }

    if (next === "endWithIssues") {
      return {
        state: {
          ...state,
          error: "会议纪要质量未通过，且已达到最大重试次数。",
        },
        trace,
      };
    }

    await delay(stepDelay);
    state = applyUpdate(state, await reviseMinutes(state));
    pushTrace(trace, "Loop", "reviseMinutes", "根据质量问题补齐待办负责人。", onTrace, ["actionItems", "finalMinutes", "retryCount", "currentStep"]);
  }
}

function decideToolByRule(question: string): MeetingToolName {
  if (question.includes("决定") || question.includes("决策")) {
    return "getDecisions";
  }

  if (question.includes("风险") || question.includes("阻塞")) {
    return "getRisks";
  }

  if (
    question.includes("谁") ||
    question.includes("负责") ||
    question.includes("待办")
  ) {
    return "getActionItems";
  }

  return "getSummary";
}

async function decideToolWithAISDK(question: string): Promise<MeetingToolName> {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseURL = process.env.OPENAI_BASE_URL ?? "https://api.deepseek.com/v1";
  const modelId = process.env.AI_MODEL_FAST ?? "deepseek-v4-flash";

  if (!apiKey || apiKey === "your_api_key_here") {
    return decideToolByRule(question);
  }

  const openai = createOpenAI({ apiKey, baseURL });

  try {
    const { text } = await generateText({
      model: openai.chat(modelId),
      system:
        '你是工具路由器。只返回 JSON：{"tool":"getSummary|getDecisions|getActionItems|getRisks"}。',
      prompt: question,
      temperature: 0,
      maxOutputTokens: 24,
      maxRetries: 0,
      timeout: 10000,
    });
    const parsed = JSON.parse(text) as { tool?: MeetingToolName };
    const allowedTools: MeetingToolName[] = [
      "getSummary",
      "getDecisions",
      "getActionItems",
      "getRisks",
    ];

    if (parsed.tool && allowedTools.includes(parsed.tool)) {
      return parsed.tool;
    }
  } catch {
    return decideToolByRule(question);
  }

  return decideToolByRule(question);
}

function runMeetingTool(
  toolName: MeetingToolName,
  state: MeetingWorkflowState
): string {
  if (toolName === "getDecisions") {
    return (state.decisions ?? []).join("；");
  }

  if (toolName === "getActionItems") {
    return (state.actionItems ?? [])
      .map(
        (item) =>
          `${item.task}，负责人：${item.owner || "待确认"}，截止时间：${item.deadline ?? "待确认"}`
      )
      .join("；");
  }

  if (toolName === "getRisks") {
    return (state.risks ?? []).join("；");
  }

  return state.summary ?? "暂无会议摘要。";
}

async function answerMeetingQuestion(
  question: string,
  state: MeetingWorkflowState,
  onTrace?: TraceCallback,
  options: DemoRunOptions = {}
): Promise<{ answer: string; trace: TraceEvent[] }> {
  const trace: TraceEvent[] = [];
  const stepDelay = options.delayMs ?? 0;

  pushTrace(trace, "Question", question, "用户基于会议内容提问。", onTrace, []);
  await delay(stepDelay);

  const toolName = await decideToolWithAISDK(question);
  pushTrace(trace, "Model Decision", "decideToolWithAISDK", `选择工具：${toolName}`, onTrace, []);
  await delay(stepDelay);

  const observation = runMeetingTool(toolName, state);
  pushTrace(trace, "Act", toolName, "代码执行只读工具。", onTrace, []);
  await delay(stepDelay);

  pushTrace(trace, "Observation", "tool result", observation, onTrace, []);

  return {
    answer: `根据 ${toolName} 的查询结果：${observation}`,
    trace,
  };
}

function analysisAgentByRule(question: string): AnalysisResult {
  const requiredTools = new Set<MeetingToolName>();

  if (
    question.includes("谁") ||
    question.includes("负责") ||
    question.includes("待办")
  ) {
    requiredTools.add("getActionItems");
  }

  if (question.includes("风险") || question.includes("阻塞")) {
    requiredTools.add("getRisks");
  }

  if (question.includes("决定") || question.includes("决策")) {
    requiredTools.add("getDecisions");
  }

  if (requiredTools.size === 0) {
    requiredTools.add("getSummary");
  }

  return {
    requiredTools: [...requiredTools],
    reason: "规则分析：根据关键词拆解需要查询的信息。",
  };
}

async function analyzeWithLLM(question: string): Promise<AnalysisResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseURL = process.env.OPENAI_BASE_URL ?? "https://api.deepseek.com/v1";
  const modelId = process.env.AI_MODEL_FAST ?? "deepseek-v4-flash";

  if (!apiKey || apiKey === "your_api_key_here") {
    return analysisAgentByRule(question);
  }

  const openai = createOpenAI({ apiKey, baseURL });
  const allowedTools: MeetingToolName[] = [
    "getSummary",
    "getDecisions",
    "getActionItems",
    "getRisks",
  ];

  try {
    const { text } = await generateText({
      model: openai.chat(modelId),
      system: `你是多工具分析器。根据用户问题判断需要查询哪些工具。可用工具：${allowedTools.join("、")}。

只返回 JSON：{"tools":["getActionItems","getRisks"],"reason":"需要查询xxx和xxx，因为..."}`,
      prompt: question,
      temperature: 0,
      maxOutputTokens: 200,
      maxRetries: 0,
      timeout: 10000,
    });
    const parsed = JSON.parse(text) as {
      tools?: MeetingToolName[];
      reason?: string;
    };

    if (parsed.tools?.length) {
      const valid = parsed.tools.filter((t) => allowedTools.includes(t));
      if (valid.length > 0) {
        return {
          requiredTools: valid,
          reason: parsed.reason ?? `LLM 分析：需要查询 ${valid.join("、")}。`,
        };
      }
    }
  } catch {
    // fall through to rule-based
  }

  return analysisAgentByRule(question);
}

async function analysisAgent(question: string): Promise<AnalysisResult> {
  const result = await analyzeWithLLM(question);
  return result;
}

function executorAgent(
  analysis: AnalysisResult,
  state: MeetingWorkflowState
): TraceEvent[] {
  return analysis.requiredTools.map((toolName) => ({
    stage: "executorAgent Observation",
    label: toolName,
    detail: runMeetingTool(toolName, state),
  }));
}

async function multiAgentAnswerMeetingQuestion(
  question: string,
  state: MeetingWorkflowState,
  onTrace?: TraceCallback,
  options: DemoRunOptions = {}
): Promise<{ answer: string; trace: TraceEvent[] }> {
  const trace: TraceEvent[] = [];
  const stepDelay = options.delayMs ?? 0;

  const analysis = await analysisAgent(question);
  pushTrace(
    trace,
    "analysisAgent",
    analysis.requiredTools.join(", "),
    analysis.reason,
    onTrace,
    []
  );
  await delay(stepDelay);

  const observations = executorAgent(analysis, state);
  for (const obs of observations) {
    await delay(stepDelay);
    pushTrace(trace, obs.stage, obs.label, obs.detail, onTrace, []);
  }

  return {
    answer: `分析 Agent 判断需要查询 ${analysis.requiredTools.join(", ")}。\n执行 Agent 查询结果：\n${observations
      .map((item) => `${item.label}: ${item.detail}`)
      .join("\n")}`,
    trace,
  };
}

export async function runMeetingWorkflowDemo(
  onTrace?: TraceCallback,
  options: DemoRunOptions = {}
): Promise<DemoResult> {
  const initialState: MeetingWorkflowState = {
    rawTranscript: "团队讨论模块 3 的学习路线，需要先理解 Workflow，再做 LangGraph Demo。",
    currentStep: "start",
    retryCount: 0,
    maxRetries: 1,
  };

  const { state: finalState, trace: workflowTrace } =
    await runWorkflow(initialState, onTrace, options);
  const agent = await answerMeetingQuestion("谁负责跑通 demo4？", finalState, onTrace, options);
  const multiAgent = await multiAgentAnswerMeetingQuestion(
    "谁负责跑通 demo4？另外有什么风险？",
    finalState,
    onTrace,
    options
  );

  return {
    finalState,
    workflowTrace,
    agentTrace: agent.trace,
    agentAnswer: agent.answer,
    multiAgentTrace: multiAgent.trace,
    multiAgentAnswer: multiAgent.answer,
  };
}
