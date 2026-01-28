import "server-only";

import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { StateGraph, Annotation, START } from "@langchain/langgraph";
import type { BaseMessage } from "@langchain/core/messages";
import { HumanMessage } from "@langchain/core/messages";

import { model, AGENTS } from "./config";
import { createSmsAgentPrompt } from "./sms-prompts";
import { smsAgentTools } from "./sms-tools";
import { getCheckpointer } from "./checkpointer";
import { getOrCreateGuestProfile, getGuestOrderHistory } from "@/actions/guest-profiles";
import { db } from "@/db";
import { hotels } from "@/db/schemas";
import { eq } from "drizzle-orm";

// SMS conversations can be long-lived, allow up to 30 turns of history
const MAX_SMS_MESSAGES = 30 * 4;

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

    const trimmed =
      deduped.length > n ? deduped.slice(deduped.length - n) : deduped;
    return trimmed;
  };
}

const SmsGraphState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: appendCap<BaseMessage>(MAX_SMS_MESSAGES),
  }),
});

// SMS concierge agent — separate from the web concierge
const smsAgent = createReactAgent({
  llm: model,
  name: AGENTS.SMS_CONCIERGE,
  prompt: async (state, config) => {
    const hotelId = config.metadata!.hotelId! as number;
    const guestPhone = config.metadata!.guestPhone! as string;

    // Load guest profile and order history
    const profile = await getOrCreateGuestProfile(guestPhone);
    const orderHistory = await getGuestOrderHistory(guestPhone, 5);

    // Get hotel name
    const [hotel] = await db
      .select({ name: hotels.name })
      .from(hotels)
      .where(eq(hotels.id, hotelId))
      .limit(1);
    const hotelName = hotel?.name || "the hotel";

    const prompt = createSmsAgentPrompt(
      hotelId,
      hotelName,
      profile,
      orderHistory.map((o) => ({
        restaurantName: o.restaurantName,
        items: o.items,
        createdAt: o.createdAt,
      }))
    );

    const filtered = state.messages.filter((m) => m.getType() !== "system");
    return [prompt, ...filtered];
  },
  tools: smsAgentTools,
});

const smsWorkflow = new StateGraph(SmsGraphState)
  .addNode("sms_agent", smsAgent)
  .addEdge(START, "sms_agent");

let smsApp: ReturnType<typeof smsWorkflow.compile> | null = null;

async function getSmsApp(): Promise<ReturnType<typeof smsWorkflow.compile>> {
  if (!smsApp) {
    smsApp = smsWorkflow.compile({
      checkpointer: await getCheckpointer(),
    });
  }
  return smsApp;
}

/**
 * Invoke the SMS agent with a guest's message and return the response text.
 * Non-streaming: collects the full response, then returns it for SMS delivery.
 */
export async function invokeSmsAgent({
  message,
  threadId,
  hotelId,
  guestPhone,
}: {
  message: string;
  threadId: string;
  hotelId: number;
  guestPhone: string;
}): Promise<string> {
  const app = await getSmsApp();

  const result = await app.invoke(
    {
      messages: [new HumanMessage(message)],
    },
    {
      configurable: { thread_id: threadId },
      metadata: { hotelId, guestPhone },
    }
  );

  // Extract the last AI message text
  const messages = result.messages as BaseMessage[];
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.getType() === "ai" && typeof msg.content === "string" && msg.content.trim()) {
      return msg.content.trim();
    }
    // Handle array content (tool use responses)
    if (msg.getType() === "ai" && Array.isArray(msg.content)) {
      const textParts = msg.content
        .filter((part): part is { type: "text"; text: string } =>
          typeof part === "object" && part !== null && "type" in part && part.type === "text"
        )
        .map((part) => part.text);
      if (textParts.length > 0) {
        return textParts.join("\n").trim();
      }
    }
  }

  return "Sorry, I couldn't process your request. Please try again.";
}
