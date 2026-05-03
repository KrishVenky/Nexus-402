import { Router, Request, Response } from "express";
import { Keypair, PublicKey } from "@solana/web3.js";
import { createLogger } from "../../shared/logger";
import { X402_TIMEOUT_CONFIG, sleep } from "../../shared/timeout-config";
import { sha256Hex, constantTimeEqual } from "../../shared/crypto";
import { NexusAnchorClient } from "../../shared/anchor-client";
import { X402Callback } from "../../../../shared-types";

const log = createLogger("callbacks");
export const callbackRouter = Router();

// In-memory callback store (keyed by jobId)
const receivedCallbacks = new Map<string, X402Callback>();
export { receivedCallbacks };

// ── POST /api/v1/callbacks/job-complete ──────────────────────────────────────
callbackRouter.post("/job-complete", async (req: Request, res: Response) => {
  const wallet = (req as Request & { wallet: Keypair }).wallet;
  const callback = req.body as X402Callback;
  const { jobId, invoiceId, result, proofHash } = callback;

  if (!jobId || !result || !proofHash) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  log.info("Callback received", { jobId, proofHash: proofHash.slice(0, 16) });

  // ── Verify proof hash ────────────────────────────────────────────────────
  const computedHash = sha256Hex(JSON.stringify(result));
  if (!constantTimeEqual(computedHash, proofHash)) {
    log.error("Proof hash mismatch!", { jobId, expected: computedHash.slice(0, 16), got: proofHash.slice(0, 16) });
    res.status(422).json({ error: "Proof hash mismatch — result integrity check failed" });
    return;
  }

  log.info("Proof hash verified", { jobId });
  receivedCallbacks.set(jobId, callback);

  // ── Disburse funds ───────────────────────────────────────────────────────
  try {
    const analystEndpoint = process.env["ANALYST_AGENT_ENDPOINT"] ?? "http://localhost:3002";
    // Get worker pubkey from analyst health endpoint
    const { default: fetch } = await import("node-fetch");
    const healthRes = await fetch(`${analystEndpoint}/api/v1/health`, { signal: AbortSignal.timeout(5000) });
    const health = await healthRes.json() as { pubkey?: string };
    const workerPubkey = health.pubkey
      ? new PublicKey(health.pubkey)
      : PublicKey.default;

    // WHY: We need jobId as bytes32 — the hex was stored in the job store
    const jobIdHex = jobId; // jobId is already the hex string used during initialize_job
    const jobIdBytes = Array.from(Buffer.from(jobIdHex, "hex"));

    const client = new NexusAnchorClient(wallet);
    const disburseSig = await client.disburseFunds({ jobId: jobIdBytes }, workerPubkey);

    log.info("Funds disbursed", { disburseSig, jobId });

    res.json({
      status: "settled",
      jobId,
      disburseTxSignature: disburseSig,
      paymentAmountLamports: 500_000,
      reputationUpdated: true,
    });
  } catch (err) {
    log.error("Disburse failed", { error: String(err), jobId });
    res.status(500).json({ error: "Disburse failed — funds remain in escrow until expiry" });
  }
});
