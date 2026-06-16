import { runMeetingWorkflowDemo } from "../../../src/workflow-core";
import type { TraceCallback } from "../../../src/workflow-core";

export const maxDuration = 20;

export async function GET() {
  let controller!: ReadableStreamDefaultController;

  const stream = new ReadableStream({
    start(c) {
      controller = c;
    },
  });

  const encoder = new TextEncoder();

  function send(data: unknown) {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
  }

  const onTrace: TraceCallback = (event) => {
    send({ type: "step", ...event });
  };

  // Run in background; SSE keeps connection alive
  runMeetingWorkflowDemo(onTrace, { delayMs: 800 })
    .then((result) => {
      send({ type: "done", result });
      controller.close();
    })
    .catch((err) => {
      send({ type: "error", message: String(err) });
      controller.close();
    });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
