import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { buildConversationAwareQuestion, buildSystemPrompt } from "@/lib/rag/prompts";
import { getRagSettings, retrieveRelevantChunks } from "@/lib/rag/retrieve";
import { analyzeChatRoute, assessDocumentSupport, createConversationalAnswer, generateChatTitle, sanitizeAssistantAnswer, streamGroundedAnswer } from "@/lib/rag/openai";
import { truncate } from "@/lib/utils";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ChatMessageRecord, ChatSource } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const chatSchema = z.object({
  sessionId: z.string().uuid().nullable().optional(),
  message: z.string().trim().min(2)
});

const MEMORY_WINDOW = 8;
const fallback = "I don’t have enough information in the uploaded documents to answer that yet.";
const scopeFallback =
  "I can help with greetings, this app, and questions about the current chat. For factual or advice questions, I can answer only from the uploaded documents.";
const TITLE_MIN_MESSAGE_COUNT = 4;

const EXPLICIT_OUTSIDE_SCOPE_PATTERN =
  /\b(weather|temperature|forecast|rain|sunny|doctor|medical|health|hydration|water intake|symptom|medicine|python|javascript|java|code|coding|program|bug fix|capital of|president|prime minister|stock|crypto|recipe|restaurant|travel|hotel)\b/i;

function looksLikeDocumentLookupQuery(message: string) {
  const normalized = message.trim();

  if (!normalized || normalized.length > 80) {
    return false;
  }

  if (EXPLICIT_OUTSIDE_SCOPE_PATTERN.test(normalized)) {
    return false;
  }

  const compact = normalized.replace(/[?!.]/g, "").trim();
  const wordCount = compact.split(/\s+/).filter(Boolean).length;
  const acronymOnly = /^[A-Z0-9][A-Z0-9\s/-]{1,20}$/.test(compact);
  const definitionPrompt = /^(what is|what are|define|meaning of|explain)\s+[a-z0-9][a-z0-9\s/-]{0,40}$/i.test(compact);
  const nounLookup = wordCount >= 1 && wordCount <= 4 && /^[a-z0-9][a-z0-9\s/-]+$/i.test(compact);

  return acronymOnly || definitionPrompt || nounLookup;
}

function encodeEvent(payload: Record<string, unknown>) {
  return `${JSON.stringify(payload)}\n`;
}

function looksLikePlaceholderTitle(title: string, firstMessage: string) {
  const normalizedTitle = title.trim().toLowerCase();
  const normalizedFirstMessage = truncate(firstMessage, 60).trim().toLowerCase();

  return normalizedTitle === "new chat" || normalizedTitle === normalizedFirstMessage;
}

