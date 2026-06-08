"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Eye, EyeOff, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PASSWORD_RULES = [
  {
    id: "length",
    label: "At least 8 characters",
    test: (value: string) => value.length >= 8
  },
  {
    id: "uppercase",
    label: "One uppercase letter",
    test: (value: string) => /[A-Z]/.test(value)
  },
  {
    id: "lowercase",
    label: "One lowercase letter",
    test: (value: string) => /[a-z]/.test(value)
  },
  {
    id: "number",
    label: "One number",
    test: (value: string) => /\d/.test(value)
  },
  {
    id: "special",
    label: "One special character",
    test: (value: string) => /[^A-Za-z0-9]/.test(value)
  },
  {
    id: "spaces",
    label: "No spaces",
    test: (value: string) => !/\s/.test(value)
  }
] as const;

function resolveAuthRedirectUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  const appOrigin =
    configuredUrl && configuredUrl.length > 0
      ? configuredUrl
      : typeof window !== "undefined"
        ? window.location.origin
        : "http://localhost:3000";

  return new URL("/login", appOrigin).toString();
}

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordValue, setPasswordValue] = useState("");
  const [redirectMessage, setRedirectMessage] = useState<string | null>(null);

  const passwordRuleResults = PASSWORD_RULES.map((rule) => ({
    ...rule,
    satisfied: rule.test(passwordValue)
  }));
  const isSignupPasswordValid = passwordRuleResults.every((rule) => rule.satisfied);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = createClient();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const fullName = String(formData.get("fullName") ?? "").trim();

    setLoading(true);

    if (mode === "signup") {
      if (!isSignupPasswordValid) {
        toast.error("Please satisfy all password requirements before creating the account.");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: resolveAuthRedirectUrl(),
          data: {
            full_name: fullName
          }
        }
      });

      if (error) {
        toast.error(error.message);
        setLoading(false);
        return;
      }

      const user = data.user;
      const identities = user?.identities ?? [];
      const looksLikeExistingAccount = !data.session && identities.length === 0;

      if (looksLikeExistingAccount) {
        toast.error("An account with this email already exists. Please sign in instead.");
        setLoading(false);
        return;
      }

      if (!data.session) {
        await supabase.auth.signOut();
        toast.success("Account created. Check your email to confirm your account before signing in.");
        router.push("/login");
        router.refresh();
        setLoading(false);
        return;
      }

      setRedirectMessage("Opening your workspace...");
      toast.success("Account created. You can start chatting now.");
      router.replace("/chat");
      router.refresh();
      return;
    }

    await supabase.auth.signOut();

    const {
      data: { user },
      error
    } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      if (/email not confirmed|email address not authorized|confirm your email/i.test(error.message)) {
        toast.error("Please confirm your email before signing in.");
        setLoading(false);
        return;
      }

      if (/invalid login credentials/i.test(error.message)) {
        try {
          const response = await fetch("/api/auth/account-status", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ email })
          });
          const payload = await response.json().catch(() => null);

          if (response.ok && payload?.exists === false) {
            toast.error("No account exists with this email. Please create an account first.");
          } else {
            toast.error("Incorrect email or password.");
          }
        } catch {
          toast.error("Incorrect email or password.");
        }
      } else {
        toast.error(error.message);
      }
      setLoading(false);
      return;
    }

    let destination = "/chat";
    if (user?.id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.role === "admin") {
        destination = "/admin";
      }
    }

    setRedirectMessage(destination === "/admin" ? "Opening admin workspace..." : "Opening your workspace...");
    toast.success("Signed in successfully.");
    router.replace(destination);
    router.refresh();
  }

  return (
    <Card className="relative w-full max-w-md overflow-hidden p-4 sm:p-8">
      {redirectMessage ? (
        <div className="absolute inset-0 z-10 flex flex-col justify-center bg-background/96 px-6 backdrop-blur-sm">
          <div className="mx-auto w-full max-w-sm">
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <p className="text-sm font-medium text-foreground sm:text-base">{redirectMessage}</p>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary/70">
              <div className="h-full w-2/5 animate-[auth-progress_1.15s_ease-in-out_infinite] rounded-full bg-primary" />
            </div>
          </div>
        </div>
      ) : null}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary sm:text-sm">
          {mode === "signup" ? "Create your Account" : "Welcome back"}
        </p>
        <h1 className="mt-3 font-[family-name:var(--font-heading)] text-xl font-semibold sm:mt-4 sm:text-3xl">
          {mode === "signup" ? "Start your workspace" : "Sign in to TIMS AI Studio"}
        </h1>
      </div>

      <form className="mt-5 space-y-4 sm:mt-8 sm:space-y-5" onSubmit={handleSubmit}>
        {mode === "signup" ? (
          <div className="space-y-2">
            <Label htmlFor="fullName">Full name</Label>
            <Input id="fullName" name="fullName" placeholder="e.g. Kalyan V" required />
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" placeholder="team@tims.group" required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              required
              minLength={8}
              className="pr-12"
              value={passwordValue}
              onChange={(event) => setPasswordValue(event.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 inline-flex -translate-y-1/2 items-center justify-center text-muted-foreground transition hover:text-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {mode === "signup" && passwordValue.length > 0 ? (
            <div className="rounded-2xl border border-border/70 bg-secondary/30 p-3">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Password requirements
              </p>
              <div className="mt-2 grid gap-x-4 gap-y-2 sm:grid-cols-2">
                {passwordRuleResults.map((rule) => (
                  <div key={rule.id} className="flex items-center gap-2 text-xs sm:text-sm">
                    {rule.satisfied ? (
                      <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                    ) : (
                      <X className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <span className={rule.satisfied ? "text-foreground" : "text-muted-foreground"}>
                      {rule.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <Button className="w-full" size="lg" disabled={loading || (mode === "signup" && !isSignupPasswordValid)}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "signup" ? "Create account" : "Sign in"}
        </Button>
      </form>

      <p className="mt-4 text-center text-xs text-muted-foreground sm:text-sm">
        {mode === "signup" ? (
          <>
            Already have an account? <Link href="/login" className="font-semibold text-primary">Sign in</Link>
          </>
        ) : (
          <>
            No account yet? <Link href="/signup" className="font-semibold text-primary">Create one</Link>
          </>
        )}
      </p>
    </Card>
  );
}
