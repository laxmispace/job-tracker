# Job Tracker

Track every application as a card, fill application forms from your own answers bank, and tailor your experience to each job description with AI.

- **Web app** (Next.js 16 + HeroUI v3) — job cards, answers bank, experience, AI tailoring. Installable on Android; appears in LinkedIn's **Share** menu.
- **Chrome extension** (`extension/`) — saves jobs, autofills forms (⌥⇧F), attaches your resume, drafts long answers, and **adds a card automatically when you submit an application**.
- **Supabase** (free tier) — login, database, resume storage. Every row is private to your account (row-level security).
- **AI** — any OpenAI-compatible API: Gemini, DeepSeek, Qwen, OpenRouter, Groq, or a local Ollama model.

---

## 1. Supabase (5 min)

1. Create a free project at [supabase.com](https://supabase.com).
2. **SQL Editor → New query** → paste all of `supabase/schema.sql` → **Run**. Then do the same with `supabase/002_grants_and_profile.sql` and `supabase/003_user_ai_keys.sql`.
3. **Project Settings → API**: copy the **Project URL** and the **anon / publishable key**.
4. **Authentication → URL Configuration**: set **Site URL** to your deployed app URL (after step 4). Email sign-up is on by default; turn off *Confirm email* under **Authentication → Providers → Email** if you don't want the confirmation step.

## 2. AI keys — add several, switch any time

Add one env var per provider you want (Vercel → Project → Settings → Environment Variables, then redeploy). Keys stay on the server.

| Provider | Env var | Where to get a key | Default model |
|---|---|---|---|
| Google Gemini (free tier) | `GEMINI_API_KEY` | aistudio.google.com/apikey | `gemini-3.8-flash` |
| DeepSeek (pay-as-you-go, cheap) | `DEEPSEEK_API_KEY` | platform.deepseek.com | `deepseek-flash` |
| Qwen (Alibaba Cloud) | `QWEN_API_KEY` | Model Studio | `qwen-plus` |
| OpenRouter (free `:free` models incl. DeepSeek/Qwen/Kimi) | `OPENROUTER_API_KEY` | openrouter.ai/keys | pick in AI settings |
| Groq (free tier) | `GROQ_API_KEY` | console.groq.com/keys | pick in AI settings |
| Ollama on your Mac (local dev only) | `OLLAMA_BASE_URL` | ollama.com | `qwen3:8b` |
| Anything else OpenAI-compatible | `CUSTOM_BASE_URL` + `CUSTOM_API_KEY` + `CUSTOM_MODEL` | — | — |

**Switching:** use the **✨ dropdown** in the app header (every page, phone too) or in the extension popup. **AI settings** lets you pick each provider's model from its live model list (free ones are tagged), test a key, and turn **automatic fallback** on or off. With fallback on, if your chosen model hits a rate limit or fails, the next configured one answers, and the card shows which model did the work.

**Context never gets lost:** every request, to every model, starts with the same *role brief* (what the app is, what the model's job is, the no-fabrication rules), then your **standing instructions** from AI settings, then your data (answers bank, experience, the job description, and anything already prepared for that job). The context lives in the app, not inside any one model, so you can switch mid-task. The brief is `APP_SKILL` in `src/lib/server/ai.ts`; you can read it in AI settings.

### Letting other people use the app (bring your own key)

Anyone who signs in can connect **their own** AI account in **AI settings**:

- **OpenRouter: one click.** They approve on OpenRouter and come straight back; one key covers Gemini, DeepSeek, Qwen, Grok and many free models.
- **Gemini, Groq, DeepSeek, Qwen, xAI:** paste a key (a "Get a key" link opens the right page). Keys are checked with the provider before saving.

Personal keys are encrypted with AES-256-GCM on the server (key derived from `KEY_ENCRYPTION_SECRET`, or the Supabase JWT secret if that's not set), stored in `user_ai_keys`, and never sent back to the browser.

To stop other users spending **your** keys, set `OWNER_EMAILS` in Vercel to your sign-in email (comma-separate several). Your env-var keys then work only for those accounts; everyone else must connect their own. If `OWNER_EMAILS` is unset, your keys are shared with every user.

Before opening sign-ups, publish the Google sign-in app (Google Cloud → Google Auth Platform → Audience → **Publish app**), otherwise only listed test users can sign in. Run `supabase/003_user_ai_keys.sql` once.

## 3. Run locally

```bash
npm install
cp .env.example .env.local   # fill in Supabase + AI values
npm run dev                  # http://localhost:3000
```

## 4. Deploy

**Vercel (recommended):** push this folder to a GitHub repo → vercel.com → *Add New Project* → import → add the env vars from `.env.example` → Deploy. `vercel.json` adds a daily cron that pings Supabase so the free project never pauses for inactivity.

**Netlify:** *Add new site → Import from Git* → same env vars. Netlify detects Next.js automatically. (The keep-alive cron is Vercel-only; on Netlify, open the app at least once a week or add a scheduled function that calls `/api/keepalive`.)

## 5. Phone (Samsung / Android)

1. Open your app URL in **Chrome** on the phone and sign in.
2. Chrome menu **⋮ → Add to Home screen → Install**.
3. In the **LinkedIn app**, open a job → **Share** → **Job Tracker**. The card opens pre-filled; pick a status and save.

LinkedIn usually blocks reading full job details from a link, so on mobile paste the job description into the card if you want AI tailoring. The **Extract role & company with AI** button fills the fields from pasted text.

## 6. Chrome extension (MacBook)

1. Open `chrome://extensions` → turn on **Developer mode** → **Load unpacked** → select the `extension` folder.
2. Pin it, click the icon, paste your app URL (e.g. `https://your-app.vercel.app`) → **Connect** → sign in.

What it does:

- **Auto-track:** when a page shows *"Your application was sent"*, *"Thank you for applying"* etc. after you click Submit, the job is added (or moved to **Applied**). If you clicked *Apply on company website* from LinkedIn, it's tracked against the original LinkedIn posting, not as a duplicate.
- **Autofill (⌥⇧F or popup button):** fills matching fields from your answers bank, picks dropdown/radio options, attaches your resume. Green outline = filled, amber = needs you. It never overwrites what's already typed and **never submits** — you always review and click Submit yourself.
- **✨ Draft with AI / Tailor to this job:** appears under long questions; writes an answer from your profile, experience and the posting.
- **Save job / ✨ Tailor:** save the page as a card, then open it in the tracker to rewrite your experience bullets with that posting's keywords.

## Known limits

- Autofill works best on Greenhouse, Lever, Ashby, SmartRecruiters and plain HTML forms. Workday and some custom dropdowns (React Select) need manual picks — they're marked amber.
- LinkedIn Easy Apply forms are filled the same way, but keep it user-triggered; automating LinkedIn heavily can get accounts restricted.
- Chrome's mobile app has no extensions, so on the phone you save jobs via Share, not automatically.
- Autofill matches questions by wording. If a site phrases something differently, add that phrase to the question's **Also matches** list on the Answers page.

## Project map

```
supabase/schema.sql         tables, row-level security, resume bucket
src/app/                    pages: / (cards), /jobs/[id], /answers, /experience, /settings, /share
src/app/api/                fetch-job, ai/{tailor,answer,extract,import-experience,providers}, config, keepalive
src/lib/seed-questions.ts   the default answers bank (questions + matching phrases)
src/lib/server/ai.ts        providers, fallback, the app role brief (APP_SKILL), prompts
extension/                  Manifest V3 extension (no build step)
```
