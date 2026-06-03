"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UploadCloud } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DocumentUploader({ disabled = false }: { disabled?: boolean }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;
    setLoading(true);
    const form = event.currentTarget;

    try {
      const response = await fetch("/api/documents", {
        method: "POST",
        body: new FormData(form)
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Upload failed.");
      }
      toast.success(
        payload.metadata?.extraction_method === "structured"
          ? "Document uploaded and indexed with layout-aware extraction."
          : payload.metadata?.extraction_method === "ocr"
            ? "Document uploaded and indexed with OCR fallback."
            : "Document uploaded and indexed."
      );
      form.reset();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="p-4 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">Knowledge ingestion</p>
          <h2 className="mt-3 font-[family-name:var(--font-heading)] text-xl font-semibold sm:text-2xl">Upload source files</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Add PDFs, DOCX Word files, PPTX PowerPoint files, Markdown, text documents, or images. Table-heavy files now use layout-aware extraction so rows, headers, and slide sections survive retrieval much better.
          </p>
        </div>
      </div>

      <form className="mt-6 grid gap-4 md:grid-cols-[1fr_1fr_auto]" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <Label htmlFor="title">Document title</Label>
          <Input id="title" name="title" placeholder="Employee handbook v2" required disabled={disabled || loading} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="file">File</Label>
          <Input
            id="file"
            name="file"
            type="file"
            required
            disabled={disabled || loading}
            accept=".pdf,.docx,.pptx,.txt,.md,image/png,image/jpeg,image/webp"
            className="h-11 cursor-pointer px-0 py-0 text-sm file:mr-3 file:h-full file:cursor-pointer file:rounded-l-xl file:border-0 file:border-r file:border-input file:bg-secondary file:px-4 file:text-sm file:font-medium file:text-foreground hover:file:bg-secondary/80"
          />
        </div>
        <div className="flex items-end">
          <Button className="w-full" disabled={disabled || loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            <span className="ml-2">Upload</span>
          </Button>
        </div>
      </form>
    </Card>
  );
}
