"use client";

import { useMemo, useState } from "react";
import { HelpCircle, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { RagSettings } from "@/types";

const FIELD_HELP = {
  systemPrompt:
    "The master instruction for the assistant. Use this to define tone, strictness, formatting expectations, and special rules like how to answer table questions.",
  responseStyle:
    "Controls the shape of the final answer. Pick strict for safest grounded answers, balanced for a good default, concise for short responses, and detailed for fuller explanations.",
  topK:
    "How many retrieved chunks are passed to the model. Lower values reduce noise, higher values help when answers are spread across multiple sections.",
  temperature:
    "Controls randomness. Lower values are better for document-grounded answers. Most RAG setups work best between 0.1 and 0.3.",
  allowCitations:
    "Allows the assistant to mention source support when useful. Even with this on, the UI can still stay clean and avoid showing filenames unless asked."
} as const;

const RESPONSE_STYLE_OPTIONS: Array<{
  value: RagSettings["response_style"];
  label: string;
  description: string;
}> = [
  {
    value: "strict",
    label: "Strict",
    description: "Best for compliance and operational accuracy. Refuses when the retrieved context is weak or incomplete."
  },
  {
    value: "balanced",
    label: "Balanced",
    description: "Strong default. Stays grounded while still giving useful, readable answers with brief explanation."
  },
  {
    value: "concise",
    label: "Concise",
    description: "Keeps responses short and direct. Useful for quick lookups and high-volume internal usage."
  },
  {
    value: "detailed",
    label: "Detailed",
    description: "Gives fuller answers and more supporting detail while still staying inside the retrieved documents."
  }
];

function FieldLabel({
  htmlFor,
  title,
  help,
  isOpen,
  onToggle
}: {
  htmlFor?: string;
  title: string;
  help: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label htmlFor={htmlFor}>{title}</Label>
        <button
          type="button"
          aria-label={`What does ${title} mean?`}
          onClick={onToggle}
          className={cn(
            "inline-flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground transition hover:text-foreground",
            isOpen && "text-primary"
          )}
        >
          <HelpCircle className="h-4 w-4" />
        </button>
      </div>
      {isOpen ? <p className="rounded-2xl border border-border/70 bg-secondary/40 px-3 py-2 text-xs leading-5 text-muted-foreground">{help}</p> : null}
    </div>
  );
}

export function RagSettingsForm({ settings, disabled = false }: { settings: RagSettings; disabled?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [openHelp, setOpenHelp] = useState<keyof typeof FIELD_HELP | null>(null);
  const [formState, setFormState] = useState({
    systemPrompt: settings.system_prompt,
    responseStyle: settings.response_style,
    topK: String(settings.top_k),
    temperature: String(settings.temperature),
    allowCitations: settings.allow_citations
  });
  const [savedState, setSavedState] = useState({
    systemPrompt: settings.system_prompt,
    responseStyle: settings.response_style,
    topK: String(settings.top_k),
    temperature: String(settings.temperature),
    allowCitations: settings.allow_citations
  });

  const selectedStyleDescription = useMemo(
    () => RESPONSE_STYLE_OPTIONS.find((option) => option.value === formState.responseStyle)?.description ?? "",
    [formState.responseStyle]
  );

  const isDirty =
    formState.systemPrompt !== savedState.systemPrompt ||
    formState.responseStyle !== savedState.responseStyle ||
    formState.topK !== savedState.topK ||
    formState.temperature !== savedState.temperature ||
    formState.allowCitations !== savedState.allowCitations;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || !isDirty) return;
    setLoading(true);

    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt: formState.systemPrompt,
          responseStyle: formState.responseStyle,
          topK: Number(formState.topK),
          temperature: Number(formState.temperature),
          allowCitations: formState.allowCitations
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Save failed.");
      }
      setSavedState(formState);
      toast.success("RAG settings saved.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setLoading(false);
    }
  }

  function toggleHelp(key: keyof typeof FIELD_HELP) {
    setOpenHelp((current) => (current === key ? null : key));
  }

  return (
    <Card className="p-6">
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">System query</p>
      <h2 className="mt-3 font-[family-name:var(--font-heading)] text-2xl font-semibold">Configure response behavior</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
        Tune the assistant’s system prompt, response density, retrieval depth, citation display, and grounding strictness without changing code.
      </p>

      <form className="mt-6 grid gap-5" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <FieldLabel
            htmlFor="systemPrompt"
            title="System prompt"
            help={FIELD_HELP.systemPrompt}
            isOpen={openHelp === "systemPrompt"}
            onToggle={() => toggleHelp("systemPrompt")}
          />
          <Textarea
            id="systemPrompt"
            name="systemPrompt"
            value={formState.systemPrompt}
            onChange={(event) => setFormState((current) => ({ ...current, systemPrompt: event.target.value }))}
            disabled={disabled || loading}
          />
        </div>

        <div className="space-y-3">
          <FieldLabel
            title="Response style"
            help={FIELD_HELP.responseStyle}
            isOpen={openHelp === "responseStyle"}
            onToggle={() => toggleHelp("responseStyle")}
          />
          <input type="hidden" name="responseStyle" value={formState.responseStyle} />
          <div className="grid gap-3 md:grid-cols-2">
            {RESPONSE_STYLE_OPTIONS.map((option) => {
              const active = formState.responseStyle === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  disabled={disabled || loading}
                  onClick={() => setFormState((current) => ({ ...current, responseStyle: option.value }))}
                  className={cn(
                    "rounded-[22px] border p-4 text-left transition",
                    active
                      ? "border-primary bg-primary/8 shadow-sm"
                      : "border-border/70 bg-background hover:border-primary/35 hover:bg-secondary/35"
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-foreground">{option.label}</p>
                    <span
                      className={cn(
                        "inline-flex h-4 w-4 rounded-full border",
                        active ? "border-primary bg-primary" : "border-border"
                      )}
                    />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{option.description}</p>
                </button>
              );
            })}
          </div>
          <p className="text-xs leading-5 text-muted-foreground">{selectedStyleDescription}</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <FieldLabel
              htmlFor="topK"
              title="Top K chunks"
              help={FIELD_HELP.topK}
            isOpen={openHelp === "topK"}
            onToggle={() => toggleHelp("topK")}
          />
            <Input
              id="topK"
              name="topK"
              type="number"
              min={2}
              max={12}
              value={formState.topK}
              onChange={(event) => setFormState((current) => ({ ...current, topK: event.target.value }))}
              disabled={disabled || loading}
            />
          </div>
          <div className="space-y-2">
            <FieldLabel
              htmlFor="temperature"
              title="Temperature"
              help={FIELD_HELP.temperature}
              isOpen={openHelp === "temperature"}
              onToggle={() => toggleHelp("temperature")}
            />
            <Input
              id="temperature"
              name="temperature"
              type="number"
              min={0}
              max={1}
              step={0.1}
              value={formState.temperature}
              onChange={(event) => setFormState((current) => ({ ...current, temperature: event.target.value }))}
              disabled={disabled || loading}
            />
          </div>
        </div>

        <div className="space-y-2">
          <FieldLabel
            title="Citations"
            help={FIELD_HELP.allowCitations}
            isOpen={openHelp === "allowCitations"}
            onToggle={() => toggleHelp("allowCitations")}
          />
          <label className="flex items-center gap-3 rounded-2xl border border-border/70 p-4 text-sm">
            <input
              type="checkbox"
              name="allowCitations"
              checked={formState.allowCitations}
              onChange={(event) => setFormState((current) => ({ ...current, allowCitations: event.target.checked }))}
              className="h-4 w-4"
              disabled={disabled || loading}
            />
            Include source citations in answers when relevant
          </label>
        </div>

        <div>
          <Button disabled={disabled || loading || !isDirty}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            <span className="ml-2">Save settings</span>
          </Button>
        </div>
      </form>
    </Card>
  );
}
