import "server-only";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { createSwarm, createHandoffTool } from "@langchain/langgraph-swarm";

import { model, AGENTS } from "./config";
import { createConciergePrompt, createDiscoveryPrompt } from "./prompts";
import { searchRestaurantsTool, searchAttractionsTool, getAmenitiesTool } from "./tools";
import { getCheckpointer } from "./checkpointer";

const concierge = createReactAgent({
  llm: model,
  name: AGENTS.CONCIERGE,
  prompt: async (state, config) => {
    const hotelId = config.metadata!.hotelId! as number;
    const prompt = await createConciergePrompt(hotelId);

    const filtered = state.messages.filter(m => m.getType() !== "system");

    return [prompt, ...filtered];
  },
  tools: [
    getAmenitiesTool,
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
  prompt: async (state, config) => {

    const hotelId = config.metadata!.hotelId! as number;
    const prompt = await createDiscoveryPrompt(hotelId);

    const filtered = state.messages.filter(m => m.getType() !== "system");

    return [prompt, ...filtered]; 
   },
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
