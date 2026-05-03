# CHECKLIST.md — Nexus-402 Sprint Milestones

> **Hackathon:** Solana Frontier 2026 | **Deadline:** May 11, 2026
> **Status Legend:** ✅ Done | 🔄 In Progress | ⬜ Not Started | 🚨 Blocking

---

## Sprint Overview

| Sprint | Days | Focus | Goal |
|---|---|---|---|
| Sprint 0 | Day 1 (May 3) | Setup & Init | Repo, tooling, docs |
| Sprint 1 | Day 2–3 | Anchor Core | nexus_escrow deployed to devnet |
| Sprint 2 | Day 4–5 | Agent Logic | x402 handshake + FinBERT inference |
| Sprint 3 | Day 6–7 | Frontend + Integration | Dashboard live, E2E demo working |
| Sprint 4 | Day 8 (May 11) | Polish + Submit | Bug fixes, video demo, submission |

---

## SPRINT 0 — Setup & Initialization

### 0.1 Workspace
- ✅ Run `npx skills add ColosseumOrg/colosseum-resources`
- ✅ Create `/anchor`, `/agents`, `/frontend`, `/shared-types` directories
- ✅ Create `CLAUDE.md`, `SYSTEM.md`, `CHECKLIST.md`, `PARTNERSHIP.md`
- ✅ Create `agents/hardware_check.ts`
- ⬜ Initialize `anchor/` with `anchor init nexus_escrow`
- ⬜ Initialize `agents/` with `npm init`
- ⬜ Initialize `frontend/` with `npx create-next-app@latest`
- ⬜ Initialize `shared-types/` with TypeScript config
- ⬜ Create `.env.example` with all required variables
- ⬜ Create `package.json` at root with `npm run demo` script

### 0.2 Tooling Validation
- ⬜ Verify Anchor 0.32.1: `anchor --version`
- ⬜ Verify Solana CLI: `solana --version`
- ⬜ Verify Ollama running: `ollama list`
- ⬜ Verify devnet keypair funded: `solana balance --url devnet`
- ⬜ Run `npx tsc --noEmit` on shared-types — zero errors

---

## SPRINT 1 — Anchor Smart Contract

### 1.1 Program Architecture
- ⬜ Define `Job` account struct with all fields
- ⬜ Define `AnalystProfile` account struct with stake + reputation
- ⬜ Define custom `#[error_code]` enum (`NexusEscrowError`)
- ⬜ Define all PDAs with correct seeds

### 1.2 Instructions

#### `initialize_analyst_profile`
- ⬜ Creates AnalystProfile PDA for a new worker agent
- ⬜ **TEST:** Requires exactly 0.01 SOL stake (10,000,000 lamports)
- ⬜ **TEST:** Fails with `InsufficientStake` if stake < 0.01 SOL
- ⬜ **TEST:** Idempotent — second call fails with `ProfileAlreadyExists`
- ⬜ **TEST:** Profile PDA derived as `[b"analyst", wallet.key().as_ref()]`

#### `initialize_job`
- ⬜ Creates Job PDA, locks funds from Quant Agent's wallet
- ⬜ Sets `expires_at = Clock::get()?.unix_timestamp + 300` (5 min)
- ⬜ **TEST:** PDA correctly derived as `[b"job", initiator.key().as_ref(), job_id.as_ref()]`
- ⬜ **TEST:** Job status is `Initialized` after successful call
- ⬜ **TEST:** Correct lamport amount transferred to Job PDA
- ⬜ **TEST:** Fails if `amount_lamports < MIN_JOB_AMOUNT` (1000 lamports)
- ⬜ **TEST:** Fails if worker has no `AnalystProfile` (no stake)
- ⬜ **TEST:** Job PDA cannot be re-initialized (account already exists)

#### `post_proof`
- ⬜ Worker agent submits SHA-256 hash of work payload
- ⬜ Transitions job status from `Initialized` → `ProofSubmitted`
- ⬜ **TEST:** Only worker listed in Job PDA can call this
- ⬜ **TEST:** Fails with `InvalidJobStatus` if job is not `Initialized`
- ⬜ **TEST:** Proof hash stored correctly (32 bytes)
- ⬜ **TEST:** Fails after `expires_at` timestamp (job expired)
- ⬜ **TEST:** Fails with zero/empty proof hash

