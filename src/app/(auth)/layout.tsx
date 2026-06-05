import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col justify-center gap-6 px-4 py-5 sm:px-6 sm:py-8 md:px-8 lg:grid lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-12 lg:px-10">
      <div className="absolute right-4 top-4 flex items-center gap-3 sm:right-6 sm:top-6">
        <ThemeToggle />
        
      </div>
      <div className="flex justify-center lg:order-2">{children}</div>
      <section className="hidden text-center lg:order-1 lg:block lg:text-left">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary sm:text-xl">TIMS AI Studio</p>
        <h1 className="mt-3 max-w-xl font-[family-name:var(--font-heading)] text-2xl font-semibold leading-tight sm:text-4xl lg:mt-6 lg:text-6xl">
          Find answers, summarize documents and discover insights from organizational knowledge.
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground sm:max-w-xl sm:text-base lg:mx-0 lg:mt-6 lg:text-lg lg:leading-8">
          Designed for product teams, operations teams, and internal knowledge bases that need elegant chat
          without hallucinated answers.
        </p>
      </section>
    </div>
  );
}
