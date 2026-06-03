import type { ChatMessageRecord, RagSettings } from "@/types";

const responseStyleGuide: Record<RagSettings["response_style"], string> = {
  strict: "Be extremely strict. If the answer is not directly supported by the retrieved context, say you do not know.",
  balanced: "Be concise but helpful. Prefer direct answers followed by brief supporting detail from the context.",
  concise: "Keep answers short and direct. Use bullets only when it improves clarity.",
  detailed: "Provide a more complete answer, but still stay fully grounded in the provided context."
};

export function buildSystemPrompt(settings: RagSettings, context: string) {
  return [
    settings.system_prompt,
    "",
    responseStyleGuide[settings.response_style],
    "",
    "Non-negotiable rules:",
    "1. Use the supplied document context for factual claims about the user's documents. Never use prior knowledge, guesses, or external facts.",
    "2. You may use the supplied conversation history only to resolve references like 'that', 'those', 'previous answer', or to answer questions explicitly about the conversation itself.",
    "3. If the document context is insufficient for a factual answer, respond that the answer is not available in the uploaded documents.",
    "4. If the question asks for something broader than the context supports, answer only the supported portion and explicitly note the gap.",
    "5. Do not mention internal implementation details such as embeddings, vector search, or databases unless asked.",
    "6. Do not ask the user to upload, share, or provide documents unless the user explicitly asks what to do next.",
    settings.allow_citations
      ? "7. Keep source filenames, document titles, and citation-style references out of the answer unless the user explicitly asks for sources, citations, or supporting documents."
      : "7. Do not show citations, source callouts, document titles, or filenames in the answer.",
    "8. If the retrieved passages seem weak or unrelated, refuse to speculate and say you do not know from the provided documents.",
    "",
    "Context:",
    context
  ].join("\n");
}

export function formatConversationHistory(messages: Array<Pick<ChatMessageRecord, "role" | "content">>) {
  if (!messages.length) {
    return "No prior conversation.";
  }

  return messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) => `${message.role === "user" ? "User" : "Assistant"}: ${message.content}`)
    .join("\n");
}

export function buildConversationAwareQuestion(params: {
  recentMessages: Array<Pick<ChatMessageRecord, "role" | "content">>;
  currentQuestion: string;
}) {
  return [
    "Conversation history:",
    formatConversationHistory(params.recentMessages),
    "",
    "Current user message:",
    params.currentQuestion
  ].join("\n");
}
