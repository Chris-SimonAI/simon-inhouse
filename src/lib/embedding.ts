import { OpenAIEmbeddings } from "@langchain/openai";
import { jsonToReadableText } from "./utils";

/**
 * Normalizes a vector to unit length for consistent distance calculations
 */
function normalizeVector(v: number[]): number[] {
  const norm = Math.sqrt(v.reduce((sum, val) => sum + val * val, 0));
  if (norm === 0) return v; // Avoid division by zero
  return v.map((val) => val / norm);
}

export async function generateEmbeddingFromJSON(
  data: Record<string, any>,
  model = "text-embedding-3-small"
): Promise<number[]> {
  const embeddings = new OpenAIEmbeddings({ model });
  const text = jsonToReadableText(data);
  const [embedding] = await embeddings.embedDocuments([text]);
  return normalizeVector(embedding);
}
