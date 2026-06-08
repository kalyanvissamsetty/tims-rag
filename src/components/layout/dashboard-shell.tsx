"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrainCircuit } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { Button } from "@/components/ui/button";
import type { Profile } from "@/types";

export function DashboardShell({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  const pathname = usePathname();
  const isChatRoute = pathname === "/chat";

  return (
    <div className="h-[100dvh] overflow-hidden bg-background">
      {isChatRoute ? (
        <div className="h-full min-h-0">{children}</div>
      ) : (
        <div className="mx-auto flex h-full max-w-[1600px] gap-0 overflow-hidden bg-background">
          <aside className="hidden w-[278px] shrink-0 border-r border-white/8 bg-[linear-gradient(180deg,rgba(14,20,31,0.98),rgba(9,14,24,0.98))] text-white lg:flex lg:flex-col">
            <div className="border-b border-white/10 px-5 py-5">
              <div className="flex items-center gap-3">
                <div className="inline-flex rounded-2xl bg-white/10 p-3 text-white">
                  <BrainCircuit className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="font-[family-name:var(--font-heading)] text-xl font-semibold tracking-tight">
                    TIMS AI Studio
                  </h1>
                  <p className="text-xs uppercase tracking-[0.22em] text-white/45">Private knowledge chat</p>
                </div>
              </div>
            </div>
            <div className="mt-auto border-t border-white/10 p-4">
              <div className="rounded-[22px] border border-white/10 bg-white/5 p-3.5">
                
                <div className="pt-2.5">
                  <p className="truncate font-medium text-white">{profile.full_name ?? profile.email}</p>
                  <p className="truncate text-sm text-white/60">{profile.email}</p>
                </div>
                {profile.role === "admin" ? (
                  <>
                    <Button
                      asChild
                      variant="outline"
                      className="mt-3 h-9 w-full justify-start rounded-xl border-white/12 bg-white/5 px-3 text-sm text-white hover:bg-white/10 hover:text-white"
                    >
                      <Link href="/chat">Open Chat</Link>
                    </Button>
                    
                  </>
                ) : null}
                <div className="mt-3 flex items-center gap-2">
                  <ThemeToggle className="h-9 w-9 shrink-0 rounded-xl border-white/12 bg-white/5 text-white hover:bg-white/10 hover:text-white" />
                  <SignOutButton className="h-9 rounded-xl border-white/12 bg-white/5 px-3 text-sm text-white hover:bg-white/10 hover:text-white" />
                </div>
              </div>
            </div>
          </aside>

          <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[linear-gradient(180deg,rgba(252,250,245,1),rgba(245,246,249,1))] dark:bg-[linear-gradient(180deg,rgba(28,31,46,1),rgba(24,28,41,1))]">
            <div className="flex items-center justify-between border-b border-border/60 bg-background/80 px-4 py-3 backdrop-blur sm:px-5 sm:py-4 lg:hidden">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">TIMS AI Studio</p>
                <p className="text-xs text-muted-foreground">{profile.role === "admin" ? "Admin access" : "Team workspace"}</p>
              </div>
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <SignOutButton compact />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
          </div>
        </div>
      )}
    </div>
  );
}
