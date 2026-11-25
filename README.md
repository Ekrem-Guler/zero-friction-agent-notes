# ZeroNote — Zero-Friction AI Note & Research Agent

A minimalist, zero-friction AI note-taking and research PWA. Capture hasty single-word notes (`"Semrush"`, `"Obsidian"`), half-baked tasks (`"budget presentation tomorrow"`), or **45-second voice memos** — a background AI agent classifies, researches, and structures them automatically.

## Features

* **Zero-Friction Capture:** Autofocused Gemini-style input (`/` or `Ctrl/Cmd + K` shortcut), 45s mobile/desktop voice recorder, and an optional **Raw Only** toggle when you want to skip AI.
* **Projects & Spaces:** Organize notes per project with dedicated AI project context, grouped under core spaces (**Tasks**, **Tools & Resources**, **Ideas**) plus custom spaces.
* **Nested Comments & Promotion:** Add threaded comments under any note (recursively) without cluttering your main list, then click **Promote to note** whenever a comment deserves its own spot.
* **Flexible Views:** Switch globally between **Summary**, **Titles**, and **Raw Inputs**, or toggle **Show Raw Input** on any individual note.
* **Security & Cost Guardrails (Anti-Abuse + BYOK):**
  * **Strict Structured Output:** Enforced Zod JSON schema prevents prompt-injection chatbot abuse.
  * **BYOK + Budget Circuit Breaker:** Connect your own Gemini or OpenAI API key (encrypted with **AES-256-GCM**) for unlimited usage, with a hard monthly USD cap on system keys.
  * **Entity Research Cache (`entity_cache`):** Caches researched tools/concepts to eliminate repeat search costs.

## Quick Start (Local)

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. The local LibSQL database (`data/local.db`) and default project/spaces initialize automatically. Click **Context & AI** in the sidebar to add your Gemini or OpenAI API key.

## Cloud Sync (Phone + Desktop PWA)

1. Create a free **Turso** (LibSQL) database and copy `DATABASE_URL` and `DATABASE_AUTH_TOKEN`.
2. Deploy to **Vercel** from your GitHub repo and configure the environment variables in `.env.example`.
3. Open on your phone and tap **Add to Home Screen** to install as a standalone PWA.
