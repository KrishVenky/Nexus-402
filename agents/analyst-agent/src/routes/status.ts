import { Router, Request, Response } from "express";
import { jobStore } from "./analyze";
import { JobStatusResponse } from "../../../../shared-types";

export const statusRouter = Router();

statusRouter.get("/:jobId/status", (req: Request, res: Response) => {
  const { jobId } = req.params;
  const job = jobStore.get(jobId);

  if (!job) {
    res.status(404).json({ error: "Job not found", jobId });
    return;
  }

  const now = Date.now();
  const elapsedMs = job.startedAt ? now - job.startedAt : 0;

  const response: JobStatusResponse = {
    jobId,
    status:
      job.status === "awaiting_payment" ? "pending"
      : job.status === "processing" ? "processing"
      : job.status === "completed" ? "completed"
      : "error",
    progressPercent: job.status === "completed" ? 100 : Math.min(elapsedMs / 150, 95),
    estimatedRemainingMs:
      job.status === "processing" ? Math.max(0, 3000 - elapsedMs) : undefined,
    error: job.error,
  };

  res.json(response);
});
