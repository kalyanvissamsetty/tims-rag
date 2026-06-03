import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth";
import { getEnvironmentReadiness } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const settingsSchema = z.object({
  systemPrompt: z.string().min(20),
  responseStyle: z.enum(["strict", "balanced", "concise", "detailed"]),
  topK: z.number().min(2).max(12),
  temperature: z.number().min(0).max(1),
  allowCitations: z.boolean()
});

export async function PATCH(request: Request) {
  try {
    const readiness = getEnvironmentReadiness();

    if (!readiness.chatReady) {
      return NextResponse.json(
        {
          error: `Settings cannot be saved yet. Missing environment variables: ${[
            ...readiness.missingBrowserEnv,
            ...readiness.missingServerEnv
          ].join(", ")}.`
        },
        { status: 500 }
      );
    }

    const profile = await requireAdmin();
    const body = settingsSchema.parse(await request.json());
    const supabase = createAdminClient();

    const { error } = await supabase.from("rag_settings").upsert({
      id: 1,
      system_prompt: body.systemPrompt,
      response_style: body.responseStyle,
      top_k: body.topK,
      temperature: body.temperature,
      allow_citations: body.allowCitations,
      updated_by: profile.id,
      updated_at: new Date().toISOString()
    });

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save settings." },
      { status: 500 }
    );
  }
}
