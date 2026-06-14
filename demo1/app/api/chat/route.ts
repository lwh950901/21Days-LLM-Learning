import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { getModel } from "../../../lib/ai/model";
import { CONTRACT_CONTEXT, SYSTEM_PROMPT } from "../../../lib/ai/prompts";

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const { messages, modelProfile }: { messages?: UIMessage[]; modelProfile?: string } =
      await req.json();

    if (!messages?.length) {
      return Response.json({ error: "请先输入一个业务问题。" }, { status: 400 });
    }

    const result = streamText({
      model: getModel(modelProfile),
      system: `${SYSTEM_PROMPT}\n\n${CONTRACT_CONTEXT}`,
      messages: await convertToModelMessages(messages),
      abortSignal: req.signal,
    });

    return result.toUIMessageStreamResponse({
      onError: (error) => {
        console.error("AI stream failed", error);
        return "模型调用失败，请稍后重试。";
      },
    });
  } catch (error) {
    console.error("Chat route failed", error);
    return Response.json({ error: "请求处理失败，请检查输入后重试。" }, { status: 500 });
  }
}
