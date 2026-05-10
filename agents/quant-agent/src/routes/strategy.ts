import { Router, Request, Response } from "express";
import { Keypair, PublicKey } from "@solana/web3.js";
import { createLogger } from "../../../shared/logger";
import { executeX402Job } from "../x402/client";
import { generateTradingSignal } from "../llm/llm-client";
import { receivedCallbacks, settlementStore } from "./callbacks";
import { X402PaymentRequest } from "../../../../shared-types";

const log = createLogger("strategy");
export const strategyRouter = Router();

let lastSignal: Record<string, unknown> | null = null;
type StrategyRun = {
  jobId: string;
  status: "started" | "completed" | "failed";
  symbols: string[];
  lookbackHours: number;
  startedAt: number;
  completedAt?: number;
  error?: string;
};

const strategyRuns = new Map<string, StrategyRun>();

// ── GET /api/v1/strategy/status ──────────────────────────────────────────────
strategyRouter.get("/status", (_req: Request, res: Response) => {
  const runs = Array.from(strategyRuns.values()).sort((a, b) => b.startedAt - a.startedAt);
  const callbacks = Array.from(receivedCallbacks.values()).map((callback) => ({
    ...callback,
    settlement: settlementStore.get(callback.jobId) ?? null,
  }));

  res.json({
    ok: true,
    lastSignal,
    pendingJobs: runs.filter((run) => run.status === "started").length,
    runs,
    callbacks,
  });
});

// ── POST /api/v1/strategy/trigger — Kick off full A2A cycle ─────────────────
strategyRouter.post("/trigger", async (req: Request, res: Response) => {
  const wallet = (req as Request & { wallet: Keypair }).wallet;
  const { symbols = ["BTC", "ETH", "SOL"], lookbackHours = 24 } = req.body as {
    symbols?: string[];
    lookbackHours?: number;
  };

  log.info("Strategy trigger", { symbols, lookbackHours });
  res.json({ status: "started", symbols, lookbackHours });

  // ── Run async — don't hold the HTTP connection ────────────────────────────
  runStrategyAsync(wallet, symbols, lookbackHours).catch((err: Error) => {
    log.error("Strategy cycle failed", { error: err.message });
  });
});

async function runStrategyAsync(
  wallet: Keypair,
  symbols: string[],
  lookbackHours: number
): Promise<void> {
  const analystEndpoint = process.env["ANALYST_AGENT_ENDPOINT"] ?? "http://localhost:3002";
  const workerPubkeyStr = process.env["ANALYST_WALLET_PUBKEY"];

  if (!workerPubkeyStr) {
    log.error("ANALYST_WALLET_PUBKEY not set — cannot execute job");
    return;
  }

  const workerPubkey = new PublicKey(workerPubkeyStr);

  const request: X402PaymentRequest = {
    task: "sentiment_analysis",
    payload: { symbols, lookbackHours, source: "all", aggregation: "weighted_mean" },
    sla: { maxLatencyMs: 30_000, minConfidence: 0.75 },
  };

  const jobResult = await executeX402Job(wallet, analystEndpoint, request, workerPubkey);
  strategyRuns.set(jobResult.jobId, {
    jobId: jobResult.jobId,
    status: jobResult.success ? "completed" : "failed",
    symbols,
    lookbackHours,
    startedAt: Date.now(),
    completedAt: Date.now(),
    error: jobResult.success ? undefined : jobResult.error,
  });

  if (!jobResult.success) {
    log.error("x402 job failed", { reason: jobResult.reason, error: jobResult.error });
    return;
  }

  // Wait for callback to arrive (it's set by callbacks route)
  const MAX_WAIT = 30_000;
  const POLL_MS = 500;
  let waited = 0;
  let callback = receivedCallbacks.get(jobResult.jobId);
  while (!callback && waited < MAX_WAIT) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    waited += POLL_MS;
    callback = receivedCallbacks.get(jobResult.jobId);
  }

  if (!callback) {
    log.warn("Callback never received within timeout", { jobId: jobResult.jobId });
    return;
  }

  // ── Generate trading signal from sentiment ──────────────────────────────
  const signal = await generateTradingSignal(callback.result);
  lastSignal = { ...signal, jobId: jobResult.jobId, timestamp: new Date().toISOString() };
  log.info("Trading signal generated", lastSignal);
}
