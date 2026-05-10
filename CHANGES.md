# Nexus-402 Changes

## Summary

This update makes the dashboard clearer for Vercel deployment and starts replacing synthetic frontend data with live agent data when the Quant and Analyst services are reachable.

## Frontend / Vercel

- Improved the deployed dashboard readability:
  - higher contrast text and panels
  - cleaner background styling
  - less visual noise
  - fixed broken encoding characters in public UI files
- Added a visible data-source banner:
  - `LIVE AGENT DATA` when the browser can reach the agents
  - `DEMO FALLBACK DATA` when agents are unreachable
- The dashboard now polls:
  - Quant Agent `/api/v1/health`
  - Quant Agent `/api/v1/strategy/status`
  - Analyst Agent `/api/v1/health`
- The trigger button now calls the real Quant Agent `/api/v1/strategy/trigger` when live agents are reachable.
- Added root `vercel.json` so Vercel can build the frontend from this monorepo.
- Updated `frontend/README.md` with Vercel deployment notes and live-agent URL guidance.
- Set the frontend Turbopack root in `frontend/next.config.ts` to avoid workspace-root warnings.

## Backend Agents

- Added CORS headers to both agents so the browser dashboard can call them.
- Analyst Agent `/api/v1/health` now includes the Analyst wallet public key.
- Analyst Agent now has real text ingestion for ONNX inference:
  - CryptoPanic for crypto-native news
  - NewsAPI for broader article search
  - GNews for broader article search
  - Reddit public subreddit search for social/community posts
- Analyst async inference now uses the original request payload instead of always forcing `BTC/ETH/SOL` and `source: all`.
- ONNX inference now averages sentiment across fetched documents per symbol instead of using one placeholder sentence.
- `sourceCount` now reports the number of ingested documents used by ONNX inference.
- Quant Agent `/api/v1/strategy/status` now exposes:
  - latest trading signal
  - pending job count
  - strategy runs
  - received callbacks
  - settlement/disbursement records
- Quant callback handling now stores settlement state for successful and failed disbursement attempts.

## Types / Build

- Added optional `pubkey` to `HealthResponse`.
- Fixed `shared-types/tsconfig.json` by using `module: "Node16"` with `moduleResolution: "node16"`.
- Added ingestion environment variables to `.env.example`:
  - `CRYPTOPANIC_API_KEY`
  - `NEWSAPI_KEY`
  - `GNEWS_API_KEY`
  - `REDDIT_SUBREDDITS`
  - `SENTIMENT_MAX_DOCS_PER_SYMBOL`
  - `SENTIMENT_FETCH_TIMEOUT_MS`
- Verified:
  - `npm run check:types`
  - `npx tsc --noEmit`
  - `cd frontend && npm run build`

## What Is Still Demo / Synthetic

- The public Vercel page can only show real live data if Quant and Analyst agents are available on public HTTPS URLs.
- If agents are not reachable, the UI intentionally falls back to demo data and labels it clearly.
- The Analyst inference backend still defaults to mock unless configured with:
  - `INFERENCE_BACKEND=onnx_cpu`, or
  - `INFERENCE_BACKEND=hailo8_npu`
- ONNX now ingests real text when source APIs are configured, but the tokenizer is still a lightweight hash-based placeholder. A production FinBERT setup should use the matching HuggingFace tokenizer for the ONNX model.
- If no source API keys are configured and Reddit is unreachable, ONNX falls back to one minimal text string per symbol so the pipeline still runs.
- Anchor can still be bypassed with `MOCK_ANCHOR=true` for local demos.

## Real Text Ingestion

Recommended first source:

```env
CRYPTOPANIC_API_KEY=your_token
INFERENCE_BACKEND=onnx_cpu
```

Optional extra sources:

```env
NEWSAPI_KEY=your_newsapi_key
GNEWS_API_KEY=your_gnews_key
REDDIT_SUBREDDITS=CryptoCurrency,Bitcoin,ethereum,solana,defi
SENTIMENT_MAX_DOCS_PER_SYMBOL=24
SENTIMENT_FETCH_TIMEOUT_MS=8000
```

The Analyst Agent maps request `source` like this:

- `news`: CryptoPanic, NewsAPI, GNews
- `reddit`: Reddit subreddit search
- `all`: news sources plus Reddit
- `twitter`: currently treated as unsupported unless another provider is added

## Run Locally

Install dependencies:

```bash
npm install
cd frontend
npm install
cd ..
```

Create env:

```bash
copy .env.example .env
```

For local demo mode, use:

```env
MOCK_ANCHOR=true
INFERENCE_BACKEND=mock
ANALYST_AGENT_ENDPOINT=http://localhost:3002
QUANT_AGENT_PORT=3001
ANALYST_AGENT_PORT=3002
```

Run the services in three terminals:

```bash
npm run dev:analyst
npm run dev:quant
npm run dev:frontend
```

Open:

```text
http://localhost:3000/Nexus-402.html
```

## Vercel Live Data

Existing Vercel page:

```text
https://nexus-402-gules.vercel.app/Nexus-402.html
```

For real live agent data, expose the Quant and Analyst agents on public HTTPS URLs and open:

```text
https://nexus-402-gules.vercel.app/Nexus-402.html?quant=https://YOUR-QUANT-URL&analyst=https://YOUR-ANALYST-URL
```

Set `FRONTEND_ORIGIN` on both agent services to the Vercel origin for stricter CORS:

```env
FRONTEND_ORIGIN=https://nexus-402-gules.vercel.app
```
