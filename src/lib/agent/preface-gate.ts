import "server-only";

import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { type Runnable } from "@langchain/core/runnables";
import { z } from "zod";

import { AGENTS, miniModel } from "./config";

const KEYWORDS = [
  "check-in",
  "checkin",
  "checkout",
];

const classifierSchema = z.object({
  emit: z.boolean(),
});

type ClassifierResult = z.infer<typeof classifierSchema>;

export function shouldSkipByHeuristic(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  if (!normalized) return true;

  const words = normalized.split(/\s+/).filter(Boolean);
  const hasKeyword = KEYWORDS.some((keyword) => normalized.includes(keyword));

  return words.length <= 8 && hasKeyword;
}

export async function shouldEmitPreface({
  message,
  inputType,
}: {
  message: string;
  inputType?: string;
}): Promise<boolean> {
  if (!message.trim()) return false;

  if (shouldSkipByHeuristic(message)) {
    return false;
  }

  try {
    const classifier = miniModel.withStructuredOutput(classifierSchema, {
      method: "jsonMode",
    }) as Runnable<unknown, ClassifierResult>;

    const result = await classifier.invoke([
      new SystemMessage(
        "You decide whether a hotel concierge agent should begin with a short warm two-sentence preface before answering a guest. Return JSON {\"emit\": true|false}. Choose true when the guest's request benefits from rapport or context. Choose false for short, factual lookups, yes/no confirmations, or when a quick answer is better."
      ),
      new HumanMessage(
        `Guest request: ${message}\nInput channel: ${inputType ?? "unknown"}`,
      ),
    ]);

    return result.emit ?? true;
  } catch (error) {
    console.error("Preface classifier failed", error);
    return true;
  }
}

export async function generatePreface(message: string): Promise<string> {
  const response = await miniModel.invoke([
    new SystemMessage(
      "You are a warm, professional hotel concierge. Write exactly two sentences (around 200 characters total) that warmly acknowledge the guest's request and build anticipation. Do not include specific details, prices, hours, names, or answers."
    ),
    new HumanMessage(message),
  ]);

  return response.content.toString();
}

export async function shouldEmitPrefaceNode(state: { messages: Array<HumanMessage | AIMessage> }) {
  const lastMessage = state.messages[state.messages.length - 1];
  
  if (!(lastMessage instanceof HumanMessage)) {
    return { shouldEmitPreface: false };
  }

  const userMessage = lastMessage.content.toString();

  const shouldEmit = await shouldEmitPreface({
    message: userMessage,
    inputType: "text",
  });

  return { shouldEmitPreface: shouldEmit };
}

export async function generatePrefaceNode(state: { messages: Array<HumanMessage | AIMessage> }) {
  const lastMessage = state.messages[state.messages.length - 1];
  
  if (!(lastMessage instanceof HumanMessage)) {
    return { messages: [] };
  }

  const userMessage = lastMessage.content.toString();
  const prefaceText = await generatePreface(userMessage);

  if (!prefaceText.trim()) {
    return { messages: [] };
  }

  const prefaceMessage = new AIMessage({
    content: prefaceText,
    name: AGENTS.CONCIERGE,
    additional_kwargs: {
      metadata: {
        agent: AGENTS.CONCIERGE,
        preface: true,
      },
    },
  });

  return {
    messages: [prefaceMessage],
  };
}

export function routeAfterClassifier(state: { shouldEmitPreface?: boolean }) {
  return state.shouldEmitPreface ? "generate_preface" : "concierge";
}
