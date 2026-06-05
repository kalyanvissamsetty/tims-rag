import { createAdminClient } from "@/lib/supabase/admin";
import { createEmbedding } from "@/lib/rag/openai";
import type { RagSettings } from "@/types";

const MIN_SIMILARITY = 0.3;

export async function getRagSettings() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("rag_settings")
    .select("id, system_prompt, response_style, top_k, temperature, allow_citations, updated_at")
    .eq("id", 1)
    .single<RagSettings>();

  return (
    data ?? {
      id: 1,
      system_prompt:
        "You are a retrieval-first assistant. Answer only from the uploaded documents. If the answer is not in the provided context, say you do not know.",
      response_style: "balanced",
      top_k: 6,
      temperature: 0.2,
      allow_citations: true,
      updated_at: new Date().toISOString()
    }
  );
}

export async function retrieveRelevantChunks(query: string, topK: number) {
  const supabase = createAdminClient();
  const embedding = await createEmbedding(query);

  const { data, error } = await supabase.rpc("match_document_chunks", {
    query_embedding: embedding,
    match_count: topK
  });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as Array<{
    id: string;
    document_id: string;
    content: string;
    similarity: number;
    file_name: string;
    title: string;
  }>).filter((chunk) => chunk.similarity >= MIN_SIMILARITY);
}
