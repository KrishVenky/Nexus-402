# PARTNERSHIP.md — Task Delegation & Workload Split

> **Nexus-402 | Solana Frontier 2026** | Deadline: May 11, 2026
> **Team Size:** 2 Engineers | **Split:** ~50/50 by component

---

## Team

| Role | Name | Focus Domain |
|---|---|---|
| **Lead A** | Krishna Venkatesh | AI/ML, Edge Hardware, LLM Integration |
| **Lead B** | Partner | Solana Smart Contracts, Frontend, Wallet |

---

## Lead A — Krishna Venkatesh

### Primary Ownership

**1. Analyst Agent — AI & Inference Pipeline**
- FinBERT model loading and tokenization (transformers.js + ONNX runtime)
- Hailo-8 NPU acceleration: HailoRT Python subprocess bridge to TypeScript
- CPU fallback path for non-Pi environments
- Inference pipeline: text preprocessing → tokenize → run model → post-process scores
- Confidence thresholding and multi-symbol aggregation logic
- Files: `agents/analyst-agent/inference/`, `agents/analyst-agent/finbert/`

**2. Quant Agent — LLM Strategy Logic**
- Ollama client integration (primary model: llama3.2)
- System prompt design: "given sentiment scores X for BTC/ETH/SOL, generate a trading signal"
- LLM negotiation prompts: how the Quant Agent decides whether to hire the Analyst Agent
- Strategy output parsing: structured JSON trading signals from Ollama completions
- Files: `agents/quant-agent/llm/`, `agents/quant-agent/strategy/`

**3. Edge Hardware Scripts**
- `agents/hardware_check.ts` — Hailo-8 NPU detection, temperature monitoring
- Hailo-8 setup guide (`docs/hailo8-setup.md`) — hailort, PCIe M.2 driver install
- FinBERT model quantization for Hailo-8 (`.hef` format conversion from ONNX)
- Pi 5 systemd service definitions for auto-starting Analyst Agent
- Files: `agents/hardware_check.ts`, `scripts/hailo8/`, `docs/`

**4. x402 Handshake — Analyst Agent Side**
- Invoice generation (Phase 2: 402 response)
- Escrow verification against Solana RPC (before inference starts)
- Async 202 response with ETA calculation (thermal-aware)
- Callback delivery to Quant Agent (Phase 5: result + proof_hash)
- proof_hash computation: `SHA-256(JSON.stringify(result))`
- Replay protection: in-memory `invoice_id` deduplication set
- Files: `agents/analyst-agent/x402/`

**5. Shared Agent Utilities**
- `agents/shared/timeout-config.ts` — all timeout/retry constants
- `agents/shared/solana-client.ts` — shared RPC client factory
- `agents/shared/crypto.ts` — SHA-256 hash, Ed25519 signature helpers
- `agents/shared/logger.ts` — structured JSON logger
- `shared-types/x402.types.ts` — x402 invoice and callback types

---

## Lead B — Partner

### Primary Ownership

**1. Anchor Smart Contract — nexus_escrow**
- All Rust code in `anchor/programs/nexus_escrow/`
- Account struct definitions: `Job`, `AnalystProfile`
- All 5 instructions: `initialize_analyst_profile`, `initialize_job`, `post_proof`, `disburse_funds`, `cancel_job`
- Custom `#[error_code]` enum: `NexusEscrowError`
- PDA derivation validation (ensure seeds match spec in CLAUDE.md)
- TypeScript test suite: `anchor/tests/nexus_escrow.ts` (34 test cases per CHECKLIST.md)
- Files: `anchor/programs/`, `anchor/tests/`, `anchor/Anchor.toml`

**2. x402 Handshake — Quant Agent Side**
- x402 HTTP client: request → receive 402 → parse invoice → pay → confirm
- Retry state machine with exponential backoff (per `X402_TIMEOUT_CONFIG`)
- Status polling loop (`MAX_POLL_ATTEMPTS` × `STATUS_POLL_INTERVAL_MS`)
- Automatic `cancel_job` trigger on poll exhaustion
- `POST /api/v1/callbacks/job-complete` handler: verify proof_hash, trigger disburse
- Files: `agents/quant-agent/x402/`

