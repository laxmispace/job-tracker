import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Terms · Job Tracker" };

const CONTACT = "laxmimahajanwork@gmail.com";

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-2xl space-y-6 py-4 text-sm leading-relaxed text-muted [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-foreground">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Terms</h1>
        <p>Last updated 19 November 2026</p>
      </header>

      <p>Job Tracker is a free, personal project offered as is. By using it you agree to these terms.</p>

      <section className="space-y-2">
        <h2>Using the app</h2>
        <ul className="space-y-1">
          <li>It&apos;s free. There are no paid plans.</li>
          <li>
            AI features use <strong>your own</strong> AI provider account and key. Any usage costs or limits on that account are
            yours, under that provider&apos;s terms.
          </li>
          <li>
            You&apos;re responsible for what you submit to employers. Always review AI drafts and autofilled forms before sending;
            the app never submits applications for you.
          </li>
          <li>Don&apos;t use the app to break the rules of job sites, to scrape them at scale, or for anything unlawful.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2>No guarantees</h2>
        <p>
          The app may change, have downtime or lose data, and features may be removed. Keep your own copy of anything important,
          like your resume. To the extent the law allows, the project isn&apos;t liable for losses from using it.
        </p>
      </section>

      <section className="space-y-2">
        <h2>Your data</h2>
        <p>
          You own what you add. How it&apos;s handled is described in the{" "}
          <Link href="/privacy" className="text-accent hover:underline">
            Privacy policy
          </Link>
          .
        </p>
      </section>

      <p>
        Contact:{" "}
        <a href={`mailto:${CONTACT}`} className="text-accent hover:underline">
          {CONTACT}
        </a>
      </p>
    </article>
  );
}
