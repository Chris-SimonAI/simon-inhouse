import "server-only";
import { env } from "@/env";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { createSwarm, createHandoffTool } from "@langchain/langgraph-swarm";

import { model, AGENTS } from "./config";
import { CONCIERGE_PROMPT, DISCOVERY_PROMPT } from "./prompts";
import { searchRestaurantsTool, searchAttractionsTool, check_availability_stub } from "./tools";

let checkpointer: PostgresSaver | null = null;
async function getCheckpointer(): Promise<PostgresSaver> {
  if (!checkpointer) {
    checkpointer = PostgresSaver.fromConnString(env.DATABASE_URL);
    await checkpointer.setup();
  }
  return checkpointer;
}

const concierge = createReactAgent({
  llm: model,
  name: AGENTS.CONCIERGE,
  prompt: CONCIERGE_PROMPT,
  tools: [
    check_availability_stub,
    createHandoffTool({
      agentName: AGENTS.DISCOVERY,
      description:
        "Transfer to Discovery specialist for restaurants and attractions.",
    }),
  ],
});

const discovery = createReactAgent({
  llm: model,
  name: AGENTS.DISCOVERY,
  prompt: DISCOVERY_PROMPT,
  tools: [
    searchRestaurantsTool,
    searchAttractionsTool,
    createHandoffTool({
      agentName: AGENTS.CONCIERGE,
      description: "Transfer back to Concierge for general hotel topics and non-discovery questions.",
    }),
  ],
});

const workflow = createSwarm({
  agents: [concierge, discovery],
  defaultActiveAgent: AGENTS.CONCIERGE,
});

export const app = (await (async () =>
  workflow.compile({
    checkpointer: await getCheckpointer(),
  }))()) as ReturnType<typeof workflow.compile>;
