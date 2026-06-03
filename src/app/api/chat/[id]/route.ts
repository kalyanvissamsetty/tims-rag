import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { truncate } from "@/lib/utils";

export const runtime = "nodejs";

const renameSchema = z.object({
  title: z.string().trim().min(1).max(60)
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = renameSchema.parse(await request.json());
    const supabase = createAdminClient();

    const { data: existing } = await supabase
      .from("chat_sessions")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    }

    const { data: session, error } = await supabase
      .from("chat_sessions")
      .update({
        title: truncate(body.title, 60),
        updated_at: new Date().toISOString()
      })
      .eq("id", id)
      .select("id, title, updated_at")
      .single();

    if (error || !session) {
      throw new Error(error?.message ?? "Failed to rename conversation.");
    }

    return NextResponse.json({ session });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to rename conversation." },
      { status: 500 }
    );
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const supabase = createAdminClient();

    const { data: existing } = await supabase
      .from("chat_sessions")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    }

    const { error } = await supabase.from("chat_sessions").delete().eq("id", id);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete conversation." },
      { status: 500 }
    );
  }
}
