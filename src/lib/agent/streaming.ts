import { HumanMessage, ToolMessage } from "@langchain/core/messages";

import { getApp } from "./instances";
import { AGENTS, type AgentName, type ConciergeStreamEvent, isAgentName } from "./config";

export async function* streamAgent({
  message,
  threadId,
  tags = [],
  metadata = {},
}: {
  message: string;
  threadId: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}) {
  const hotelId = typeof metadata.hotelId === "number" ? metadata.hotelId : undefined;

  const app = await getApp();
  const stream = app.streamEvents(
    { messages: [new HumanMessage(message)] },
    {
      version: "v2",
      configurable: {
        thread_id: threadId,
        ...(hotelId !== undefined && { hotelId }),
      },
      tags,
      metadata: { threadId, ...metadata },
      runName: "concierge-graph",
    }
  );

  let currentAgent: AgentName = AGENTS.CONCIERGE;

  for await (const event of stream) {

    // skip the output of the preface gate
    if(event.metadata?.langgraph_node === "should_emit_preface") {
      continue;
    }

    if (
      event.event === "on_chain_start" &&
      isAgentName(event.name)
    ) {
      currentAgent = event.name;
      const out: ConciergeStreamEvent = { type: "current-agent", name: currentAgent };
      yield out;
    }


    if (event.event === "on_chat_model_stream" || event.event === "on_llm_stream") {
      const chunk = event.data?.chunk;
      let token = "";

      if (chunk?.content?.[0]?.text) {
        token = chunk.content[0].text;
      } else if (chunk?.text) {
        token = chunk.text;
      } else if (chunk?.content) {
        token = chunk.content;
      } else if (typeof chunk === 'string') {
        token = chunk;
      }

      if (token && typeof token === "string") {
        const out: ConciergeStreamEvent = { type: "token", value: token, metadata: { agent: currentAgent } };
        yield out;
      }
      continue;
    }

    if (event.event === "on_tool_start") {
      const toolName = String(event.name ?? "");
      const out: ConciergeStreamEvent = {
        type: "tool-start",
        name: toolName,
        metadata: { agent: currentAgent }
      };
      yield out;
      continue;
    }

    if (event.event === "on_tool_end") {
      const toolName = String(event.name ?? "");

      const data = event.data.output;

      const content = data instanceof ToolMessage ? data.content : null;

      if (content) {
        const out: ConciergeStreamEvent = {
          type: "tool",
          name: toolName,
          data: content,
          metadata: {
            agent: currentAgent,
          }
        };

        yield out;
      }
      continue;
    }
  }
}
