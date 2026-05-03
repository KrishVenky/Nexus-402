# SYSTEM.md — Agent Interaction Protocol v1

> **Nexus-402 | Solana Frontier 2026** | Version: 1.0.0

---

## 1. System Architecture

```
┌──────────────────┐    x402 HTTP     ┌──────────────────────────┐
│  QUANT AGENT     │◄────────────────►│  ANALYST AGENT           │
│  (Buyer)         │                  │  (Worker / Edge)         │
│  Ollama LLM      │                  │  FinBERT + Hailo-8 NPU   │
│  Port: 3001      │                  │  Raspberry Pi 5          │
└────────┬─────────┘                  └────────────┬─────────────┘
         │                                         │
         └─────────────┬───────────────────────────┘
                       │ Solana devnet
              ┌────────▼─────────┐
              │  nexus_escrow    │
              │  (Anchor 0.32.1) │
              │  • initialize_job│
              │  • post_proof    │
              │  • disburse_funds│
              └──────────────────┘
```

---

## 2. x402 Handshake — Full Flow

### Phase 1: Work Request (Quant → Analyst)

```http
POST /api/v1/analyze HTTP/1.1
X-Agent-ID: <quant_metaplex_nft_address>
X-Job-ID: <uuid_v4>
X-Escrow-PDA: <derived_pda_address>

{ "task": "sentiment_analysis", "symbols": ["BTC","ETH","SOL"],
  "lookback_hours": 24, "sla": { "max_latency_ms": 30000 } }
```

### Phase 2: 402 Payment Required (Analyst → Quant)

```http
HTTP/1.1 402 Payment Required
X-402-Version: 1.0

{
  "x402": {
    "invoice": {
      "invoice_id": "<uuid>",
      "amount_lamports": 500000,
      "payment_destination": "<analyst_wallet_pubkey>",
      "escrow_required": true,
      "escrow_program_id": "<nexus_escrow_program_id>",
      "job_id": "<job_id_bytes32>",
      "expires_at": "<unix_ts_+5min>"
    }
  }
}
```

### Phase 3: Escrow Lock + Confirm (Quant → Solana → Analyst)

```
1. Quant calls initialize_job on Anchor → locks 500000 lamports in Job PDA
2. Quant sends confirmation HTTP POST to Analyst with tx_signature
3. Analyst verifies tx on-chain via RPC → starts inference
4. Analyst returns 202 Accepted
```

### Phase 4: Async Inference (Hailo-8 NPU)

```http
HTTP/1.1 202 Accepted
X-Job-Status: processing
X-Estimated-Completion: <unix_ts>
```

### Phase 5: Result Callback (Analyst → Quant)

```http
POST /api/v1/callbacks/job-complete HTTP/1.1
X-Signature: <ed25519_sig>

{
  "job_id": "<job_id>",
  "result": { "BTC": { "label": "positive", "score": 0.847 } },
  "proof_hash": "<sha256_of_result>",
  "completed_at": "<unix_ts>"
}
```

### Phase 6: Settlement (Proof + Disburse)

```
1. Analyst calls post_proof on Anchor → stores proof_hash on Job PDA
2. Quant verifies result hash == proof_hash
3. Quant calls disburse_funds → payment released to Analyst wallet
4. Reputation NFT updated by Anchor program
```

---

## 3. ⚠️ CRITICAL: Timeout & Retry Logic (Edge Hardware)

> **Context:** Pi 5 + Hailo-8 inference = 800ms–3000ms p50; p95 = 5–15s with thermal variance.
> The Quant Agent holds an open escrow lock. Failure to handle delays → stranded capital.

### Timeout Configuration

```typescript
// agents/shared/timeout-config.ts
export const X402_TIMEOUT_CONFIG = {
  INVOICE_RESPONSE_TIMEOUT_MS: 5_000,   // 402 must arrive within 5s
  ESCROW_CONFIRM_TIMEOUT_MS: 30_000,    // Solana tx confirmation
  INFERENCE_TIMEOUT_MS: 60_000,         // Edge inference max (thermal headroom)
  CALLBACK_DELIVERY_TIMEOUT_MS: 5_000,
  PROOF_SUBMISSION_TIMEOUT_MS: 30_000,
  MAX_RETRIES: 3,
  INITIAL_RETRY_DELAY_MS: 1_000,
  RETRY_BACKOFF_MULTIPLIER: 2.0,
  MAX_RETRY_DELAY_MS: 10_000,
  JOB_ESCROW_EXPIRY_SECONDS: 300,       // 5 min: safe for Pi 5
  STATUS_POLL_INTERVAL_MS: 2_000,
  MAX_POLL_ATTEMPTS: 25,               // 50s total polling window
} as const;
```

### Quant Agent State Machine

