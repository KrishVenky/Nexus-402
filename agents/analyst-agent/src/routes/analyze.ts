import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import type { AgentContext } from "../index";
import { createLogger } from "../../../shared/logger";
import { createConnection } from "../../../shared/solana-client";
import { sha256Hex } from "../../../shared/crypto";
import { X402_TIMEOUT_CONFIG } from "../../../shared/timeout-config";
import { runInference } from "../inference/finbert";
import {
  X402PaymentRequest,
  X402Response402,
  X402Response202,
  X402Invoice,
  X402Callback,
  SentimentResult,
} from "../../../../shared-types";

const log = createLogger("analyst-x402");

// In-memory job state (replace with Redis for multi-instance deploys)
type JobState = {
  invoiceId: string;
  jobId: string;
  status: "awaiting_payment" | "processing" | "completed" | "failed";
  result?: SentimentResult;
  proofHash?: string;
  startedAt?: number;
  completedAt?: number;
  error?: string;
};

const jobStore = new Map<string, JobState>();
const usedInvoiceIds = new Set<string>(); // Replay protection

export const analyzeRouter = Router();

// ── POST /api/v1/analyze — Phase 2: Return 402 invoice ───────────────────────
analyzeRouter.post("/analyze", async (req: Request, res: Response) => {
  const agentCtx = (req as Request & { agentCtx: AgentContext }).agentCtx;
  const body = req.body as X402PaymentRequest;
  const jobId = req.headers["x-job-id"] as string | undefined;
  const agentId = req.headers["x-agent-id"] as string | undefined;

  if (!jobId || !body.task || !body.payload?.symbols?.length) {
    res.status(400).json({ error: "Missing required fields: x-job-id header, task, payload.symbols" });
    return;
  }

  // Check thermal state via hardware check (lightweight re-read)
  const cpuTempPath = "/sys/class/thermal/thermal_zone0/temp";
  let cpuTemp: number | null = null;
  try {
    const fs = await import("fs");
    if (fs.existsSync(cpuTempPath)) {
      cpuTemp = parseInt(fs.readFileSync(cpuTempPath, "utf8").trim(), 10) / 1000;
    }
  } catch { /* not on Linux */ }

  if (cpuTemp !== null && cpuTemp >= X402_TIMEOUT_CONFIG.TEMP_CRITICAL_C) {
    log.warn("NPU_THERMAL_THROTTLE — rejecting job", { cpuTemp });
    res.status(503).json({
      error: "NPU_THERMAL_THROTTLE",
      message: `CPU temperature ${cpuTemp}°C exceeds safe operating limit. Retry in 60s.`,
      retryAfter: 60,
    });
    return;
  }

  const invoiceId = uuidv4();
  const expiresAt = Math.floor(Date.now() / 1000) + 300; // 5 min
  const amountLamports = 500_000; // 0.0005 SOL per job

  const programId = process.env["PROGRAM_ID"] ?? "Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS";
  const walletPubkey = agentCtx.wallet.publicKey.toBase58();

  const invoice: X402Invoice = {
    invoiceId,
    amountLamports,
    paymentDestination: walletPubkey,
    escrowRequired: true,
    escrowProgramId: programId,
    jobId,
    expiresAt,
    memo: `Nexus-402: sentiment ${body.payload.symbols.join("/")} ${body.payload.lookbackHours}h`,
  };

  // Store job in pending state
  jobStore.set(jobId, {
    invoiceId,
    jobId,
    status: "awaiting_payment",
  });

  log.info("402 issued", { invoiceId, jobId, agentId, symbols: body.payload.symbols });

  const response402: X402Response402 = {
    x402Version: "1.0",
    status: 402,
    invoice,
    acceptedPaymentMethods: [
      {
        type: "solana_escrow",
        network: (process.env["SOLANA_CLUSTER"] as "devnet" | "mainnet-beta") ?? "devnet",
        programId,
      },
    ],
  };

  res.status(402).json(response402);
});

