"use client";

import { Briefcase } from "@gravity-ui/icons";
import { Button, Card, Input, Label, Spinner, TextField } from "@heroui/react";
import { useState } from "react";
import { sb } from "@/lib/supabase";

export default function LoginScreen() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "error" | "info"; text: string } | null>(null);

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
        <Card.Content>
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
