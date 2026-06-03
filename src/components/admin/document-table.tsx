"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import type { DocumentRecord } from "@/types";

function getStatusTone(status: DocumentRecord["status"]) {
  if (status === "ready") return "text-primary";
  if (status === "failed") return "text-danger";
  return "text-muted-foreground";
}

export function DocumentTable({ documents }: { documents: DocumentRecord[] }) {
  const router = useRouter();

  async function removeDocument(id: string) {
    try {
      const response = await fetch(`/api/documents/${id}`, {
        method: "DELETE"
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Delete failed.");
      }
      toast.success("Document removed.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed.");
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border/70 px-4 py-4 sm:px-6 sm:py-5">
        <h2 className="font-[family-name:var(--font-heading)] text-2xl font-semibold">Document library</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Review processing status, chunk coverage, extraction strategy, and remove outdated sources cleanly.
        </p>
      </div>
      <div className="space-y-3 p-4 sm:hidden">
        {documents.length ? (
          documents.map((document) => (
            <div key={document.id} className="rounded-2xl border border-border/70 bg-background/80 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{document.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{document.file_name}</p>
                </div>
                <Badge className={getStatusTone(document.status)}>{document.status}</Badge>
              </div>
              <div className="mt-4 grid gap-3 text-sm">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Extraction</p>
                  <p className="mt-1 font-medium capitalize">{document.metadata?.extraction_method ?? "unknown"}</p>
                  {document.metadata?.layout_preserved ? (
                    <p className="text-xs text-muted-foreground">Layout preserved</p>
                  ) : null}
                  {document.metadata?.parser ? (
                    <p className="text-xs text-muted-foreground">{document.metadata.parser}</p>
                  ) : null}
                  {document.metadata?.ocr_model ? (
                    <p className="text-xs text-muted-foreground">{document.metadata.ocr_model}</p>
                  ) : null}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Chunks</p>
                    <p className="mt-1 font-medium">{document.chunk_count}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Updated</p>
                    <p className="mt-1 text-sm text-muted-foreground">{formatDate(document.updated_at)}</p>
                  </div>
                </div>
                {document.metadata?.extraction_reason ? (
                  <p className="rounded-2xl bg-secondary/50 px-3 py-2 text-xs leading-5 text-muted-foreground">
                    {document.metadata.extraction_reason}
                  </p>
                ) : null}
                <Button variant="ghost" size="sm" className="justify-start" onClick={() => removeDocument(document.id)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remove
                </Button>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-10 text-center text-muted-foreground">
            No documents uploaded yet.
          </div>
        )}
      </div>
      <div className="hidden overflow-x-auto sm:block">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-secondary/60 text-muted-foreground">
            <tr>
              <th className="px-6 py-4 font-medium">Title</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium">Extraction</th>
              <th className="px-6 py-4 font-medium">Chunks</th>
              <th className="px-6 py-4 font-medium">Updated</th>
              <th className="px-6 py-4 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {documents.length ? (
              documents.map((document) => (
                <tr key={document.id} className="border-t border-border/60 align-top">
                  <td className="px-6 py-4">
                    <p className="font-medium">{document.title}</p>
                    <p className="text-xs text-muted-foreground">{document.file_name}</p>
                  </td>
                  <td className="px-6 py-4">
                    <Badge className={getStatusTone(document.status)}>{document.status}</Badge>
                    {document.metadata?.extraction_reason ? (
                      <p className="mt-2 max-w-xs text-xs leading-5 text-muted-foreground">
                        {document.metadata.extraction_reason}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-medium capitalize">{document.metadata?.extraction_method ?? "unknown"}</p>
                    {document.metadata?.layout_preserved ? (
                      <p className="text-xs text-muted-foreground">Layout preserved</p>
                    ) : null}
                    {document.metadata?.parser ? (
                      <p className="text-xs text-muted-foreground">{document.metadata.parser}</p>
                    ) : null}
                    {document.metadata?.ocr_model ? (
                      <p className="text-xs text-muted-foreground">{document.metadata.ocr_model}</p>
                    ) : null}
                  </td>
                  <td className="px-6 py-4">{document.chunk_count}</td>
                  <td className="px-6 py-4 text-muted-foreground">{formatDate(document.updated_at)}</td>
                  <td className="px-6 py-4">
                    <Button variant="ghost" size="sm" onClick={() => removeDocument(document.id)}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Remove
                    </Button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-muted-foreground">
                  No documents uploaded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