// ── POST /api/v1/analyze/confirm — Phase 3: Verify escrow + start inference ──
analyzeRouter.post("/analyze/confirm", async (req: Request, res: Response) => {
  const { invoiceId, jobId, escrowTxSignature } = req.body as {
    invoiceId: string;
    jobId: string;
    escrowTxSignature: string;
    escrowPda: string;
    confirmedAt: number;
  };

  // Replay protection
  if (usedInvoiceIds.has(invoiceId)) {
    res.status(409).json({ error: "Invoice already used", invoiceId });
    return;
  }

  const job = jobStore.get(jobId);
  if (!job || job.invoiceId !== invoiceId) {
    res.status(404).json({ error: "Job or invoice not found" });
    return;
  }

  // Verify escrow transaction exists on-chain
  // WHY: Skip RPC lookup in mock mode — the tx signature is a fake string
  // and would fail Solana's base58 validation immediately.
  if (process.env["MOCK_ANCHOR"] !== "true") {
    try {
      const conn = createConnection();
      const txInfo = await conn.getTransaction(escrowTxSignature, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });
      if (!txInfo || txInfo.meta?.err) {
        res.status(402).json({ error: "Escrow transaction not confirmed on-chain" });
        return;
      }
    } catch (err) {
      log.error("RPC verification failed", { error: String(err) });
      res.status(500).json({ error: "Failed to verify escrow on-chain" });
      return;
    }
  }

  usedInvoiceIds.add(invoiceId);
  job.status = "processing";
  job.startedAt = Date.now();

  // Estimate completion time (thermal-aware)
  const baseEstimateMs = 3_000;
  const estimatedMs = cpuTempAbove75() ? baseEstimateMs * 1.5 : baseEstimateMs;

  const response202: X402Response202 = {
    status: "processing",
    jobId,
    estimatedCompletionMs: estimatedMs,
    trackingUrl: `/api/v1/jobs/${jobId}/status`,
  };

  res.status(202).json(response202);
  log.info("Inference started", { jobId, estimatedMs });

  // Run inference asynchronously — do NOT await here
  runInferenceAsync(job, req.body as { invoiceId: string; jobId: string });
});

async function runInferenceAsync(
  job: JobState,
  _confirm: { invoiceId: string; jobId: string }
): Promise<void> {
  try {
    const result = await runInference({
      symbols: ["BTC", "ETH", "SOL"], // In production: parse from original request
      lookbackHours: 24,
      source: "all",
    });

    const proofHash = sha256Hex(JSON.stringify(result));
    job.result = result;
    job.proofHash = proofHash;
    job.status = "completed";
    job.completedAt = Date.now();

    log.info("Inference complete", { jobId: job.jobId, proofHash: proofHash.slice(0, 16) });

    // Deliver callback to Quant Agent
    await deliverCallback(job);
  } catch (err) {
    job.status = "failed";
    job.error = String(err);
    log.error("Inference failed", { jobId: job.jobId, error: String(err) });
  }
}

async function deliverCallback(job: JobState): Promise<void> {
  if (!job.result || !job.proofHash) return;

  const quantEndpoint = process.env["QUANT_AGENT_ENDPOINT"] ?? "http://localhost:3001";
  const callback: X402Callback = {
    jobId: job.jobId,
    invoiceId: job.invoiceId,
    result: job.result,
    proofHash: job.proofHash,
    completedAt: job.completedAt ?? Date.now(),
  };

  try {
    const { default: fetch } = await import("node-fetch");
    const res = await fetch(`${quantEndpoint}/api/v1/callbacks/job-complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(callback),
      signal: AbortSignal.timeout(X402_TIMEOUT_CONFIG.CALLBACK_DELIVERY_TIMEOUT_MS),
    });
    if (!res.ok) {
      log.warn("Callback delivery failed", { status: res.status, jobId: job.jobId });
    } else {
      log.info("Callback delivered", { jobId: job.jobId });
    }
  } catch (err) {
    log.error("Callback delivery error", { error: String(err), jobId: job.jobId });
  }
}

const cpuTempAbove75 = (): boolean => {
  try {
    const fs = require("fs") as typeof import("fs");
    const path = "/sys/class/thermal/thermal_zone0/temp";
    if (!fs.existsSync(path)) return false;
    const raw = parseInt(fs.readFileSync(path, "utf8").trim(), 10) / 1000;
    return raw > X402_TIMEOUT_CONFIG.TEMP_HOT_C;
  } catch {
    return false;
  }
};

// Export jobStore for status route
export { jobStore };
