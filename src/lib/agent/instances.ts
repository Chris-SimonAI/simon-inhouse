import "server-only";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { createSwarm, createHandoffTool } from "@langchain/langgraph-swarm";

import { model, AGENTS } from "./config";
import { CONCIERGE_PROMPT, DISCOVERY_PROMPT } from "./prompts";
import { searchRestaurantsTool, searchAttractionsTool, check_availability_stub } from "./tools";
import { getCheckpointer } from "./checkpointer";

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
