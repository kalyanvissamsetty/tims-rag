import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { EnvironmentReadiness } from "@/lib/env";

export function SetupReadinessCard({
  readiness,
  title,
  description
}: {
  readiness: EnvironmentReadiness;
  title?: string;
  description?: string;
}) {
  const missing = [...readiness.missingBrowserEnv, ...readiness.missingServerEnv];
  const ready = missing.length === 0;

  return (
    <Card className="p-5">
      <div className="flex items-start gap-4">
        <div className={`mt-0.5 rounded-2xl p-3 ${ready ? "bg-primary/10 text-primary" : "bg-danger/10 text-danger"}`}>
          {ready ? <CheckCircle2 className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-[family-name:var(--font-heading)] text-xl font-semibold">
              {title ?? "Deployment readiness"}
            </h2>
            <Badge>{ready ? "Configured" : "Action required"}</Badge>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {description ??
              (ready
                ? "The current environment has the variables needed for auth, retrieval, chat generation, and OCR fallback."
                : "This environment is missing configuration required for some parts of the app. Add the variables below to finish setup.")}
          </p>
          {missing.length ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {missing.map((key) => (
                <Badge key={key}>{key}</Badge>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
