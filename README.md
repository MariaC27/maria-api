# maria-api

Thin serverless API powering the interactive API reference on [mariacristoforo.com](https://mariacristoforo.com). Deployed on Vercel.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/me` | Profile info |
| `GET` | `/api/skills` | Skills list, filterable by `proficiency` and `category` |
| `GET` | `/api/work` | Case studies |
| `GET` | `/api/availability` | Current availability and contact windows |
| `POST` | `/api/hire` | Submit a role — evaluated by Claude, triggers email notification |
| `POST` | `/api/contact` | Send a message — triggers email notification |

## Stack

- Vercel Functions (no framework)
- [Anthropic API](https://anthropic.com) — Claude Haiku evaluates hire requests
- [Resend](https://resend.com) — email notifications for `/hire` and `/contact`

## Environment variables

| Variable | Used by |
|----------|---------|
| `ANTHROPIC_API_KEY` | `hire.js` |
| `RESEND_API_KEY` | `hire.js`, `contact.js` |
