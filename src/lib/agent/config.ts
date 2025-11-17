import "server-only";
import { env } from "@/env";
import { ChatOpenAI } from "@langchain/openai";

export const AGENTS = {
  CONCIERGE: "Concierge",
  // Ready for future agents like DISCOVERY, etc.
} as const;

export type AgentName = (typeof AGENTS)[keyof typeof AGENTS];

export function isAgentName(name: string): name is AgentName {
  return (Object.values(AGENTS) as string[]).includes(name);
}

export type ConciergeStreamEvent =
  | { type: "token"; value: string; metadata: Record<string, unknown> }
  | { type: "tool-start"; name: string; metadata: Record<string, unknown> }
  | { type: "tool"; name: string; data: unknown; metadata: Record<string, unknown> }
  | { type: "current-agent"; name: string }
  | { type: "new-chat-turn"; humanMessageId: string; assistantMessageId: string };

export const model = new ChatOpenAI({
  apiKey: env.OPENAI_API_KEY,
  temperature: 0,
  streaming: true,
  model: "gpt-4o",
});

export const miniModel = new ChatOpenAI({
  apiKey: env.OPENAI_API_KEY,
  temperature: 0,
  streaming: true,
  model: "gpt-4o-mini",
});
