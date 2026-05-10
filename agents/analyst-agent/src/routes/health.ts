import { Router, Request, Response } from "express";
import * as os from "os";
import * as fs from "fs";
import { AgentContext } from "../index";
import { HealthResponse } from "../../../../shared-types";

export const healthRouter = (ctx: AgentContext): Router => {
  const router = Router();

  router.get("/health", (_req: Request, res: Response) => {
    let cpuTempC: number | null = null;
    try {
      if (fs.existsSync("/sys/class/thermal/thermal_zone0/temp")) {
        cpuTempC = parseInt(fs.readFileSync("/sys/class/thermal/thermal_zone0/temp", "utf8").trim(), 10) / 1000;
      }
    } catch { /* non-Linux */ }

    const freeMb = Math.round(os.freemem() / 1024 / 1024);

    // Use INFERENCE_BACKEND env var as the authoritative backend label —
    // hardware check returns "mock" on non-Linux even when hf_api is configured
    const inferenceBackend = (process.env["INFERENCE_BACKEND"] ?? ctx.inferenceBackend) as HealthResponse["inferenceBackend"];

    const health: HealthResponse = {
      ok: true,
      pubkey: ctx.wallet.publicKey.toBase58(),
      npuAvailable: ctx.inferenceBackend === "hailo8_npu",
      cpuTempC,
      npuTempC: null,
      inferenceBackend,
      memoryFreeMb: freeMb,
      uptimeSeconds: Math.round((Date.now() - ctx.startedAt) / 1000),
    };

    res.json(health);
  });

  return router;
};
