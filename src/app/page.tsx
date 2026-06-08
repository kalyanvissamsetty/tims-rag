import Link from "next/link";
import { ArrowRight, Database, Lock, ShieldCheck, Sparkles } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";

const features = [
  {
    title: "Retrieval-first answers",
    copy: "Ground responses in uploaded files, with clear fallback behavior when the source material does not support an answer.",
    icon: Database
  },
  {
    title: "Admin-ready controls",
    copy: "Upload, replace, remove, and tune response behavior from one clean workspace built for internal teams.",
    icon: Lock
  }
];


export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[radial-gradient(circle_at_top,rgba(15,143,183,0.13),transparent_30%),linear-gradient(180deg,#fcfaf5_0%,#f4f6f8_58%,#edf3f7_100%)] dark:bg-[radial-gradient(circle_at_top,rgba(15,143,183,0.16),transparent_24%),linear-gradient(180deg,#161b27_0%,#131822_55%,#10141d_100%)] lg:h-screen lg:overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_18%,rgba(255,255,255,0.7),transparent_20%),radial-gradient(circle_at_84%_14%,rgba(255,244,214,0.45),transparent_18%)] dark:bg-[radial-gradient(circle_at_18%_18%,rgba(255,255,255,0.04),transparent_22%),radial-gradient(circle_at_84%_14%,rgba(34,211,238,0.06),transparent_18%)]" />

      <div className="relative mx-auto flex min-h-[100dvh] max-w-7xl flex-col px-4 py-4 sm:px-6 sm:py-6 lg:h-screen lg:px-10 lg:py-8">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-primary sm:text-sm">TIMS AI Studio</p>
            <p className="mt-1 max-w-[16rem] text-xs leading-5 text-muted-foreground sm:max-w-md sm:text-sm">
              Trusted internal answers from the documents your team already owns.
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
          </div>
        </header>

        <section className="grid flex-1 gap-4 overflow-hidden pb-4 pt-5 sm:gap-8 sm:pb-8 sm:pt-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(340px,0.92fr)] lg:items-center lg:gap-8 lg:py-4 xl:gap-10 xl:py-6">
          <div className="flex flex-col justify-center lg:max-w-3xl lg:pr-6">
            <div className="mt-2 space-y-3 sm:mt-5 sm:space-y-5 lg:space-y-4">
              <h1 className="max-w-3xl font-[family-name:var(--font-heading)] text-[1.9rem] font-semibold leading-[1.02] tracking-tight sm:text-[3.15rem] md:text-[3.55rem] lg:text-[3.45rem] xl:text-[3.95rem]">
                AI-powered gateway to TIMS Knowledge
              </h1>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:mt-7 sm:flex-row sm:flex-wrap lg:mt-6">
              <Button size="lg" asChild className="h-11 rounded-2xl px-5 sm:h-12 sm:px-6">
                <Link href={user ? "/chat" : "/signup"} className="inline-flex items-center justify-center gap-2">
                  {user ? "Go to workspace" : "Create account"}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild className="h-11 rounded-2xl px-5 sm:h-12 sm:px-6">
                <Link href={user ? "/admin" : "/login"}>{user ? "Open admin" : "Sign in"}</Link>
              </Button>
            </div>
          </div>

          <div className="flex min-h-0 flex-col gap-3 sm:gap-5 lg:justify-center">
            <Card className="overflow-hidden rounded-[28px] border-border/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.88),rgba(250,252,253,0.72))] p-3.5 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur dark:bg-[linear-gradient(180deg,rgba(20,27,39,0.92),rgba(18,24,34,0.78))] sm:p-5 lg:p-4 xl:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Live workspace</p>
                  <h2 className="mt-2 font-[family-name:var(--font-heading)] text-lg font-semibold sm:text-2xl lg:text-[1.45rem]">
                    Chat with approved company knowledge
                  </h2>
                </div>
              </div>

              <div className="mt-3 grid gap-2.5 sm:mt-5 lg:mt-4">
                <div className="rounded-3xl border border-border/60 bg-background/88 p-3 shadow-sm lg:p-3.5">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                    User question
                  </div>
                  <p className="mt-2 text-sm leading-6 text-foreground/90 sm:text-[15px] sm:leading-7 lg:text-[14px] lg:leading-6">
                    Summarize the procedure, list the pressure-test steps, and call out any missing record dependencies.
                  </p>
                </div>

                <div className="rounded-3xl border border-primary/20 bg-primary/[0.07] p-3 shadow-sm lg:p-3.5">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-primary/90">
                    TIMS AI response
                  </div>
                  <div className="mt-2 space-y-2.5 text-sm leading-6 text-foreground/90 sm:text-[15px] sm:leading-7 lg:text-[14px] lg:leading-6">
                    <p>
                      The validation procedure starts with indexed record grouping, then aligns GIS and source records to
                      the pipeline centerline before quality review.
                    </p>
                    <p>
                      Pressure-test alignment happens after the Pipeline Feature List is populated, and unsupported gaps
                      are surfaced clearly instead of guessed.
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            <div className="grid gap-2.5 sm:grid-cols-3 sm:gap-4 lg:hidden">
              {features.map((feature) => {
                const Icon = feature.icon;

                return (
                  <Card
                    key={feature.title}
                    className="rounded-[24px] border-border/60 bg-background/74 p-4 shadow-[0_18px_48px_rgba(15,23,42,0.08)] backdrop-blur"
                  >
                    <div className="mb-3 inline-flex rounded-2xl bg-primary/10 p-2.5 text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <h3 className="font-[family-name:var(--font-heading)] text-base font-semibold sm:text-[1.03rem]">
                      {feature.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{feature.copy}</p>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
