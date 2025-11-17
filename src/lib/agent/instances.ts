import "server-only";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { StateGraph, Annotation, START } from "@langchain/langgraph";
import type { BaseMessage } from "@langchain/core/messages";

import { model, AGENTS } from "./config";
import { createConciergePrompt } from "./prompts";
import { searchRestaurantsTool, searchAttractionsTool, getAmenitiesTool, getDineInRestaurantsTool, initiateTippingTool } from "./tools";
import { getCheckpointer } from "./checkpointer";
import { shouldEmitPrefaceNode, generatePrefaceNode, routeAfterClassifier } from "./preface-gate";

// there could be 4 messages per chat turn
// including tool calls and tool results
const MAX_MESSAGES = 20 * 4;

function appendCap<T>(n: number) {
  return (prev: T[] = [], next: T[] = []) => {
    const previous = prev ?? [];
    const incoming = next ?? [];

    const combined = previous.concat(incoming);
    const deduped: T[] = [];
    const seen = new Map<string, number>();

    combined.forEach((message) => {
      const id =
        (message as { id?: string })?.id ??
        (message as { kwargs?: { id?: string } })?.kwargs?.id ??
        (message as { additional_kwargs?: { id?: string } })?.additional_kwargs?.id ??
        null;

      if (id && seen.has(id)) {
        const existingIndex = seen.get(id);
        if (existingIndex !== undefined) {
          deduped[existingIndex] = message;
        }
      } else if (id) {
        seen.set(id, deduped.length);
        deduped.push(message);
      } else {
        deduped.push(message);
      }
    });

    const trimmed = deduped.length > n ? deduped.slice(deduped.length - n) : deduped;

    return trimmed;
  };
}

const GraphState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: appendCap<BaseMessage>(MAX_MESSAGES),
  }),

  shouldEmitPreface: Annotation<boolean>({
    reducer: (x, y) => y ?? x,
    default: () => false,
  }),
});

// Concierge - handles all guest requests including hotel amenities, dining, and local discoveries
const concierge = createReactAgent({
  llm: model,
  name: AGENTS.CONCIERGE,
  prompt: async (state, config) => {
    const hotelId = config.metadata!.hotelId! as number;
    const prompt = await createConciergePrompt(hotelId);
    const filtered = state.messages.filter(m => m.getType() !== "system");
    // we are only fetching the latest messages from the last user message
    // this means we wont have a memory, but also it will be faster
    // and not face context limit issues
    const lastUserMessageIdx = filtered.findLastIndex(m => m.getType() === "human");
    const messagesToReturn = filtered.slice(lastUserMessageIdx);
    return [prompt, ...messagesToReturn];
  },
  tools: [
    getAmenitiesTool,
    getDineInRestaurantsTool,
    initiateTippingTool,
    searchRestaurantsTool,
    searchAttractionsTool,
  ],
});

const workflow = new StateGraph(GraphState)
  .addNode("should_emit_preface", shouldEmitPrefaceNode)
  .addNode("generate_preface", generatePrefaceNode)
  .addNode("concierge", concierge)
  .addEdge(START, "should_emit_preface")
  .addConditionalEdges("should_emit_preface", routeAfterClassifier)
  .addEdge("generate_preface", "concierge");

let app: ReturnType<typeof workflow.compile> | null = null;

export async function getApp(): Promise<ReturnType<typeof workflow.compile>> {
  if (!app) {
    app = workflow.compile({
      checkpointer: await getCheckpointer(),
    });
  }
  return app;
}
