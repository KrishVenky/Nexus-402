// ─── x402 Protocol Types ─────────────────────────────────────────────────────
// Bidirectional async-safe HTTP payment handshake types for Nexus-402

export type X402Invoice = {
  invoiceId: string;           // UUID v4
  amountLamports: number;
  paymentDestination: string;  // Analyst wallet pubkey (base58)
  escrowRequired: true;
  escrowProgramId: string;
  jobId: string;               // hex-encoded 32 bytes
  expiresAt: number;           // Unix timestamp (seconds)
  memo: string;
};

export type X402PaymentRequest = {
  task: "sentiment_analysis";
  payload: {
    symbols: string[];
    lookbackHours: number;
    source: "twitter" | "reddit" | "news" | "all";
    aggregation: "weighted_mean" | "simple_mean";
  };
  sla: {
    maxLatencyMs: number;
    minConfidence: number;
  };
};

export type X402PaymentConfirmation = {
  invoiceId: string;
  jobId: string;
  escrowTxSignature: string;
  escrowPda: string;
  confirmedAt: number;
};

export type SentimentScore = {
  label: "positive" | "negative" | "neutral";
  score: number;       // 0.0 – 1.0
  confidence: number;  // 0.0 – 1.0
};

export type SentimentResult = {
  scores: Record<string, SentimentScore>;
  aggregateSentiment: "positive" | "negative" | "neutral";
  signalStrength: "strong" | "moderate" | "weak";
  sourceCount: number;
  modelVersion: string;
  inferenceBackend: "hailo8_npu" | "onnx_cpu" | "mock";
  inferenceMs: number;
};

export type X402Callback = {
  jobId: string;
  invoiceId: string;
  result: SentimentResult;
  proofHash: string;   // SHA-256 hex of JSON.stringify(result)
  completedAt: number;
};

export type X402Response402 = {
  x402Version: "1.0";
  status: 402;
  invoice: X402Invoice;
  acceptedPaymentMethods: Array<{
    type: "solana_escrow";
    network: "devnet" | "mainnet-beta";
    programId: string;
  }>;
};

export type X402Response202 = {
  status: "processing";
  jobId: string;
  estimatedCompletionMs: number;
  trackingUrl: string;
};

export type JobStatusResponse = {
  jobId: string;
  status: JobStatus;
  progressPercent?: number;
  estimatedRemainingMs?: number;
  error?: string;
};

export type JobStatus = "pending" | "processing" | "completed" | "cancelled" | "error";

export type HealthResponse = {
  ok: boolean;
  pubkey?: string;
  npuAvailable: boolean;
  cpuTempC: number | null;
  npuTempC: number | null;
  inferenceBackend: string;
  memoryFreeMb: number;
  uptimeSeconds: number;
};
