import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy policy · Job Tracker" };

const CONTACT = "laxmimahajanwork@gmail.com";

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-6 py-4 text-sm leading-relaxed text-muted [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-foreground">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Privacy policy</h1>
        <p>Last updated 19 November 2026</p>
      </header>

      <p>
        Job Tracker is a free tool that helps you track job applications, fill application forms and tailor your experience to
        each posting. This page explains what it stores and why.
      </p>

      <section className="space-y-2">
        <h2>What we store</h2>
        <ul className="space-y-1">
          <li>
            <strong>Your account:</strong> your email address and, if you sign in with Google, your name and profile picture from
            Google. We only ask Google for basic profile and email access.
          </li>
          <li>
            <strong>What you add:</strong> jobs you track, your answers to common form questions, your work experience, your
            portfolio link and the text read from it, and your resume file.
          </li>
          <li>
            <strong>Your AI keys:</strong> if you connect your own AI provider, the key is encrypted before it&apos;s stored and is
            never shown again or shared.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2>How it&apos;s used</h2>
        <p>
          Only to run the features you use. When you ask for AI help (tailoring, drafting an answer, reading a resume), the
          relevant text is sent to the AI provider <strong>you connected</strong>, using your own key, under that provider&apos;s
          terms. We don&apos;t sell your data, show ads, or use it to train models.
        </p>
      </section>

      <section className="space-y-2">
        <h2>Where it&apos;s kept</h2>
        <p>
          Data is stored with Supabase and the app runs on Vercel. Every row is locked to your account, so other users can&apos;t
          see it. The optional Chrome extension stores only your sign-in session in your browser.
        </p>
      </section>

      <section className="space-y-2">
        <h2>Your choices</h2>
        <p>
          You can edit or delete anything you&apos;ve added at any time, and remove your AI keys from AI settings. To delete your
          whole account and all its data, email{" "}
          <a href={`mailto:${CONTACT}`} className="text-accent hover:underline">
            {CONTACT}
          </a>{" "}
          and it will be removed within 30 days.
        </p>
      </section>

      <p>
        Questions? Email{" "}
        <a href={`mailto:${CONTACT}`} className="text-accent hover:underline">
          {CONTACT}
        </a>
        . See also the{" "}
        <Link href="/terms" className="text-accent hover:underline">
          Terms
        </Link>
        .
      </p>
    </article>
  );
}
