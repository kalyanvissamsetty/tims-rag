import { DocumentTable } from "@/components/admin/document-table";
import { DocumentUploader } from "@/components/admin/document-uploader";
import { RagSettingsForm } from "@/components/admin/rag-settings-form";
import { SetupReadinessCard } from "@/components/setup-readiness-card";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth";
import { getEnvironmentReadiness } from "@/lib/env";
import { getRagSettings } from "@/lib/rag/retrieve";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DocumentRecord } from "@/types";

export default async function AdminPage() {
  await requireAdmin();
  const supabase = createAdminClient();
  const settings = await getRagSettings();
  const readiness = getEnvironmentReadiness();

  const [{ data: documents }, { count: userCount }, { count: sessionCount }] = await Promise.all([
    supabase.from("documents").select("*").order("updated_at", { ascending: false }),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("chat_sessions").select("id", { count: "exact", head: true })
  ]);

  const typedDocuments = (documents ?? []) as DocumentRecord[];
  const readyDocuments = typedDocuments.filter((document) => document.status === "ready").length;
  const ocrDocuments = typedDocuments.filter((document) => document.metadata?.extraction_method === "ocr").length;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden p-3 sm:p-4 lg:p-6">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden pr-1 sm:space-y-6">
      {!readiness.adminReady ? <SetupReadinessCard readiness={readiness} /> : null}

      <div className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="p-4 sm:p-5">
          <p className="text-sm text-muted-foreground">Ready documents</p>
          <p className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold sm:text-4xl">{readyDocuments}</p>
          <Badge className="mt-4">Indexed knowledge</Badge>
        </Card>
        <Card className="p-4 sm:p-5">
          <p className="text-sm text-muted-foreground">Registered users</p>
          <p className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold sm:text-4xl">{userCount ?? 0}</p>
          <Badge className="mt-4">Auth enabled</Badge>
        </Card>
        <Card className="p-4 sm:p-5">
          <p className="text-sm text-muted-foreground">Chat sessions</p>
          <p className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold sm:text-4xl">{sessionCount ?? 0}</p>
          <Badge className="mt-4">History stored</Badge>
        </Card>
        <Card className="p-4 sm:p-5">
          <p className="text-sm text-muted-foreground">OCR processed</p>
          <p className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold sm:text-4xl">{ocrDocuments}</p>
          <Badge className="mt-4">Scanned docs</Badge>
        </Card>
      </div>

      <DocumentUploader disabled={!readiness.uploadReady} />
      <RagSettingsForm settings={settings} disabled={!readiness.chatReady} />
      <DocumentTable documents={typedDocuments} />
      </div>
    </div>
  );
}
