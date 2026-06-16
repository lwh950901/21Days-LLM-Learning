import { runMeetingWorkflowDemo } from "./workflow-core.ts";

const result = await runMeetingWorkflowDemo();

for (const item of result.workflowTrace) {
  if (item.stage === "Conditional Edge") {
    console.log(
      `Quality Check: ${item.detail.replace("qualityScore", "score")}`
    );
  }
}

console.log("\nAgent Trace:");
for (const item of result.agentTrace) {
  console.log(`${item.stage}: ${item.label} ${item.detail}`);
}

console.log("\nMulti-Agent Trace:");
for (const item of result.multiAgentTrace) {
  console.log(`${item.stage}: ${item.label}`);
  console.log(item.detail);
}

console.log("Current Step:", result.finalState.currentStep);
console.log("Quality Score:", result.finalState.qualityScore);
console.log("Quality Issues:", result.finalState.qualityIssues);
console.log("\nFinal Minutes:\n");
console.log(result.finalState.finalMinutes);
console.log("\nAgent Answer:\n");
console.log(result.agentAnswer);
console.log("\nMulti-Agent Answer:\n");
console.log(result.multiAgentAnswer);
