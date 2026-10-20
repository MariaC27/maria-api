# maria-api

Thin serverless API powering the interactive API reference on [mariacristoforo.com](https://mariacristoforo.com). Deployed on Vercel.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/me` | Profile info |
| `GET` | `/api/skills` | Skills list, filterable by `proficiency` and `category` |
| `GET` | `/api/work` | Case studies |
| `GET` | `/api/availability` | Current availability and contact windows |
| `POST` | `/api/ask` | Ask about Maria — Claude answers from the portfolio site's content, streamed as plain text |
| `POST` | `/api/hire` | Submit a role — evaluated by Claude, triggers email notification |
| `POST` | `/api/contact` | Send a message — triggers email notification |

## Stack

- Vercel Functions (no framework)
- [Anthropic API](https://anthropic.com) — Claude Opus 5.5 answers `/ask` questions; Claude Haiku evaluates hire requests
- [Resend](https://resend.com) — email notifications for `/hire` and `/contact`

## Environment variables

| Variable | Used by |
|----------|---------|
| `ANTHROPIC_API_KEY` | `ask.js`, `hire.js` |
| `SITE_REPO_RAW` (optional) | `ask.js` — raw GitHub base URL for the site's MDX; defaults to `https://raw.githubusercontent.com/MariaC27/docs/main` |
| `RESEND_API_KEY` | `hire.js`, `contact.js` |

## How `/ask` gets its context

`ask.js` reads the portfolio's `docs.json` from GitHub, fetches every page in its navigation (plus `llms.txt`), strips the MDX markup, and sends the result to Claude as a cached system prompt block. Content is refreshed every 30 minutes per warm instance, so answers follow whatever is on `main`. Requests are rate-limited per IP (20 per 10 minutes, best-effort per instance).
