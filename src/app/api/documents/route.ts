import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth";
import { getEnvironmentReadiness } from "@/lib/env";
import { ingestDocument } from "@/lib/rag/ingest";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const readiness = getEnvironmentReadiness();

    if (!readiness.uploadReady) {
      return NextResponse.json(
        {
          error: `Document upload is not configured. Missing environment variables: ${[
            ...readiness.missingBrowserEnv,
            ...readiness.missingServerEnv
          ].join(", ")}.`
        },
        { status: 500 }
      );
    }

    const profile = await requireAdmin();
    const formData = await request.formData();
    const file = formData.get("file");
    const title = String(formData.get("title") ?? "").trim();

    if (!(file instanceof File) || !title) {
      return NextResponse.json({ error: "A title and file are required." }, { status: 400 });
    }

    const result = await ingestDocument({
      file,
      title,
      userId: profile.id
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to upload document." },
      { status: 500 }
    );
  }
}
