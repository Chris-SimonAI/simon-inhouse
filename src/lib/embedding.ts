import { OpenAIEmbeddings } from "@langchain/openai";
import { jsonToReadableText } from "./utils";


export async function generateEmbeddingFromJSON(
  data: Record<string, any>,
  model = "text-embedding-3-small"
): Promise<number[]> {
  const embeddings = new OpenAIEmbeddings({ model });
  const text = jsonToReadableText(data);
  const [embedding] = await embeddings.embedDocuments([text]);
  return embedding;
}
