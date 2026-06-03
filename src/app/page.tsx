import Link from "next/link";
import { ArrowRight, Database, Lock, Sparkles } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { getEnvironmentReadiness } from "@/lib/env";

const features = [
  {
    title: "Retrieval-first answers",
    copy: "Responses are grounded in your uploaded documents, with citations and strict fallback behavior.",
    icon: Database
  },
  {
    title: "Admin-ready controls",
    copy: "Upload, replace, remove, and tune system instructions from one professional control panel.",
    icon: Lock
  }
];

export default async function HomePage() {
  const user = await getCurrentUser();
  const readiness = getEnvironmentReadiness();
  const missingKeys = [...readiness.missingBrowserEnv, ...readiness.missingServerEnv];

  return (
    <main className="relative h-screen overflow-hidden">
      <div className="mx-auto flex h-full max-w-7xl flex-col px-5 py-5 lg:px-10 lg:py-6">
        <header className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-primary">TIMS AI Studio</p>
            <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
              Your AI-powered gateway to TIMS knowledge.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button variant="outline" asChild>
              <Link href={user ? "/chat" : "/login"}>{user ? "Open app" : "Sign in"}</Link>
            </Button>
          </div>
        </header>

        <section className="grid min-h-0 flex-1 items-center gap-5 py-4 lg:grid-cols-[1.08fr_0.92fr] lg:py-5">
          <div className="min-h-0 self-center">
            <div className="inline-flex rounded-full border border-border/70 bg-card/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-muted-foreground backdrop-blur">
              Trusted answers from trusted files
            </div>
            <h1 className="mt-4 max-w-4xl font-[family-name:var(--font-heading)] text-4xl font-semibold leading-[0.98] tracking-tight md:text-5xl lg:max-w-3xl lg:text-[4rem]">
Find answers, summarize documents and discover insights from organizational knowledge.          </h1>
            
            <div className="mt-5 flex flex-wrap gap-3">
              <Button size="lg" asChild>
                <Link href={user ? "/chat" : "/signup"} className="inline-flex items-center gap-2">
                  {user ? "Go to workspace" : "Create account"}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link href="/login">Sign In</Link>
              </Button>
            </div>
          </div>

          <Card className="grid max-w-[34rem] gap-3 self-center justify-self-end p-4">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="rounded-2xl border border-border/60 bg-background/60 p-3.5">
                  <div className="mb-2.5 inline-flex rounded-2xl bg-primary/10 p-2.5 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <h2 className="font-[family-name:var(--font-heading)] text-lg font-semibold">{feature.title}</h2>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{feature.copy}</p>
                </div>
              );
            })}

            
          </Card>
        </section>
      </div>
    </main>
  );
}
