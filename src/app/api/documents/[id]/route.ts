import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth";
import { deleteDocument } from "@/lib/rag/ingest";

export const runtime = "nodejs";

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    await deleteDocument(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete document." },
      { status: 500 }
    );
  }
}
