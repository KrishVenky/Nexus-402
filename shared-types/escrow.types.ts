// ─── Anchor Escrow Account Types ──────────────────────────────────────────────
// Mirrors the on-chain account structs in nexus_escrow/src/state/

export type EscrowJobStatus =
  | { initialized: Record<string, never> }
  | { proofSubmitted: Record<string, never> }
  | { disbursed: Record<string, never> }
  | { cancelled: Record<string, never> };

export type JobAccount = {
  initiator: string;       // Quant Agent wallet pubkey (base58)
  worker: string;          // Analyst Agent wallet pubkey (base58)
  jobId: number[];         // [u8; 32]
  amountLamports: bigint;
  proofHash: number[];     // [u8; 32] — SHA-256 of result JSON
  status: EscrowJobStatus;
  expiresAt: bigint;       // Unix timestamp (i64)
  createdAt: bigint;
  bump: number;
};

export type AnalystProfileAccount = {
  owner: string;           // Wallet pubkey (base58)
  stakeAmount: bigint;     // Locked SOL stake (>= MIN_STAKE)
  jobsCompleted: bigint;
  jobsAttempted: bigint;
  reputationScore: bigint; // 0–10000 (basis points)
  reputationNft: string | null; // Metaplex Core NFT address (base58)
  registeredAt: bigint;
  bump: number;
};

// PDA derivation helpers (mirrors on-chain seeds)
export type JobPdaSeeds = {
  initiator: string;       // base58 pubkey
  jobId: Uint8Array;       // 32 bytes
};

export type AnalystProfilePdaSeeds = {
  owner: string;           // base58 pubkey
};

// Instruction argument types (for TypeScript client)
export type InitializeJobArgs = {
  jobId: number[];         // [u8; 32]
  amountLamports: bigint;
  worker: string;          // base58 pubkey
  expirySeconds?: number;  // default 300 (5 min)
};

export type PostProofArgs = {
  jobId: number[];
  proofHash: number[];     // [u8; 32]
};

export type DisburseArgs = {
  jobId: number[];
};

export type CancelJobArgs = {
  jobId: number[];
};

// Client-side event types emitted after instruction confirmations
export type JobInitializedEvent = {
  event: "JobInitialized";
  jobPda: string;
  initiator: string;
  worker: string;
  amountLamports: bigint;
  expiresAt: bigint;
};

export type ProofSubmittedEvent = {
  event: "ProofSubmitted";
  jobPda: string;
  worker: string;
  proofHash: string;   // hex
};

export type FundsDisbursedEvent = {
  event: "FundsDisbursed";
  jobPda: string;
  worker: string;
  amountLamports: bigint;
  newReputationScore: bigint;
};