#### `disburse_funds`
- ⬜ Releases lamports from Job PDA → Analyst wallet
- ⬜ Increments `AnalystProfile.jobs_completed` and `reputation_score`
- ⬜ Transitions job status to `Disbursed`
- ⬜ **TEST:** Only initiator (Quant Agent) can call this
- ⬜ **TEST:** Fails if job status is not `ProofSubmitted`
- ⬜ **TEST:** Correct lamports transferred to worker wallet
- ⬜ **TEST:** Job PDA lamports = 0 after disburse (minus rent)
- ⬜ **TEST:** `AnalystProfile.reputation_score` incremented

#### `cancel_job`
- ⬜ Returns locked funds to initiator after expiry
- ⬜ **TEST:** Fails if `Clock::get()?.unix_timestamp < expires_at`
- ⬜ **TEST:** Succeeds after expiry — funds returned to initiator
- ⬜ **TEST:** Cannot cancel a `ProofSubmitted` or `Disbursed` job

### 1.3 PDA Derivation Tests
- ⬜ **TEST:** All Job PDAs are deterministically derived from `(initiator, job_id)` pair
- ⬜ **TEST:** Two jobs with same `initiator` but different `job_id` produce distinct PDAs
- ⬜ **TEST:** Two jobs with same `job_id` but different `initiator` produce distinct PDAs
- ⬜ **TEST:** PDA address computed off-chain matches on-chain derivation

### 1.4 Deployment
- ⬜ `anchor build` — zero compiler warnings
- ⬜ `anchor test` — all tests pass on localnet
- ⬜ `anchor deploy --provider.cluster devnet`
- ⬜ Record program ID in `.env` and `Anchor.toml`
- ⬜ Verify on Solana Explorer (devnet)

---

## SPRINT 2 — Agent Logic

### 2.1 Shared Types (shared-types/)
- ⬜ `x402.types.ts` — X402Invoice, SentimentResult, X402Callback
- ⬜ `escrow.types.ts` — JobAccount, AnalystProfile, EscrowStatus
- ⬜ `reputation.types.ts` — ReputationNFT, MetaplexAgentMetadata
- ⬜ `npm run build` on shared-types — zero errors

### 2.2 Hardware Check
- ✅ `agents/hardware_check.ts` — Hailo-8 NPU detection
- ⬜ **TEST (Pi 5):** Detects `/dev/hailo0` device file
- ⬜ **TEST (Pi 5):** Returns `hailo8_available: true` when NPU found
- ⬜ **TEST (x86):** Returns graceful fallback to CPU mode
- ⬜ **TEST:** CPU temperature read from `/sys/class/thermal/thermal_zone0/temp`

### 2.3 Analyst Agent
- ⬜ Express server on port 3002
- ⬜ `POST /api/v1/analyze` — validate request, return 402 with invoice
- ⬜ `POST /api/v1/analyze/confirm` — verify escrow on-chain, return 202
- ⬜ `GET /api/v1/jobs/:id/status` — return job status + ETA
- ⬜ `GET /api/v1/health` — return NPU temp, load, availability
- ⬜ FinBERT inference pipeline (transformers.js or ONNX)
- ⬜ Hailo-8 NPU acceleration path (hailort Python subprocess bridge)
- ⬜ CPU fallback path for non-Pi environments

**x402 Header Tests:**
- ⬜ **TEST:** Returns `402` with valid `X-402-Version: 1.0` header
- ⬜ **TEST:** Invoice `expires_at` is exactly 5 minutes from request time
- ⬜ **TEST:** Rejects duplicate `invoice_id` (replay protection)
- ⬜ **TEST:** Returns `503` if CPU temp > 85°C (thermal guard)
- ⬜ **TEST:** Returns `202` with valid `X-Estimated-Completion` after confirm

