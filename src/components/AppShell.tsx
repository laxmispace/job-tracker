"use client";

import { Briefcase, Files, GearSix, IconContext, SignOut, UserCircle } from "@phosphor-icons/react";
import { Button, Spinner, Toast } from "@heroui/react";
import type { Session } from "@supabase/supabase-js";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import { sb, supabaseConfigured } from "@/lib/supabase";
import LoginScreen from "./LoginScreen";

const SessionCtx = createContext<Session | null>(null);
export const useSession = () => useContext(SessionCtx);

// Pages anyone can read without signing in.
const PUBLIC_PATHS = ["/privacy", "/terms"];

const NAV = [
  { href: "/", label: "Jobs", icon: Briefcase },
  { href: "/answers", label: "Profile", icon: UserCircle },
  { href: "/experience", label: "Experience", icon: Files },
  { href: "/settings", label: "AI settings", icon: GearSix },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  // Without Supabase env vars there's nothing to wait for — show the setup notice right away.
  const [ready, setReady] = useState(() => !supabaseConfigured());
  const pathname = usePathname();

  useEffect(() => {
    if (!supabaseConfigured()) return;
    sb()
      .auth.getSession()
      .then(({ data }) => {
        setSession(data.session);
        setReady(true);
      });
    const { data } = sb().auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  let body: React.ReactNode;
  if (!ready) {
    body = (
      <div className="grid min-h-[60vh] place-items-center">
        <Spinner />
      </div>
    );
  } else if (!supabaseConfigured()) {
    body = <SetupNotice />;
  } else if (!session && PUBLIC_PATHS.includes(pathname)) {
    body = children; // Privacy & Terms are readable without signing in
  } else if (!session) {
    body = <LoginScreen />;
  } else {
    body = children;
  }

  const isActive = (href: string) => (href === "/" ? pathname === "/" || pathname.startsWith("/jobs") : pathname.startsWith(href));

  return (
    <SessionCtx.Provider value={session}>
      {/* Filled icons everywhere */}
      <IconContext.Provider value={{ weight: "fill" }}>
      <Toast.Provider placement="top" />
      {session && (
        <header className="sticky top-0 z-30 border-b border-separator bg-background">
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 md:gap-6">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="grid size-7 place-items-center rounded-lg bg-accent text-accent-foreground">
                <Briefcase className="size-4" />
              </span>
              <span className="hidden sm:inline">Job Tracker</span>
            </Link>
            <nav className="hidden gap-1 md:flex">
              {NAV.map((n) => {
                const Icon = n.icon;
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                      isActive(n.href) ? "bg-default text-foreground" : "text-muted hover:text-foreground"
                    }`}
                  >
                    <Icon className="size-4" />
                    {n.label}
                  </Link>
                );
              })}
            </nav>
            <div className="ml-auto flex items-center gap-2">
              <span className="hidden text-xs text-muted lg:inline">{session.user.email}</span>
              <Button size="sm" variant="ghost" isIconOnly aria-label="Sign out" onPress={() => sb().auth.signOut()}>
                <SignOut className="size-4" />
              </Button>
            </div>
          </div>
        </header>
      )}

      <main className="pb-safe mx-auto max-w-6xl px-4 pt-5">{body}</main>

      {session && (
        <nav
          className="fixed inset-x-0 bottom-0 z-30 border-t border-separator bg-background md:hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="grid grid-cols-4">
            {NAV.map((n) => {
              const Icon = n.icon;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`flex flex-col items-center gap-1 py-2.5 text-[11px] ${
                    isActive(n.href) ? "text-accent" : "text-muted"
                  }`}
                >
                  <Icon className="size-5" />
                  {n.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
      </IconContext.Provider>
    </SessionCtx.Provider>
  );
}

function SetupNotice() {
  return (
    <div className="mx-auto max-w-lg space-y-3 py-16">
      <h1 className="text-xl font-semibold">Almost there</h1>
      <p className="text-muted">
        Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in{" "}
        <code>.env.local</code> (or in Vercel → Settings → Environment Variables), then restart / redeploy.
      </p>
    </div>
  );
}
