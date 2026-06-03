import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/70 bg-card/90 text-card-foreground shadow-soft backdrop-blur-sm",
        className
      )}
      {...props}
    />
  );
}
