# CLAUDE.md — Nexus-402 Project Brain

> **Hackathon:** Solana Frontier 2026 | **Deadline:** May 11, 2026 (8 days)
> **Team:** Krishna Venkatesh (Lead A) + Partner (Lead B)
> **Category:** AI Agents × DeFi / Decentralized Labor Market

---

## 1. Project Overview

**Nexus-402** is a decentralized agent-to-agent (A2A) labor market on Solana.

It enables a **Quant Agent** (buyer) to programmatically hire a **Sentiment Analyst Agent** (worker) using:
- **x402 HTTP Payment Protocol** — for the handshake and invoice exchange
- **Anchor `nexus_escrow` Program** — for trustless fund locking, proof submission, and settlement
- **Metaplex Core NFT (014 registry)** — for on-chain agent identity and reputation
- **FinBERT on Hailo-8 NPU** — for real-time sentiment inference on edge hardware

### Why This Wins

| Judging Criterion | Nexus-402 Answer |
|---|---|
| Technical Execution | Anchor 0.32.1 + x402 + ElizaOS + FinBERT/Hailo-8 |
| Innovation | First A2A labor market with HTTP-native payment handshake |
| Potential Impact | Infrastructure primitive for any agent marketplace |
| Presentation | Live demo: Quant Agent hires Analyst Agent, pays on-chain |

---

## 2. Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Smart Contract | Anchor 0.32.1 (Rust) | nexus_escrow program |
| Agent Runtime | ElizaOS v0.1.x | Plugin-based architecture |
| Quant Agent LLM | Ollama (local) | llama3.2 / mistral for strategy |
| Analyst Agent ML | FinBERT via transformers.js | Edge: Raspberry Pi 5 + Hailo-8 NPU |
| Payment Protocol | x402 (HTTP 402 standard) | Bidirectional async-safe handshake |
| Frontend | Next.js 14 + Phantom Connect | Real-time escrow dashboard |
| Wallet | Phantom Connect + Swig (agent wallets) | Smart wallet with policy controls |
| Agent Identity | Metaplex Core NFT (014 registry) | On-chain reputation as Core NFT |
| Shared Types | TypeScript interfaces | Shared between agents + frontend |
| RPC | Helius / Alchemy (devnet + mainnet-beta) | High-reliability reads & writes |

---

## 3. Repository Structure

```
nexus-402/
├── anchor/                  # Rust smart contracts
│   ├── programs/
│   │   └── nexus_escrow/
│   │       └── src/
│   │           ├── lib.rs
│   │           ├── instructions/
│   │           │   ├── initialize_job.rs
│   │           │   ├── post_proof.rs
│   │           │   └── disburse_funds.rs
│   │           └── state/
│   │               ├── job.rs
│   │               └── analyst_profile.rs
│   ├── tests/
│   │   └── nexus_escrow.ts
│   └── Anchor.toml
├── agents/
│   ├── quant-agent/         # Buyer agent (Ollama-powered)
│   ├── analyst-agent/       # Worker agent (FinBERT/Hailo-8)
│   ├── shared/              # Shared agent utilities
│   └── hardware_check.ts    # Hailo-8 NPU detection
├── frontend/                # Next.js 14 dashboard
│   ├── app/
│   ├── components/
│   └── lib/
├── shared-types/            # TypeScript type definitions
│   ├── x402.types.ts
│   ├── escrow.types.ts
│   └── reputation.types.ts
├── .agents/                 # Colosseum skills (auto-generated)
├── CLAUDE.md               # This file — project brain
├── SYSTEM.md               # Agent interaction protocol
├── CHECKLIST.md            # Sprint milestones
└── PARTNERSHIP.md          # Task delegation
```

---

## 4. Build & Test Commands

### Smart Contracts (Anchor)
```bash
# From /anchor directory
anchor build                          # Compile Rust programs
anchor test                           # Run TypeScript tests against localnet
anchor deploy --provider.cluster devnet  # Deploy to devnet
anchor verify <PROGRAM_ID>           # Verify on-chain bytecode

# Localnet management
solana-test-validator                 # Start local validator
anchor localnet                       # Start validator + deploy
```

### Agents
```bash
# From /agents directory
npm install                           # Install dependencies
npm run dev:quant                     # Start Quant Agent (port 3001)
npm run dev:analyst                   # Start Analyst Agent (port 3002)
npm run hardware-check               # Detect Hailo-8 NPU
npm run test:x402                     # Test x402 handshake
```

### Frontend
```bash
# From /frontend directory
npm install
npm run dev                           # Start Next.js dev server (port 3000)
npm run build                         # Production build
npm run lint                          # ESLint check
```

### Full Stack Integration Test
```bash
# From root
npm run test:integration              # Run full E2E: escrow + x402 + agents
npm run demo                          # Start all services for demo
```

---

## 5. Code Style Rules

