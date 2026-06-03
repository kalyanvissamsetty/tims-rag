export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type UserRole = "admin" | "user";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
};

export type DocumentMetadata = {
  extraction_method?: "native" | "ocr" | "structured";
  extraction_reason?: string | null;
  extraction_confidence?: "high" | "fallback";
  ocr_model?: string | null;
  parser?: string | null;
  layout_preserved?: boolean;
  source_title?: string;
  source_file_name?: string;
  [key: string]: Json | undefined;
};

export type DocumentRecord = {
  id: string;
  title: string;
  file_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  status: "processing" | "ready" | "failed";
  chunk_count: number;
  metadata: DocumentMetadata | null;
  created_at: string;
  updated_at: string;
};

export type ChatSource = {
  title: string;
  fileName: string;
};

export type ChatMessageRecord = {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  sources: ChatSource[] | null;
  created_at: string;
};

export type RagSettings = {
  id: number;
  system_prompt: string;
  response_style: "strict" | "balanced" | "concise" | "detailed";
  top_k: number;
  temperature: number;
  allow_citations: boolean;
  updated_at: string;
};
