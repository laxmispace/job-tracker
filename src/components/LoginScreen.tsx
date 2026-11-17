"use client";

import { Briefcase } from "@phosphor-icons/react";
import { Button, Card, Input, Label, Separator, Spinner, TextField } from "@heroui/react";
import { useState } from "react";
import { sb } from "@/lib/supabase";

export default function LoginScreen() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "error" | "info"; text: string } | null>(null);

  async function google() {
    setMsg(null);
    const { error } = await sb().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + window.location.pathname },
    });
    if (error) setMsg({ tone: "error", text: error.message });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const auth = sb().auth;
    const { data, error } =
      mode === "signin"
        ? await auth.signInWithPassword({ email, password })
        : await auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
    setBusy(false);
    if (error) return setMsg({ tone: "error", text: error.message });
    if (mode === "signup" && !data.session) {
      setMsg({ tone: "info", text: "Check your inbox to confirm your email, then sign in." });
      setMode("signin");
    }
  }

  return (
    <div className="grid min-h-[80vh] place-items-center">
      <Card className="w-full max-w-sm">
        <Card.Header className="items-start gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground">
            <Briefcase className="size-5" />
          </span>
          <div>
            <Card.Title>{mode === "signin" ? "Sign in" : "Create your account"}</Card.Title>
            <Card.Description>Your applications, answers and experience — synced across phone and laptop.</Card.Description>
          </div>
        </Card.Header>
        <Card.Content className="flex flex-col gap-4">
          <Button variant="secondary" fullWidth onPress={google}>
            <GoogleMark />
            Continue with Google
          </Button>
          <div className="flex items-center gap-3 text-xs text-muted">
            <Separator className="flex-1" />
            or use email
            <Separator className="flex-1" />
          </div>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <TextField name="email" type="email" value={email} onChange={setEmail} isRequired>
              <Label>Email</Label>
              <Input placeholder="you@example.com" autoComplete="email" />
            </TextField>
            <TextField name="password" type="password" value={password} onChange={setPassword} isRequired>
              <Label>Password</Label>
              <Input placeholder="At least 6 characters" autoComplete={mode === "signin" ? "current-password" : "new-password"} />
            </TextField>
            {msg && (
              <p className={`text-sm ${msg.tone === "error" ? "text-danger" : "text-success"}`}>{msg.text}</p>
            )}
            <Button type="submit" isPending={busy} fullWidth>
              {busy && <Spinner color="current" size="sm" />}
              {mode === "signin" ? "Sign in" : "Sign up"}
            </Button>
          </form>
        </Card.Content>
        <Card.Footer>
          <Button variant="ghost" size="sm" onPress={() => setMode(mode === "signin" ? "signup" : "signin")}>
            {mode === "signin" ? "New here? Create an account" : "Have an account? Sign in"}
          </Button>
        </Card.Footer>
      </Card>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-4" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