### 2.4 Quant Agent
- ⬜ Express server on port 3001
- ⬜ Ollama client integration (llama3.2 default model)
- ⬜ Strategy prompt template for sentiment-based trading signals
- ⬜ x402 handshake client (full flow: request → pay → verify → disburse)
- ⬜ `POST /api/v1/callbacks/job-complete` — receive result, verify hash
- ⬜ `POST /api/v1/strategy/trigger` — kick off full A2A cycle
- ⬜ Retry logic with exponential backoff (per `X402_TIMEOUT_CONFIG`)
- ⬜ Status polling with `MAX_POLL_ATTEMPTS`
- ⬜ Automatic `cancel_job` on escrow expiry

**Timeout/Retry Tests:**
- ⬜ **TEST:** Retries `analyze` request up to `MAX_RETRIES` on timeout
- ⬜ **TEST:** Exponential backoff correctly doubles delay each retry
- ⬜ **TEST:** Calls `cancel_job` when `MAX_POLL_ATTEMPTS` exceeded
- ⬜ **TEST:** Does NOT call `cancel_job` if `202` received within SLA

### 2.5 End-to-End Agent Integration Test
- ⬜ **TEST:** Full A2A flow completes in under 30s on local network
- ⬜ **TEST:** Funds correctly disbursed after valid proof submission
- ⬜ **TEST:** Funds correctly returned after escrow expiry (cancel_job)
- ⬜ **TEST:** `proof_hash` in callback matches `proof_hash` on Job PDA
- ⬜ **TEST:** `AnalystProfile.reputation_score` incremented after `disburse_funds`

---

## SPRINT 3 — Frontend Dashboard

### 3.1 Wallet Integration
- ⬜ Phantom Connect embedded wallet (email + crypto users)
- ⬜ Wallet adapter context provider
- ⬜ **TEST:** Connect Phantom wallet on devnet
- ⬜ **TEST:** Display SOL balance correctly

### 3.2 Escrow Dashboard
- ⬜ Real-time Job PDA state display (polling or websocket)
- ⬜ `initialize_job` UI — trigger from frontend
- ⬜ Job status badge (Initialized / ProofSubmitted / Disbursed / Cancelled)
- ⬜ Reputation score display for Analyst Agent
- ⬜ **TEST:** Status updates within 2s of on-chain state change

### 3.3 Sentiment Display
- ⬜ Real-time sentiment scores for BTC/ETH/SOL
- ⬜ Signal strength indicator (strong / moderate / weak)
- ⬜ Historical job log (last 10 completed jobs)

### 3.4 Metaplex Agent Identity Panel
- ⬜ Display Quant Agent NFT from Metaplex 014 registry
- ⬜ Display Analyst Agent NFT + reputation attributes
- ⬜ Link to Agent Registry on metaplex.com/agents

---

## SPRINT 4 — Polish & Submission

### 4.1 Reputation NFT Metadata Updates
- ⬜ After each `disburse_funds`, update Analyst NFT attributes:
  - `jobs_completed: N`
  - `reputation_score: N`
  - `last_job_completed: <ISO timestamp>`
- ⬜ **TEST:** NFT metadata reflects correct `jobs_completed` count
- ⬜ **TEST:** Metadata update tx succeeds on devnet
- ⬜ **TEST:** Old attribute values overwritten (not duplicated)

### 4.2 Security Hardening
- ⬜ All Anchor `constraint` expressions tested with adversarial inputs
- ⬜ Fuzz test PDA derivation with random `job_id` values
- ⬜ Verify no overflow in lamport arithmetic (use checked math)

### 4.3 Demo Preparation
- ⬜ Record 3-minute demo video (Quant Agent → 402 → Escrow → Sentiment → Disburse)
- ⬜ Deploy frontend to Vercel
- ⬜ Fund devnet wallets with 2 SOL each (airdrop)
- ⬜ Write project description for Colosseum submission
- ⬜ Submit before May 11, 2026 23:59 UTC

---

## Test Case Summary

| Category | Tests | Status |
|---|---|---|
| Escrow deposit/withdraw | 8 | ⬜ |
| PDA derivation | 4 | ⬜ |
| x402 header exchange | 6 | ⬜ |
| Timeout/retry logic | 4 | ⬜ |
| Reputation NFT metadata | 3 | ⬜ |
| Hardware check (Pi 5) | 4 | ⬜ |
| E2E integration | 5 | ⬜ |
| **Total** | **34** | **0/34** |

---

*Last updated: 2026-05-03 | Sprint 0 complete*