**3. Solana Program Client (TypeScript)**
- `shared-types/escrow.types.ts` — JobAccount, AnalystProfile account deserialization
- `agents/shared/anchor-client.ts` — typed Anchor IDL client
- Functions: `initializeJob()`, `postProof()`, `disburseFunds()`, `cancelJob()`
- Devnet deployment + `.env` update with program ID
- Files: `agents/shared/anchor-client.ts`, `shared-types/escrow.types.ts`

**4. Next.js Frontend Dashboard**
- Next.js 14 App Router, TypeScript, Phantom Connect
- Pages: `/` (dashboard), `/jobs` (job history), `/agents` (agent profiles)
- Real-time Job PDA state with 2s polling
- `initialize_job` form: set amount, select Analyst Agent, submit transaction
- Job status badges and history table
- Sentiment score visualization (chart.js or recharts)
- Wallet context (Phantom Connect embedded)
- Files: `frontend/app/`, `frontend/components/`, `frontend/lib/`

**5. Metaplex Agent Registration**
- Register Quant Agent and Analyst Agent on Metaplex 014 registry (Core NFT)
- NFT attribute schema: `jobs_completed`, `reputation_score`, `agent_type`
- Post-disburse attribute update logic
- `shared-types/reputation.types.ts` — Metaplex agent metadata types
- Files: `agents/shared/metaplex-client.ts`, `shared-types/reputation.types.ts`

---

## Collaboration Interface

### Shared Contracts (Neither should break these)

| Contract | Owner | Consumers |
|---|---|---|
| `shared-types/x402.types.ts` | Lead A | Lead B (quant-agent x402 client) |
| `shared-types/escrow.types.ts` | Lead B | Lead A (analyst-agent RPC calls) |
| `shared-types/reputation.types.ts` | Lead B | Lead A (analyst-agent callback) |
| `agents/shared/timeout-config.ts` | Lead A | Lead B (quant-agent retry logic) |
| Anchor IDL (auto-generated) | Lead B | Lead A (analyst-agent RPC) |

### API Contracts (Stable by Day 3)

| Endpoint | Implemented By | Called By |
|---|---|---|
| `POST /api/v1/analyze` | Lead A (Analyst) | Lead B (Quant) |
| `POST /api/v1/analyze/confirm` | Lead A (Analyst) | Lead B (Quant) |
| `GET /api/v1/jobs/:id/status` | Lead A (Analyst) | Lead B (Quant + Frontend) |
| `POST /api/v1/callbacks/job-complete` | Lead B (Quant) | Lead A (Analyst) |

### Integration Sync Points

| Day | Sync | Goal |
|---|---|---|
| Day 3 | Sprint 1 review | Anchor program deployed to devnet; shared-types finalized |
| Day 5 | Sprint 2 review | x402 handshake tested end-to-end (mocked inference ok) |
| Day 7 | Sprint 3 review | Full E2E demo running; frontend showing real data |
| Day 8 | Final review | Demo recorded, submission ready |

---

## Communication Protocol

- **Primary channel:** Discord DM + GitHub PRs
- **Daily standup:** 09:00 IST (15 min): what I did, what I'll do, blockers
- **Blockers:** Escalate within 2 hours; don't sit on a blocker overnight
- **Breaking changes:** Any change to shared-types or API contracts requires 15-min sync call

---

## Dependency Graph

```
Lead B: Anchor IDL → Lead A: Analyst Agent RPC calls
Lead A: x402.types.ts → Lead B: Quant Agent x402 client
Lead B: escrow.types.ts → Lead A: Analyst pre-flight escrow check
Lead A: Analyst /api/v1/analyze → Lead B: Quant Agent test loop
Lead B: Frontend → Lead A: /health and /status endpoints
```

Both leads can work in parallel from Day 1 using mocks for cross-dependencies, then swap real implementations at Day 3 sync.

---

*Last updated: 2026-05-03 | Version 1.0*
