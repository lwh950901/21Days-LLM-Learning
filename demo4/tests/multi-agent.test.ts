import { execFileSync } from "node:child_process";
import { test } from "node:test";
import assert from "node:assert/strict";
import { runMeetingWorkflowDemo } from "../src/workflow-core.ts";

test("prints a minimal multi-agent collaboration trace", () => {
  const output = execFileSync("node", ["src/index.ts"], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
  });

  assert.match(output, /Multi-Agent Trace:/);
  assert.match(output, /analysisAgent: getActionItems, getRisks/);
  assert.match(output, /executorAgent Observation/);
  assert.match(output, /Multi-Agent Answer:/);
});

test("can disable teaching delays for tests and CLI checks", async () => {
  const startedAt = Date.now();
  const result = await runMeetingWorkflowDemo(undefined, { delayMs: 0 });
  const durationMs = Date.now() - startedAt;

  assert.equal(result.finalState.qualityScore, 90);
  assert.ok(durationMs < 1500, `expected fast run, got ${durationMs}ms`);
});
