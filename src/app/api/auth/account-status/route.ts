import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";

const accountStatusSchema = z.object({
  email: z.string().trim().email()
});

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = accountStatusSchema.parse(await request.json());
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .ilike("email", body.email)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ exists: Boolean(data?.id) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Please provide a valid email address." }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to check account status." },
      { status: 500 }
    );
  }
}
