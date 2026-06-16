import {
  END,
  START,
  StateGraph,
  StateSchema,
  type GraphNode,
} from "@langchain/langgraph";
import * as z from "zod";

const ActionItemSchema = z.object({
  owner: z.string().default(""),
  task: z.string().default(""),
  deadline: z.string().optional(),
});

type MeetingStateValue = {
  rawTranscript: string;
  meetingTitle?: string;
  summary?: string;
  decisions: string[];
  actionItems: Array<{
    owner: string;
    task: string;
    deadline?: string;
  }>;
  finalMinutes?: string;
  qualityScore?: number;
  qualityIssues: string[];
  retryCount: number;
  maxRetries: number;
};

const MeetingState = new StateSchema({
  rawTranscript: z.string(),
  meetingTitle: z.string().optional(),
  summary: z.string().optional(),
  decisions: z.array(z.string()).default([]),
  actionItems: z.array(ActionItemSchema).default([]),
  finalMinutes: z.string().optional(),
  qualityScore: z.number().optional(),
  qualityIssues: z.array(z.string()).default([]),
  retryCount: z.number().default(0),
  maxRetries: z.number().default(1),
});

function formatMinutes(state: MeetingStateValue): string {
  return [
    `# ${state.meetingTitle ?? "会议纪要"}`,
    "",
    `摘要：${state.summary ?? "暂无摘要"}`,
    "",
    "关键决策：",
    ...state.decisions.map((decision) => `- ${decision}`),
    "",
    "待办事项：",
    ...state.actionItems.map(
      (item) =>
        `- ${item.task}，负责人：${item.owner || "待确认"}，截止时间：${item.deadline ?? "待确认"}`
    ),
  ].join("\n");
}

const summarizeMeeting: GraphNode<typeof MeetingState> = async () => ({
  meetingTitle: "LangGraph 最小会议纪要 Demo",
  summary: "会议决定把手写 Workflow 迁移成 LangGraph 图结构。",
});

const extractDecisions: GraphNode<typeof MeetingState> = async () => ({
  decisions: [
    "使用 StateGraph 表达会议纪要流程。",
    "第一版不调用 LLM，只验证图结构和条件边。",
  ],
});

const extractActionItems: GraphNode<typeof MeetingState> = async () => ({
  actionItems: [
    {
      owner: "",
      task: "跑通 LangGraph 最小 Demo",
      deadline: "今天",
    },
  ],
});

const generateFinalMinutes: GraphNode<typeof MeetingState> = async (state) => ({
  finalMinutes: formatMinutes(state),
});

const checkQuality: GraphNode<typeof MeetingState> = async (state) => {
  const issues: string[] = [];

  if (!state.summary) {
    issues.push("缺少会议摘要。");
  }

  if (state.decisions.length === 0) {
    issues.push("缺少关键决策。");
  }

  if (state.actionItems.length === 0) {
    issues.push("缺少待办事项。");
  }

  const hasIncompleteActionItem = state.actionItems.some(
    (item) => !item.owner || !item.task
  );

  if (hasIncompleteActionItem) {
    issues.push("待办事项缺少负责人或任务内容。");
  }

  return {
    qualityScore: issues.length === 0 ? 90 : 60,
    qualityIssues: issues,
  };
};

const reviseMinutes: GraphNode<typeof MeetingState> = async (state) => {
  const actionItems = state.actionItems.map((item) => ({
    ...item,
    owner: item.owner || "待确认负责人",
  }));

  return {
    actionItems,
    finalMinutes: `${formatMinutes({
      ...state,
      actionItems,
    })}\n\n修正说明：LangGraph 节点已补齐待办负责人。`,
    retryCount: state.retryCount + 1,
  };
};

function routeAfterQualityCheck(state: MeetingStateValue) {
  if ((state.qualityScore ?? 0) >= 80) {
    return END;
  }

  if (state.retryCount < state.maxRetries) {
    return "reviseMinutes";
  }

  return END;
}

const graph = new StateGraph(MeetingState)
  .addNode("summarizeMeeting", summarizeMeeting)
  .addNode("extractDecisions", extractDecisions)
  .addNode("extractActionItems", extractActionItems)
  .addNode("generateFinalMinutes", generateFinalMinutes)
  .addNode("checkQuality", checkQuality)
  .addNode("reviseMinutes", reviseMinutes)
  .addEdge(START, "summarizeMeeting")
  .addEdge("summarizeMeeting", "extractDecisions")
  .addEdge("extractDecisions", "extractActionItems")
  .addEdge("extractActionItems", "generateFinalMinutes")
  .addEdge("generateFinalMinutes", "checkQuality")
  .addConditionalEdges("checkQuality", routeAfterQualityCheck, [
    "reviseMinutes",
    END,
  ])
  .addEdge("reviseMinutes", "checkQuality")
  .compile();

const result = await graph.invoke({
  rawTranscript: "团队讨论模块 3，要把手写 Workflow 迁移成 LangGraph。",
  retryCount: 0,
  maxRetries: 1,
});

console.log("LangGraph Quality Score:", result.qualityScore);
console.log("LangGraph Quality Issues:", result.qualityIssues);
console.log("LangGraph Retry Count:", result.retryCount);
console.log("\nLangGraph Final Minutes:\n");
console.log(result.finalMinutes);
