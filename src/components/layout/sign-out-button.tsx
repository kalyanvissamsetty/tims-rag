"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SignOutButton({ compact = false, className }: { compact?: boolean; className?: string }) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);

    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    } finally {
      setSigningOut(false);
      setConfirmOpen(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size={compact ? "icon" : "default"}
        className={cn(className)}
        disabled={signingOut}
        onClick={() => setConfirmOpen(true)}
      >
        {signingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
        {compact ? null : <span className="ml-2">{signingOut ? "Signing out..." : "Sign out"}</span>}
      </Button>

      {confirmOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 px-4 backdrop-blur-sm">
          <div className="w-full max-w-[400px] rounded-[22px] border border-white/8 bg-[#262626] px-6 py-6 text-white shadow-[0_24px_72px_rgba(0,0,0,0.42)]">
            <h3 className="text-[18px] font-medium tracking-tight text-white">Sign out?</h3>
            <p className="mt-3 text-[14px] leading-7 text-white/82">Are you sure you want to logout?</p>
            <div className="mt-7 flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                className="h-11 rounded-full border-white/10 bg-black px-5 text-[15px] font-medium text-white hover:bg-black/80 hover:text-white"
                onClick={() => setConfirmOpen(false)}
                disabled={signingOut}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="h-11 rounded-full px-5 text-[15px] font-medium"
                onClick={handleSignOut}
                disabled={signingOut}
              >
                {signingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                <span className={signingOut ? "ml-2" : ""}>{signingOut ? "Signing out..." : "Logout"}</span>
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
