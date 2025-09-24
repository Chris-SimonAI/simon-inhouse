// app.ts (or wherever you compose the swarm)
import "server-only";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { createSwarm, createHandoffTool } from "@langchain/langgraph-swarm";

import { model, AGENTS } from "./config";
import { createConciergePrompt, createDiscoveryPrompt } from "./prompts";
import { searchRestaurantsTool, searchAttractionsTool, getAmenitiesTool, emitPrefaceTool, getDineInRestaurantsTool, initiateTippingTool } from "./tools";
import { getCheckpointer } from "./checkpointer";

// Concierge
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
    emitPrefaceTool,
    getAmenitiesTool,
    getDineInRestaurantsTool,
    initiateTippingTool,
    createHandoffTool({
      agentName: AGENTS.DISCOVERY,
      description: "Transfer to Discovery specialist for restaurants and attractions.",
    }),
  ],
});

// Discovery
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
    emitPrefaceTool,
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

let app: ReturnType<typeof workflow.compile> | null = null;

export async function getApp(): Promise<ReturnType<typeof workflow.compile>> {
  if (!app) {
    app = workflow.compile({
      checkpointer: await getCheckpointer(),
    });
  }
  return app;
}
