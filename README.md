# Job Tracker

Track every application as a card, fill application forms from your own answers bank, and tailor your experience to each job description with AI.

- **Web app** (Next.js 16 + HeroUI v3) — job cards, answers bank, experience, AI tailoring. Installable on Android; appears in LinkedIn's **Share** menu.
- **Chrome extension** (`extension/`) — saves jobs, autofills forms (⌥⇧F), attaches your resume, drafts long answers, and **adds a card automatically when you submit an application**.
- **Supabase** (free tier) — login, database, resume storage. Every row is private to your account (row-level security).
- **AI** — any OpenAI-compatible API: Gemini, DeepSeek, Qwen, OpenRouter, Groq, or a local Ollama model.

---

## 1. Supabase (5 min)

1. Create a free project at [supabase.com](https://supabase.com).
2. **SQL Editor → New query** → paste all of `supabase/schema.sql` → **Run**.
3. **Project Settings → API**: copy the **Project URL** and the **anon / publishable key**.
4. **Authentication → URL Configuration**: set **Site URL** to your deployed app URL (after step 4). Email sign-up is on by default; turn off *Confirm email* under **Authentication → Providers → Email** if you don't want the confirmation step.

## 2. AI key

Set these server-side env vars (never in the browser, never in the extension):

| Provider | `AI_PROVIDER` | Where to get a key | Default model |
|---|---|---|---|
| Google Gemini (has a free tier) | `gemini` | aistudio.google.com → Get API key | `gemini-3.8-flash` |
| DeepSeek (pay-as-you-go, cheap) | `deepseek` | platform.deepseek.com | `deepseek-flash` |
| Qwen (Alibaba Cloud, international) | `qwen` | Model Studio / DashScope | `qwen-plus` |
| OpenRouter (has `:free` models incl. DeepSeek/Qwen/Kimi) | `openrouter` | openrouter.ai/keys | set `AI_MODEL` |
| Groq (free tier, hosts Qwen/Kimi) | `groq` | console.groq.com | set `AI_MODEL` |
| Ollama on your Mac (only when running locally) | `ollama` | — | `qwen3:8b` |

Override the model any time with `AI_MODEL`. For any other OpenAI-compatible endpoint (Moonshot/Kimi, Zhipu GLM…) set `AI_BASE_URL` + `AI_MODEL` + `AI_API_KEY`.

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
src/app/                    pages: / (cards), /jobs/[id], /answers, /experience, /share
src/app/api/                fetch-job, ai/{tailor,answer,extract,import-experience}, config, keepalive
src/lib/seed-questions.ts   the default answers bank (questions + matching phrases)
src/lib/server/ai.ts        provider switch + prompts
extension/                  Manifest V3 extension (no build step)
```
