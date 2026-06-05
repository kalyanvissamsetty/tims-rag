import OpenAI from "openai";

import { assertEnv } from "@/lib/env";
import { formatConversationHistory } from "@/lib/rag/prompts";
import type { ChatMessageRecord } from "@/types";

export type GroundedResponseStreamHandlers = {
  onTextDelta?: (delta: string) => void;
  signal?: AbortSignal;
};

const restrictedAnswerFallback = "I can only answer from the uploaded documents, and I don’t have enough information for that question.";

export type ChatRouteDecision = {
  intent: "social" | "chat_memory" | "product_capability" | "document" | "outside_scope";
  standaloneQuery: string | null;
};

const APP_CAPABILITY_CONTEXT = [
  "This app is a document-grounded chat workspace.",
  "It can answer from uploaded documents when retrieval finds supporting context.",
  "It should not answer general world-knowledge, health, weather, coding, legal, or advice questions unless those answers are supported by uploaded documents.",
  "It supports normal social conversation like greetings and thanks.",
  "It can answer questions about the chat itself, such as previous messages in the current conversation.",
  "Admins can upload PDF, DOCX, PPTX, TXT, Markdown, PNG, JPEG, and WebP files into the knowledge base.",
  "Image files can be uploaded by admins as source documents for OCR and retrieval.",
  "The chat composer itself does not support direct image-message attachments from end users."
].join(" ");

