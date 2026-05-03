# Nexus-402

> Decentralized agent-to-agent labor market on Solana — **Frontier Hackathon 2026**

A **Quant Agent** programmatically hires a **Sentiment Analyst Agent** via the x402 HTTP payment standard, with trustless settlement on an Anchor escrow program.

## How It Works

```
Quant Agent  ──POST /analyze──►  Analyst Agent
             ◄──402 + invoice──
             ──initialize_job──►  Anchor (Solana)  [funds locked]
             ──confirm + pay──►   Analyst Agent
                                  FinBERT inference (Hailo-8 NPU / CPU)
             ◄──result + hash──
             ──disburse_funds──►  Anchor           [payment released]
```

## Stack

| Layer | Technology |
|---|---|
| Smart Contract | Anchor 0.32.1 |
| Payment Protocol | x402 (HTTP 402) |
| Quant Agent | ElizaOS + Ollama (llama3.2) |
| Analyst Agent | FinBERT + ONNX / Hailo-8 NPU |
| Agent Identity | Metaplex Core NFT (014 registry) |
| Frontend | Next.js 14 + Phantom Connect |

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
# Fill in .env — see comments in file

# 3. Hardware check (detects Hailo-8 NPU on Pi 5, falls back to CPU/mock)
npm run hardware-check

# 4. Run agents locally (two terminals)
npm run dev:analyst
npm run dev:quant

# 5. Smart contract (requires Solana CLI + Anchor 0.32.1)
npm run anchor:build
npm run anchor:test
npm run anchor:deploy:devnet
```

## Project Structure

```
nexus-402/
├── anchor/          # Rust smart contracts (nexus_escrow)
├── agents/          # Quant + Analyst agent code
│   └── hardware_check.ts  # Hailo-8 NPU detection
├── frontend/        # Next.js dashboard
├── shared-types/    # TypeScript type definitions
├── CLAUDE.md        # Project brain & code style
├── SYSTEM.md        # Agent interaction protocol (x402 spec)
├── CHECKLIST.md     # Sprint milestones & test cases
└── PARTNERSHIP.md   # Task delegation
```

## Docs

- [`CLAUDE.md`](./CLAUDE.md) — full tech stack, build commands, code style
- [`SYSTEM.md`](./SYSTEM.md) — x402 handshake spec + timeout/retry logic
- [`CHECKLIST.md`](./CHECKLIST.md) — 34 test cases across 4 sprints
- [`PARTNERSHIP.md`](./PARTNERSHIP.md) — who owns what

## Team

- **Krishna Venkatesh** — AI/ML, FinBERT, Hailo-8, Ollama integration
- **Partner** — Anchor contracts, Next.js frontend, wallet integration
