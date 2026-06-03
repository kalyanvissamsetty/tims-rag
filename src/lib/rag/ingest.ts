import { createAdminClient } from "@/lib/supabase/admin";
import { chunkText, normalizeText } from "@/lib/rag/chunk";
import { extractDocumentText } from "@/lib/rag/documents";
import { createEmbedding } from "@/lib/rag/openai";
import type { DocumentMetadata } from "@/types";

async function ensureStorageBucket(bucket: string) {
  const supabase = createAdminClient();
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();

  if (listError) {
    throw new Error(`Could not verify storage bucket "${bucket}": ${listError.message}`);
  }

  const exists = (buckets ?? []).some((item) => item.name === bucket);

  if (exists) {
    return;
  }

  const { error: createError } = await supabase.storage.createBucket(bucket, {
    public: false,
    fileSizeLimit: "50MB"
  });

  if (createError && !createError.message.toLowerCase().includes("already exists")) {
    throw new Error(`Could not create storage bucket "${bucket}": ${createError.message}`);
  }
}

export async function ingestDocument(params: {
  file: File;
  title: string;
  userId: string;
}) {
  const { file, title, userId } = params;
  const supabase = createAdminClient();
  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "documents";
  const safeName = `${crypto.randomUUID()}-${file.name.replace(/\s+/g, "-")}`;
  const path = `${userId}/${safeName}`;

  await ensureStorageBucket(bucket);

  const { error: uploadError } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type,
    upsert: false
  });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const baseMetadata: DocumentMetadata = {
    source_title: title,
    source_file_name: file.name
  };

  const { data: document, error: docError } = await supabase
    .from("documents")
    .insert({
      title,
      file_name: file.name,
      file_path: path,
      mime_type: file.type || "text/plain",
      size_bytes: file.size,
      status: "processing",
      chunk_count: 0,
      metadata: baseMetadata,
      created_by: userId
    })
    .select("id")
    .single();

  if (docError || !document) {
    throw new Error(docError?.message ?? "Failed to create document record.");
  }

  try {
    const extracted = await extractDocumentText(file);
    const chunks = chunkText(extracted.text);

    if (!chunks.length) {
      throw new Error("No text could be extracted from the uploaded document.");
    }

    const rows = await Promise.all(
      chunks.map(async (chunk) => {
        const cleanContent = normalizeText(chunk.content);

        return {
          document_id: document.id,
          chunk_index: chunk.order,
          content: cleanContent,
          token_count: chunk.tokenCount,
          metadata: {
            title,
            file_name: file.name,
            extraction_method: extracted.metadata.extraction_method,
            parser: extracted.metadata.parser ?? null,
            layout_preserved: extracted.metadata.layout_preserved ?? false
          },
          embedding: await createEmbedding(cleanContent)
        };
      })
    );

    const batchSize = 25;

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);

      const { error: chunkError } = await supabase.from("document_chunks").insert(batch);

      if (chunkError) {
        throw new Error(chunkError.message);
      }
    }

    const { error: updateError } = await supabase
      .from("documents")
      .update({
        status: "ready",
        chunk_count: rows.length,
        metadata: {
          ...baseMetadata,
          ...extracted.metadata
        }
      })
      .eq("id", document.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return { id: document.id, chunkCount: rows.length, metadata: extracted.metadata };
  } catch (error) {
    await supabase
      .from("documents")
      .update({
        status: "failed",
        metadata: {
          ...baseMetadata,
          extraction_method: "native",
          extraction_reason: error instanceof Error ? error.message : "Document processing failed.",
          extraction_confidence: "fallback",
          layout_preserved: false
        }
      })
      .eq("id", document.id);
    throw error;
  }
}

export async function deleteDocument(documentId: string) {
  const supabase = createAdminClient();
  const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "documents";

  const { data: document, error } = await supabase
    .from("documents")
    .select("file_path")
    .eq("id", documentId)
    .single();

  if (error || !document) {
    throw new Error(error?.message ?? "Document not found.");
  }

  await supabase.storage.from(bucket).remove([document.file_path]);
  await supabase.from("document_chunks").delete().eq("document_id", documentId);
  await supabase.from("documents").delete().eq("id", documentId);
}