### TypeScript (Agents + Frontend)
- **Functional paradigm only** — no classes, prefer pure functions and composition
- **Strict mode** — `"strict": true` in tsconfig, zero `any` types
- **Explicit return types** — all exported functions must have explicit return types
- **No barrel imports in hot paths** — import specifically to avoid circular deps
- **Error handling** — always use `Result<T, E>` pattern via `neverthrow` or explicit `{ data, error }` tuples
- **Async** — prefer `async/await` over `.then()` chains; never swallow errors silently
- **Naming** — `camelCase` for variables/functions, `PascalCase` for types/interfaces, `SCREAMING_SNAKE` for constants
- **No horizontal layouts** — vertical composition, one concern per file

### Rust (Anchor)
- Follow Anchor 0.32.1 best practices: `#[account]` constraints in struct definitions, not instruction bodies
- **All PDAs** derived with `seeds = [b"job", initiator.key().as_ref(), job_id.as_ref()]`
- **Anchor error codes** — use custom `#[error_code]` enum, never `panic!` or `unwrap()`
- **Access control** — use `has_one` and `constraint` in `#[account]` macros for all authority checks
- **Space allocation** — always compute `space` explicitly: `8 + JobAccount::INIT_SPACE`
- **Sysvar** — use `sysvar::clock::Clock` via `Clock::get()?` not account injection

### General Principles
- **DRY** — shared logic goes to `shared-types/` or `agents/shared/`
- **No placeholders** — mock implementations must be functional
- **Comments** — document *why*, not *what*; use `// WHY:` prefix for non-obvious decisions

---

## 6. Environment Variables

```bash
# .env (never commit — use .env.example as template)
SOLANA_CLUSTER=devnet
SOLANA_RPC_URL=https://devnet.helius-rpc.com/?api-key=YOUR_KEY
PROGRAM_ID=<deployed_nexus_escrow_program_id>

# Quant Agent
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
QUANT_AGENT_PORT=3001
QUANT_AGENT_WALLET_PRIVATE_KEY=<base58_private_key>

# Analyst Agent
ANALYST_AGENT_PORT=3002
ANALYST_AGENT_WALLET_PRIVATE_KEY=<base58_private_key>
ANALYST_AGENT_ENDPOINT=http://localhost:3002
FINBERT_MODEL_PATH=./models/finbert
HAILO_DEVICE_ID=0  # Set to -1 for CPU fallback

# Frontend
NEXT_PUBLIC_PROGRAM_ID=<deployed_program_id>
NEXT_PUBLIC_SOLANA_RPC=https://devnet.helius-rpc.com/?api-key=YOUR_KEY
NEXT_PUBLIC_CLUSTER=devnet
```

---

## 7. Key Design Decisions & WHYs

### WHY x402 for the handshake?
x402 is the emerging HTTP-native payment standard (CDPay / coinbase compatible). Using it means any standard HTTP client can trigger a payment without custom SDK integration. The 402 status code is semantically correct: "Payment Required."

### WHY Anchor escrow instead of direct transfer?
Trustless settlement. The Quant Agent cannot receive the sentiment data before payment; the Analyst Agent cannot receive payment before delivering verifiable work. The escrow + proof hash model ensures atomicity.

### WHY FinBERT on Hailo-8 NPU?
FinBERT (financial BERT) has 10-15% better accuracy on market sentiment vs generic sentiment models. The Hailo-8 NPU on Pi 5 delivers ~13 TOPS, enabling sub-200ms inference without cloud dependency — critical for low-latency trading signals.

### WHY Metaplex Core NFT for reputation?
The Metaplex 014 registry is the hackathon-endorsed standard for agent identity. Core NFTs have built-in wallet addresses, making them economically active entities. Reputation state updates are reflected in NFT attributes, making them publicly verifiable.

### WHY Swig for agent wallets?
Swig's programmable smart wallets support spending policies and delegated execution — perfect for constraining an agent's on-chain actions to its designated role (e.g., Analyst Agent can only receive payments to its designated PDA).

---

## 8. Sponsor Integrations Checklist

- [ ] **Phantom Connect** — Frontend wallet embed (React template)
- [ ] **Metaplex** — Agent registration (014 registry) + Reputation NFT
- [ ] **Swig** — Smart wallet for Analyst Agent with spending policy
- [ ] **World AgentKit** — Optional: Proof of Human for Sybil resistance on Analyst profiles
- [ ] **Arcium** — Future: Encrypt sentiment scores before on-chain settlement

---

## 9. Security Considerations

1. **PDA seed collision** — `job_id` is a `[u8; 32]` UUID hash, not an incrementing counter
2. **Sybil resistance** — `initialize_analyst_profile` requires a 0.01 SOL stake locked in the profile PDA
3. **Reentrancy** — Anchor's ownership checks prevent cross-program reentrancy; funds only move in `disburse_funds`
4. **Proof integrity** — `post_proof` stores a SHA-256 hash of the sentiment payload; Quant Agent verifies on receipt
5. **Timeout safety** — Escrow has a `expires_at` Unix timestamp; after expiry, `cancel_job` returns funds to initiator

---

*Last updated: 2026-05-03 by Krishna Venkatesh*