```
[SEND_REQUEST] ──timeout──► retry(backoff) or ABORT
      │ 402 received
[INIT_ESCROW] ──timeout──► retry or ABORT
      │ confirmed
[SEND_CONFIRM] ──► 202 Accepted
      │
[POLLING_STATUS] ──5min timeout──► [CANCEL_JOB → recover funds]
      │ complete
[VERIFY_RESULT] ──hash mismatch──► DISPUTE
      │ valid
[DISBURSE_FUNDS] → COMPLETE
```

### Analyst Agent Async Guard

```typescript
// WHY: Must check escrow is still active before submitting proof.
// Pi 5 thermal throttling may delay inference past escrow expiry.
async function safePostProof(jobId: string, proofHash: string): Promise<void> {
  const escrow = await fetchEscrowState(jobId);
  if (escrow.status === 'cancelled' || escrow.expiresAt < Date.now() / 1000) {
    logger.warn(`Job ${jobId}: escrow expired/cancelled. Skipping proof.`);
    return;
  }
  await submitProofOnChain(jobId, proofHash);
}
```

### Pi 5 Thermal Awareness

```typescript
// In /api/v1/analyze handler, before accepting work:
const temp = await getCpuTemperature();
if (temp > 85) return res.status(503).json({ error: 'NPU_THERMAL_THROTTLE' });
// WHY: 503 here prevents Quant from starting an escrow that will time out.
// Return 503 (not 500) so Quant Agent can retry with backoff.
const estimatedMs = temp > 75 ? baseEstimate * 1.5 : baseEstimate;
```

---

## 4. On-Chain State Machine

```
Job PDA States:
NONE ──initialize_job──► INITIALIZED ──post_proof──► PROOF_SUBMITTED ──disburse_funds──► DISBURSED
                              │                                                                  
                              └──cancel_job (after expiry)──► CANCELLED                         
```

| Instruction | Authority | Guard |
|---|---|---|
| `initialize_job` | Quant Agent (initiator) | Funds >= amount; valid analyst profile |
| `post_proof` | Analyst Agent (worker) | Job INITIALIZED; caller == worker |
| `disburse_funds` | Quant Agent | Job PROOF_SUBMITTED; proof_hash non-zero |
| `cancel_job` | Quant Agent | Job INITIALIZED; clock >= expires_at |

---

## 5. Shared Type Schemas

```typescript
// shared-types/x402.types.ts
export type X402Invoice = {
  invoiceId: string;
  amountLamports: number;
  paymentDestination: string;
  escrowProgramId: string;
  jobId: string; // hex
  expiresAt: number;
};

export type SentimentScore = {
  label: 'positive' | 'negative' | 'neutral';
  score: number;        // 0.0 – 1.0
  confidence: number;   // 0.0 – 1.0
};

export type SentimentResult = {
  scores: Record<string, SentimentScore>;
  aggregateSentiment: 'positive' | 'negative' | 'neutral';
  signalStrength: 'strong' | 'moderate' | 'weak';
  sourceCount: number;
};

export type X402Callback = {
  jobId: string;
  invoiceId: string;
  result: SentimentResult;
  proofHash: string;       // SHA-256 hex of JSON.stringify(result)
  completedAt: number;
};

export type JobStatus = 'pending' | 'processing' | 'completed' | 'cancelled' | 'error';
```

---

## 6. Security Guarantees

| Threat | Mitigation |
|---|---|
| Analyst delivers garbage | Quant verifies `SHA-256(result) == proof_hash` before disbursing |
| Quant never disburses | Analyst can trigger disburse after PROOF_SUBMITTED + 30s grace |
| Sybil Analyst Agents | `initialize_analyst_profile` requires 0.01 SOL stake |
| Replay x402 invoice | Analyst tracks used `invoice_id`s; job_id is globally unique |
| Pi 5 crashes mid-inference | Escrow expiry auto-returns funds; no proof = no payment |
| Fake escrow tx | Analyst verifies tx on-chain before starting inference |

---

## 7. API Reference

### Analyst Agent (Port 3002)

| Method | Path | Returns |
|---|---|---|
| POST | `/api/v1/analyze` | 402 with invoice |
| POST | `/api/v1/analyze/confirm` | 202 Accepted |
| GET | `/api/v1/jobs/:id/status` | `{ status, progress, eta }` |
| GET | `/api/v1/health` | `{ ok, temp_c, npu_loaded }` |

### Quant Agent (Port 3001)

| Method | Path | Returns |
|---|---|---|
| POST | `/api/v1/callbacks/job-complete` | 200 OK |
| GET | `/api/v1/strategy/status` | Strategy state |
| POST | `/api/v1/strategy/trigger` | Initiate analysis cycle |

---

*Version 1.0.0 | Last updated: 2026-05-03*
