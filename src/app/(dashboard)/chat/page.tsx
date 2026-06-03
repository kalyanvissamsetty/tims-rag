import { ChatWorkspace } from "@/components/chat/chat-workspace";
import { SetupReadinessCard } from "@/components/setup-readiness-card";
import { getCurrentProfile, requireUser } from "@/lib/auth";
import { getEnvironmentReadiness } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRagSettings } from "@/lib/rag/retrieve";
import type { ChatMessageRecord } from "@/types";

export default async function ChatPage() {
  const user = await requireUser();
  const profile = await getCurrentProfile(user.id);
  const supabase = createAdminClient();
  const settings = await getRagSettings();
  const readiness = getEnvironmentReadiness();

  const { data: sessions } = await supabase
    .from("chat_sessions")
    .select("id, title, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  const selectedSessionId = sessions?.[0]?.id;

  let messages: ChatMessageRecord[] = [];

  if (selectedSessionId) {
    const { data } = await supabase
      .from("chat_messages")
      .select("id, session_id, role, content, sources, created_at")
      .eq("session_id", selectedSessionId)
      .order("created_at", { ascending: true });

    messages = (data ?? []) as ChatMessageRecord[];
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
      {!readiness.chatReady ? (
        <div className="shrink-0 px-4 pt-4 lg:px-6 lg:pt-6">
          <SetupReadinessCard readiness={readiness} title="Chat backend readiness" />
        </div>
      ) : null}
      <ChatWorkspace
        initialSessions={sessions ?? []}
        initialMessages={messages}
        profile={{
          full_name: profile?.full_name ?? user.user_metadata?.full_name ?? null,
          email: profile?.email ?? user.email ?? "",
          role: profile?.role ?? "user"
        }}
        responseStyle={settings.response_style}
        systemPrompt={settings.system_prompt}
        allowCitations={settings.allow_citations}
        disabled={!readiness.chatReady}
      />
    </div>
  );
}