function getOpenAIClient() {
  assertEnv(["OPENAI_API_KEY"], "OpenAI client");
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

export function getChatModel() {
  return process.env.OPENAI_CHAT_MODEL ?? "gpt-4.1-mini";
}

export function getEmbeddingModel() {
  return process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";
}

export function getOcrModel() {
  return process.env.OPENAI_OCR_MODEL ?? "gpt-4o-mini";
}

export function getDocumentExtractionModel() {
  return process.env.OPENAI_DOCUMENT_MODEL ?? getOcrModel();
}

export function sanitizeAssistantAnswer(answer: string) {
  const trimmed = answer.trim();

  if (!trimmed) {
    return restrictedAnswerFallback;
  }

  const asksForMoreMaterial =
    /\b(upload|share|provide|reference|attach)\b[\s\S]{0,80}\b(document|documents|file|files|material|materials|context)\b/i.test(
      trimmed
    ) ||
    /\b(if|once|when)\s+you\s+\b(upload|share|provide|attach)\b/i.test(trimmed);

  const mentionsUnsupportedKnowledge =
    /\b(i can only answer from|not available in the uploaded documents|not supported by the available material|i don'?t have information about|i don'?t have enough information)\b/i.test(
      trimmed
    );

  const overclaimsGeneralAbility =
    /\b(i('m| am)\s+here\s+to\s+help\s+with\s+any\s+questions?|whether or not they'?re from uploaded documents|i can assist directly|i can help with general coding questions)\b/i.test(
      trimmed
    );

  if (asksForMoreMaterial || mentionsUnsupportedKnowledge || overclaimsGeneralAbility) {
    return restrictedAnswerFallback;
  }

  return trimmed.replace(/\byou(?:’|')ve shared\b/gi, "the uploaded documents");
}

export async function createEmbedding(input: string) {
  const client = getOpenAIClient();
  const response = await client.embeddings.create({
    model: getEmbeddingModel(),
    input
  });

  return response.data[0]?.embedding ?? [];
}

export async function createGroundedAnswer(params: {
  systemPrompt: string;
  question: string;
  temperature: number;
}) {
  const client = getOpenAIClient();

  const response = await client.responses.create({
    model: getChatModel(),
    instructions: params.systemPrompt,
    input: params.question,
    temperature: params.temperature
  });

  return response.output_text?.trim() || "I don’t have enough information in the uploaded documents to answer that.";
}

export async function rewriteQuestionWithHistory(params: {
  recentMessages: Array<Pick<ChatMessageRecord, "role" | "content">>;
  currentQuestion: string;
}) {
  if (!params.recentMessages.length) {
    return params.currentQuestion;
  }

  const client = getOpenAIClient();
  const response = await client.responses.create({
    model: getChatModel(),
    temperature: 0,
    input: [
      {
        role: "system",
        content:
          "Rewrite the user's latest message into a standalone retrieval query. Preserve the user's exact intent. Use conversation history only to resolve references like 'that', 'it', 'they', or ellipsis. If the latest message is already standalone, return it unchanged. Return only the rewritten query."
      },
      {
        role: "user",
        content: [
          `Conversation history:\n${formatConversationHistory(params.recentMessages)}`,
          `Latest message:\n${params.currentQuestion}`
        ].join("\n\n")
      }
    ]
  });

  return response.output_text?.trim() || params.currentQuestion;
}

export async function analyzeChatRoute(params: {
  recentMessages: Array<Pick<ChatMessageRecord, "role" | "content">>;
  currentMessage: string;
}): Promise<ChatRouteDecision> {
  const client = getOpenAIClient();
  const response = await client.responses.create({
    model: getChatModel(),
    temperature: 0,
    input: [
      {
        role: "system",
        content: [
          "You are a routing layer for a conversational RAG application.",
          "Decide whether the user's latest message should be handled as social chat, chat-memory, product-capability, document-grounded knowledge request, or outside-scope request.",
          "Classify as social only for greetings, thanks, polite acknowledgements, and brief small talk that does not ask for factual information or advice.",
          "Classify as chat_memory only for questions explicitly about previous messages in this same conversation.",
          "Classify as product_capability only for questions about this app's features, limits, uploads, settings, chat behavior, or admin workflow.",
          "Classify as document for factual questions that should be answered from uploaded documents, even if phrased casually.",
          "Classify as outside_scope for general world knowledge, weather, health, coding help, legal advice, recommendations, calculations, or topic follow-ups that are not about the app, not about chat memory, and not supported by uploaded documents yet.",
          "Do not treat a user-provided fact about the outside world as making that topic in-scope. Follow-up advice about such topics is still outside_scope.",
          "If the intent is document, rewrite the latest message into a standalone retrieval query using conversation history only to resolve references.",
          "Return only minified JSON with this exact shape:",
          '{"intent":"social"|"chat_memory"|"product_capability"|"document"|"outside_scope","standalone_query":string|null}'
        ].join(" ")
      },
      {
        role: "user",
        content: [
          `Conversation history:\n${formatConversationHistory(params.recentMessages)}`,
          `Latest message:\n${params.currentMessage}`
        ].join("\n\n")
      }
    ]
  });

  const raw = response.output_text?.trim();

  try {
    const parsed = JSON.parse(raw ?? "") as { intent?: string; standalone_query?: string | null };
    if (parsed.intent === "document") {
      return {
        intent: "document",
        standaloneQuery: parsed.standalone_query?.trim() || params.currentMessage
      };
    }

    if (parsed.intent === "social" || parsed.intent === "chat_memory" || parsed.intent === "product_capability" || parsed.intent === "outside_scope") {
      return {
        intent: parsed.intent,
        standaloneQuery: null
      };
    }

    return {
      intent: "outside_scope",
      standaloneQuery: null
    };
  } catch {
    const normalized = params.currentMessage.trim().toLowerCase();
    const socialFallback =
      /^(hi|hii|hello|hey|good morning|good afternoon|good evening|thanks|thank you|ok|okay|cool|great)\b/.test(normalized);
    const memoryFallback =
      /\b(last message|previous message|last answer|previous answer|what did you say|what did i ask|summarize this chat|what were we talking about)\b/.test(
        normalized
      );
    const capabilityFallback =
      /\b(upload|uploads|image|images|pdf|docx|pptx|markdown|txt|admin|chat|citation|citations|source|sources|response style|temperature|top k|settings|login|sign in|signup|sign up|password|rename|delete|conversation title|what can you do|why are you answering|why can'?t you answer)\b/.test(
        normalized
      );

    return {
      intent: socialFallback ? "social" : memoryFallback ? "chat_memory" : capabilityFallback ? "product_capability" : "document",
      standaloneQuery: socialFallback || memoryFallback || capabilityFallback ? null : params.currentMessage
    };
  }
}

export async function generateChatTitle(params: {
  recentMessages: Array<Pick<ChatMessageRecord, "role" | "content">>;
  currentMessage: string;
  assistantReply: string;
}) {
  const client = getOpenAIClient();
  const response = await client.responses.create({
    model: getChatModel(),
    temperature: 0.2,
    input: [
      {
        role: "system",
        content: [
          "Write a short, natural chat title for a conversation sidebar.",
          "Use 3 to 7 words.",
          "Focus on the user's intent or topic, not generic phrasing.",
          "Do not use quotes, punctuation at the end, or labels like Chat, Question, or Conversation.",
          "Return only the title text."
        ].join(" ")
      },
      {
        role: "user",
        content: [
          `Conversation history:\n${formatConversationHistory(params.recentMessages)}`,
          `Latest user message:\n${params.currentMessage}`,
          `Assistant reply:\n${params.assistantReply}`
        ].join("\n\n")
      }
    ]
  });

  return response.output_text?.trim() || "";
}

export async function streamConversationalAnswer(
  params: {
    recentMessages: Array<Pick<ChatMessageRecord, "role" | "content">>;
    currentMessage: string;
    temperature: number;
  },
  handlers: GroundedResponseStreamHandlers = {}
) {
  const client = getOpenAIClient();
  const stream = await client.responses.create({
    model: getChatModel(),
    temperature: params.temperature,
    stream: true,
    input: [
      {
        role: "system",
        content: [
          "You are TIMS AI, a conversational assistant for a document-grounded RAG app.",
          "You should respond naturally to greetings, thanks, clarifications, UX questions, and chat-history questions.",
          "You may use prior conversation to answer meta questions about the chat itself.",
          "If the user asks for external facts, domain knowledge, or factual claims that should come from uploaded documents, do not answer from general knowledge.",
          "In those cases, respond briefly that you can only answer from the uploaded documents and that the current question is not supported by the available material.",
          "Do not ask the user to upload, share, provide, or reference documents unless the user explicitly asks what to do next.",
          "Keep casual replies short, warm, and helpful. Do not mention internal implementation unless asked."
        ].join(" ")
      },
      {
        role: "user",
        content: [
          `Conversation history:\n${formatConversationHistory(params.recentMessages)}`,
          `Current message:\n${params.currentMessage}`
        ].join("\n\n")
      }
    ]
  });

  let text = "";

  for await (const event of stream) {
    if (handlers.signal?.aborted) {
      break;
    }

    if (event.type === "response.output_text.delta") {
      text += event.delta;
      handlers.onTextDelta?.(event.delta);
    }

    if (event.type === "error") {
      const streamError = event as unknown as { message?: string; error?: { message?: string } };
      throw new Error(streamError.error?.message ?? streamError.message ?? "Streaming failed.");
    }
  }

  return text.trim();
}

export async function createConversationalAnswer(params: {
  recentMessages: Array<Pick<ChatMessageRecord, "role" | "content">>;
  currentMessage: string;
  intent: "social" | "chat_memory" | "product_capability";
  temperature: number;
}) {
  const client = getOpenAIClient();
  const response = await client.responses.create({
    model: getChatModel(),
    temperature: params.temperature,
    input: [
      {
        role: "system",
        content: [
          "You are TIMS AI, a conversational assistant for a document-grounded RAG app.",
          `Allowed intent for this turn: ${params.intent}.`,
          "You should respond naturally only when the current turn is one of these allowed categories: greetings/thanks, chat-memory questions, or app capability/policy questions.",
          "You may use prior conversation only to answer meta questions about the chat itself.",
          `App capability context: ${APP_CAPABILITY_CONTEXT}`,
          "Never adopt user-provided facts about the outside world as if they are verified knowledge.",
          "Never continue conversation about weather, health, coding, legal, recommendations, or any other outside topic unless the answer is grounded in uploaded documents.",
          "If the current message tries to continue an outside topic, respond briefly that you can only answer from uploaded documents or help with this app and the current conversation.",
          "Do not ask the user to upload, share, provide, or reference documents unless the user explicitly asks what to do next.",
          "Keep allowed replies short, warm, and helpful. Do not mention internal implementation unless asked."
        ].join(" ")
      },
      {
        role: "user",
        content: [
          `Conversation history:\n${formatConversationHistory(params.recentMessages)}`,
          `Current message:\n${params.currentMessage}`
        ].join("\n\n")
      }
    ]
  });

  return response.output_text?.trim() || "";
}

export async function assessDocumentSupport(params: {
  question: string;
  context: string;
}) {
  const client = getOpenAIClient();
  const response = await client.responses.create({
    model: getChatModel(),
    temperature: 0,
    input: [
      {
        role: "system",
        content: [
          "You are a strict relevance gate for a document-grounded chat system.",
          "Decide whether the provided context directly supports answering the user's question.",
          "Mark unsupported if the context is weak, only tangentially related, or would require general knowledge, inference, advice, or speculation to answer.",
          "Return only minified JSON with this exact shape:",
          '{"supported":true|false,"reason":"short reason"}'
        ].join(" ")
      },
      {
        role: "user",
        content: `Question:\n${params.question}\n\nContext:\n${params.context}`
      }
    ]
  });

  try {
    const parsed = JSON.parse(response.output_text?.trim() ?? "") as { supported?: boolean };
    return Boolean(parsed.supported);
  } catch {
    return false;
  }
}

export async function streamGroundedAnswer(
  params: {
    systemPrompt: string;
    question: string;
    temperature: number;
  },
  handlers: GroundedResponseStreamHandlers = {}
) {
  const client = getOpenAIClient();
  const stream = await client.responses.create({
    model: getChatModel(),
    instructions: params.systemPrompt,
    input: params.question,
    temperature: params.temperature,
    stream: true
  });

  let text = "";

  for await (const event of stream) {
    if (handlers.signal?.aborted) {
      break;
    }

    if (event.type === "response.output_text.delta") {
      text += event.delta;
      handlers.onTextDelta?.(event.delta);
    }

    if (event.type === "error") {
      const streamError = event as unknown as { message?: string; error?: { message?: string } };
      throw new Error(streamError.error?.message ?? streamError.message ?? "Streaming failed.");
    }
  }

  return text.trim();
}

export async function extractTextWithManagedLayout(
  file: File,
  mode: "image" | "pdf" | "office" = "pdf"
) {
  const client = getOpenAIClient();
  const buffer = Buffer.from(await file.arrayBuffer());
  const instructionByMode = {
    image:
      "Extract all readable text from this file. Return plain text only. Preserve headings, paragraphs, numbered steps, and table-like rows when possible. Do not summarize, explain, or add commentary.",
    pdf:
      "Extract the full document as clean markdown. Preserve headings, bullet points, numbered lists, and especially tables as markdown tables with headers and rows whenever possible. Keep the source order, keep cell values accurate, do not summarize, and do not add commentary.",
    office:
      "Extract the full document as clean markdown. Preserve section headings, paragraphs, bullet points, numbered lists, and tables as markdown tables with headers and rows whenever possible. For presentations, separate slides with markdown headings like '## Slide 1'. Do not summarize, and do not add commentary."
  } satisfies Record<"image" | "pdf" | "office", string>;

  const response = await client.responses.create({
    model: getDocumentExtractionModel(),
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: instructionByMode[mode]
          },
          {
            type: "input_file",
            filename: file.name,
            file_data: `data:${file.type || "application/octet-stream"};base64,${buffer.toString("base64")}`
          }
        ]
      }
    ]
  });

  return {
    text: response.output_text?.trim() ?? "",
    model: getDocumentExtractionModel()
  };
}

export async function extractTextWithManagedOcr(file: File) {
  return extractTextWithManagedLayout(file, "image");
}
