"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SignOutButton({ compact = false, className }: { compact?: boolean; className?: string }) {
  const router = useRouter();

  return (
    <Button
      type="button"
      variant="outline"
      size={compact ? "icon" : "default"}
      className={cn(className)}
      onClick={async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push("/login");
        router.refresh();
      }}
    >
      <LogOut className="h-4 w-4" />
      {compact ? null : <span className="ml-2">Sign out</span>}
    </Button>
  );
}
