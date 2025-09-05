import "server-only";
import { env } from "@/env";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";

let checkpointer: PostgresSaver | null = null;

export async function getCheckpointer(): Promise<PostgresSaver> {
  if (!checkpointer) {
    checkpointer = PostgresSaver.fromConnString(env.DATABASE_URL);
    await checkpointer.setup();
  }
  return checkpointer;
}