function getFirstUserMessage(
  recentMessages: Array<Pick<ChatMessageRecord, "role" | "content">>,
  fallbackMessage: string
) {
  const firstUserMessage = recentMessages.find((message) => message.role === "user")?.content?.trim();
  return firstUserMessage || fallbackMessage;
}

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json({ messages: [] });
    }

    const supabase = createAdminClient();
    const { data: session } = await supabase
      .from("chat_sessions")
      .select("id")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!session) {
      return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    }

    const { data: messages } = await supabase
      .from("chat_messages")
      .select("id, session_id, role, content, sources, created_at")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    return NextResponse.json({ messages: (messages ?? []) as ChatMessageRecord[] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = chatSchema.parse(await request.json());
    const settings = await getRagSettings();
    const supabase = createAdminClient();

    let sessionId = body.sessionId ?? null;
    let sessionTitle = "New chat";
    let recentMessages: ChatMessageRecord[] = [];
    const isNewSession = !sessionId;

    if (sessionId) {
      const { data: existing } = await supabase
        .from("chat_sessions")
        .select("id, title")
        .eq("id", sessionId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!existing) {
        return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
      }
      sessionTitle = existing.title;

      const { data: priorMessages } = await supabase
        .from("chat_messages")
        .select("id, session_id, role, content, sources, created_at")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: false })
        .limit(MEMORY_WINDOW);

      recentMessages = ((priorMessages ?? []) as ChatMessageRecord[]).reverse();
    } else {
      const { data: created, error: sessionError } = await supabase
        .from("chat_sessions")
        .insert({
          user_id: user.id,
          title: truncate(body.message, 60)
        })
        .select("id, title")
        .single();

      if (sessionError || !created) {
        throw new Error(sessionError?.message ?? "Failed to create chat session.");
      }

      sessionId = created.id;
      sessionTitle = created.title;
    }

    await supabase.from("chat_messages").insert({
      session_id: sessionId,
      role: "user",
      content: body.message,
      sources: null
    });

    const routeDecision = await analyzeChatRoute({
      recentMessages,
      currentMessage: body.message
    });

    const effectiveIntent =
      routeDecision.intent === "outside_scope" && looksLikeDocumentLookupQuery(body.message)
        ? "document"
        : routeDecision.intent;

    const chunks =
      effectiveIntent === "document"
        ? await retrieveRelevantChunks(routeDecision.standaloneQuery ?? body.message, settings.top_k)
        : [];
    const sources: ChatSource[] = effectiveIntent !== "document"
      ? []
      : Array.from(
          new Map(chunks.map((chunk) => [chunk.file_name, { title: chunk.title, fileName: chunk.file_name }])).values()
        );

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();

        const send = (payload: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(encodeEvent(payload)));
        };

        const close = () => {
          try {
            controller.close();
          } catch {
            // no-op if already closed
          }
        };

        void (async () => {
          let answer = "";

          try {
            send({ type: "meta", sessionId, sessionTitle, sources });

            if (
              effectiveIntent === "social" ||
              effectiveIntent === "chat_memory" ||
              effectiveIntent === "product_capability"
            ) {
              answer = await createConversationalAnswer({
                recentMessages,
                currentMessage: body.message,
                intent: effectiveIntent,
                temperature: settings.temperature
              });
              answer = sanitizeAssistantAnswer(answer);
              send({ type: "delta", delta: answer });
            } else if (effectiveIntent === "outside_scope") {
              answer = sanitizeAssistantAnswer(scopeFallback);
              send({ type: "delta", delta: answer });
            } else if (!chunks.length) {
              answer = sanitizeAssistantAnswer(fallback);
              send({ type: "delta", delta: answer });
            } else {
              const context = chunks
                .map(
                  (chunk, index) =>
                    `[Source ${index + 1}] Title: ${chunk.title}\nFilename: ${chunk.file_name}\nSimilarity: ${chunk.similarity.toFixed(3)}\nExcerpt: ${chunk.content}`
                )
                .join("\n\n");
              const hasDirectSupport = await assessDocumentSupport({
                question: buildConversationAwareQuestion({
                  recentMessages,
                  currentQuestion: body.message
                }),
                context
              });

              if (!hasDirectSupport) {
                answer = sanitizeAssistantAnswer(fallback);
                send({ type: "delta", delta: answer });
              } else {
                answer = await streamGroundedAnswer(
                  {
                    systemPrompt: buildSystemPrompt(settings, context),
                    question: buildConversationAwareQuestion({
                      recentMessages,
                      currentQuestion: body.message
                    }),
                    temperature: settings.temperature
                  },
                  {
                    signal: request.signal,
                    onTextDelta(delta) {
                      send({ type: "delta", delta });
                    }
                  }
                );
              }
            }

            if (request.signal.aborted) {
              send({ type: "aborted" });
              close();
              return;
            }

            const { data: assistantMessage, error: messageError } = await supabase
              .from("chat_messages")
              .insert({
                session_id: sessionId,
                role: "assistant",
                content: answer || fallback,
                sources
              })
              .select("id, session_id, role, content, sources, created_at")
              .single();

            if (messageError || !assistantMessage) {
              throw new Error(messageError?.message ?? "Failed to save assistant message.");
            }

            let nextSessionTitle = sessionTitle;

            const totalMessageCount = recentMessages.length + 2;
            const firstUserMessage = getFirstUserMessage(recentMessages, body.message);

            if (looksLikePlaceholderTitle(sessionTitle, firstUserMessage) && totalMessageCount >= TITLE_MIN_MESSAGE_COUNT) {
              try {
                const generatedTitle = await generateChatTitle({
                  recentMessages,
                  currentMessage: body.message,
                  assistantReply: answer || fallback
                });

                if (generatedTitle) {
                  nextSessionTitle = truncate(generatedTitle, 60);
                }
              } catch {
                if (isNewSession) {
                  nextSessionTitle = truncate(body.message, 60);
                }
              }
            }

            await supabase
              .from("chat_sessions")
              .update({ updated_at: new Date().toISOString(), title: nextSessionTitle })
              .eq("id", sessionId);

            sessionTitle = nextSessionTitle;

            send({
              type: "complete",
              sessionId,
              sessionTitle: nextSessionTitle,
              message: assistantMessage as ChatMessageRecord
            });
            close();
          } catch (error) {
            send({
              type: "error",
              error: error instanceof Error ? error.message : "Failed to complete chat request.",
              sessionId,
              sessionTitle
            });
            close();
          }
        })();
      },
      cancel() {
        request.signal.throwIfAborted?.();
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive"
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Please enter at least 2 characters before sending." }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to complete chat request." },
      { status: 500 }
    );
  }
}
