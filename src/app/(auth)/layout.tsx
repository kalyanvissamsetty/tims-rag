import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto grid min-h-screen max-w-7xl items-center gap-12 px-6 py-8 lg:grid-cols-[1.1fr_0.9fr] lg:px-10">
      <section className="hidden lg:block">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-primary">TIMS AI Studio</p>
        <h1 className="mt-6 max-w-xl font-[family-name:var(--font-heading)] text-6xl font-semibold leading-tight">
Find answers, summarize documents and discover insights from organizational knowledge.        </h1>
        <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
          Designed for product teams, operations teams, and internal knowledge bases that need elegant chat
          without hallucinated answers.
        </p>
      </section>
      <div className="absolute right-6 top-6 flex items-center gap-3">
        <ThemeToggle />
        
      </div>
      <div className="flex justify-center">{children}</div>
    </div>
  );
}
