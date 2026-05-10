# Nexus-402 Frontend

This is the Vercel-facing dashboard for Nexus-402.

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Vercel Deployment

The repo root includes `vercel.json`, so Vercel can build the frontend from this monorepo.

Expected Vercel settings:

- Framework preset: `Next.js`
- Root directory: repo root
- Build command: `cd frontend && npm install && npm run build`
- Output directory: `frontend/.next`

## Live Agent Data

The deployed UI is static/browser driven. It can only read live agent data if the Quant and Analyst agents are exposed on public HTTPS URLs.

By default it tries:

- Quant: `http://localhost:3001`
- Analyst: `http://localhost:3002`

On Vercel, those localhost URLs point at the visitor's machine, not your backend. For hosted live data, open the deployed page with query params:

```text
https://your-vercel-app.vercel.app/?quant=https://your-quant.example.com&analyst=https://your-analyst.example.com
```

The browser stores those endpoints in `localStorage`. If the agents are unreachable, the UI clearly switches to `DEMO FALLBACK DATA`.

Set `FRONTEND_ORIGIN` on both agent services to your Vercel origin if you want strict CORS. Leaving it unset allows all origins for hackathon/demo use.
