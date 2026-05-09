/* global React */

// ============================================================
// Mock data + utilities
// ============================================================

const QUANT_PUBKEY = "QnT4f9aJ8XW2dKp7vRn3sLhB5cYxZmEoUgT1iVjP6kHa";
const ANALYST_PUBKEY = "AnLy2pK9bD3wRsQ7uVxN8tFmCzG4jHeXoYdT5iLpA1Mn";

const SOL_PER_LAMPORT = 1 / 1_000_000_000;

function lamportsToSol(lamports) {
  return (lamports * SOL_PER_LAMPORT);
}

function fmtSol(lamports, digits = 4) {
  return lamportsToSol(lamports).toFixed(digits);
}

function truncatePubkey(pk, head = 4, tail = 4) {
  if (!pk) return "";
  if (pk.length <= head + tail + 1) return pk;
  return `${pk.slice(0, head)}…${pk.slice(-tail)}`;
}

function truncateHash(h, head = 6, tail = 4) {
  if (!h) return "";
  return `${h.slice(0, head)}…${h.slice(-tail)}`;
}

function timeAgo(ts) {
  const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function genHash(seed = Math.random()) {
  const chars = "0123456789abcdef";
  let s = "";
  for (let i = 0; i < 64; i++) s += chars[Math.floor((Math.sin(seed * 1000 + i) * 0.5 + 0.5) * 16)];
  return s;
}

function genTxSig(seed = Math.random()) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789";
  let s = "";
  let x = seed;
  for (let i = 0; i < 88; i++) {
    x = (x * 9301 + 49297) % 233280;
    s += chars[Math.floor((x / 233280) * chars.length)];
  }
  return s;
}

function explorerTx(sig) {
  return `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
}
function explorerAddr(addr) {
  return `https://explorer.solana.com/address/${addr}?cluster=devnet`;
}

// ============================================================
// Seed jobs (3-4 in various states)
// ============================================================
const NOW = Date.now();

const SEED_JOBS = [
  {
    jobId: genHash(0.913),
    status: "Disbursed",
    amountLamports: 25_000_000,
    worker: ANALYST_PUBKEY,
    buyer: QUANT_PUBKEY,
    proofHash: genHash(0.331),
    initSig: genTxSig(0.11),
    proofSig: genTxSig(0.12),
    disburseSig: genTxSig(0.13),
    createdAt: NOW - 1000 * 60 * 14,
    completedAt: NOW - 1000 * 60 * 12,
    inferenceMs: 184,
    model: "qwen2.5-7b-instruct",
    backend: "hailo8_npu",
    asset: "BTC",
  },
  {
    jobId: genHash(0.221),
    status: "Disbursed",
    amountLamports: 25_000_000,
    worker: ANALYST_PUBKEY,
    buyer: QUANT_PUBKEY,
    proofHash: genHash(0.554),
    initSig: genTxSig(0.21),
    proofSig: genTxSig(0.22),
    disburseSig: genTxSig(0.23),
    createdAt: NOW - 1000 * 60 * 38,
    completedAt: NOW - 1000 * 60 * 36,
    inferenceMs: 162,
    model: "qwen2.5-7b-instruct",
    backend: "hailo8_npu",
    asset: "ETH",
  },
  {
    jobId: genHash(0.708),
    status: "Proof Submitted",
    amountLamports: 25_000_000,
    worker: ANALYST_PUBKEY,
    buyer: QUANT_PUBKEY,
    proofHash: genHash(0.871),
    initSig: genTxSig(0.31),
    proofSig: genTxSig(0.32),
    disburseSig: null,
    createdAt: NOW - 1000 * 42,
    completedAt: null,
    inferenceMs: 211,
    model: "qwen2.5-7b-instruct",
    backend: "hailo8_npu",
    asset: "SOL",
  },
  {
    jobId: genHash(0.402),
    status: "Cancelled",
    amountLamports: 25_000_000,
    worker: ANALYST_PUBKEY,
    buyer: QUANT_PUBKEY,
    proofHash: null,
    initSig: genTxSig(0.41),
    proofSig: null,
    disburseSig: null,
    createdAt: NOW - 1000 * 60 * 92,
    completedAt: NOW - 1000 * 60 * 91,
    inferenceMs: null,
    model: "qwen2.5-7b-instruct",
    backend: "hailo8_npu",
    asset: "BTC",
    cancelReason: "Inference timeout (1500ms)",
  },
];

// ============================================================
// Sentiment / signal mock state
// ============================================================
const SEED_SENTIMENT = {
  BTC: { label: "positive", score: 0.847, confidence: 0.91, samples: 1240 },
  ETH: { label: "neutral",  score: 0.501, confidence: 0.62, samples: 980 },
  SOL: { label: "positive", score: 0.792, confidence: 0.88, samples: 1610 },
};

const SEED_SIGNAL = {
  decision: "SELL",
  confidence: 0.88,
  risk: "aggressive",
  rationale: "BTC sentiment elevated but volume divergence detected; SOL momentum overbought (RSI 78). Net portfolio reduction recommended.",
  generatedAt: NOW - 1000 * 28,
  positionDelta: -0.42,
};

const SEED_HEALTH = {
  status: "online",
  backend: "hailo8_npu",
  model: "qwen2.5-7b-instruct",
  npu: { temp_c: 47.2, util: 0.34, mem_mb: 3120, mem_total_mb: 8192 },
  uptime_s: 14_287,
  inference_p50_ms: 178,
  inference_p99_ms: 312,
  loaded: true,
};

const QUANT_STATS = {
  jobsInitiated: 248,
  totalSpentLamports: 6_200_000_000,
  model: "qwen2.5-3b-strategy",
  strategy: "momentum-rsi-divergence",
  status: "active",
  reputation: 0.94,
};

const ANALYST_STATS = {
  jobsCompleted: 246,
  totalEarnedLamports: 6_150_000_000,
  backend: "hailo8_npu",
  reputation: 0.97,
  uptime: 0.998,
  proofsValidated: 246,
  proofsRejected: 2,
};

window.NEXUS_DATA = {
  QUANT_PUBKEY, ANALYST_PUBKEY,
  SEED_JOBS, SEED_SENTIMENT, SEED_SIGNAL, SEED_HEALTH,
  QUANT_STATS, ANALYST_STATS,
};

window.NEXUS_UTIL = {
  lamportsToSol, fmtSol, truncatePubkey, truncateHash, timeAgo,
  genHash, genTxSig, explorerTx, explorerAddr,
};
