"use client";

import { useEffect, useState, useCallback } from "react";
import styles from "./page.module.css";

// ── Types ──────────────────────────────────────────────────────────────────

type SentimentScore = { label: "positive"|"negative"|"neutral"; score: number; confidence: number };
type SentimentResult = { scores: Record<string, SentimentScore>; aggregateSentiment: string; signalStrength: string; sourceCount: number; inferenceMs?: number };
type JobStatus = "pending"|"processing"|"completed"|"disbursed"|"cancelled"|"error";
type Job = { jobId: string; status: JobStatus; createdAt: string; amountLamports: number; result?: SentimentResult; disburseTxSig?: string };
type AgentHealth = { ok: boolean; npuAvailable: boolean; cpuTempC: number|null; inferenceBackend: string; memoryFreeMb: number };
type TradingSignal = { action: "buy"|"sell"|"hold"; confidence: string; reasoning: string; riskLevel: string } | null;

const QUANT_URL  = process.env["NEXT_PUBLIC_QUANT_ENDPOINT"]   ?? "http://localhost:3001";
const ANALYST_URL = process.env["NEXT_PUBLIC_ANALYST_ENDPOINT"] ?? "http://localhost:3002";

// ── Helpers ────────────────────────────────────────────────────────────────

const usePoll = <T,>(fetcher: () => Promise<T>, intervalMs = 2000) => {
  const [data, setData] = useState<T | null>(null);
  const fetch_ = useCallback(async () => { try { setData(await fetcher()); } catch { /* ignore */ } }, [fetcher]);
  useEffect(() => { void fetch_(); const t = setInterval(() => void fetch_(), intervalMs); return () => clearInterval(t); }, [fetch_, intervalMs]);
  return data;
};

const sentimentColor = (label: string) =>
  label === "positive" ? "var(--accent-green)" : label === "negative" ? "var(--accent-red)" : "var(--accent-yellow)";

const actionColor = (action: string) =>
  action === "buy" ? "var(--accent-green)" : action === "sell" ? "var(--accent-red)" : "var(--accent-yellow)";

const lamportsToSol = (l: number) => (l / 1e9).toFixed(6);

// ── Mock data for laptop dev (real data when agents are running) ───────────

const MOCK_JOBS: Job[] = [
  { jobId: "abc123def456", status: "disbursed", createdAt: new Date(Date.now()-120000).toISOString(), amountLamports: 500000, result: { scores: { BTC: { label:"positive", score:0.847, confidence:0.923 }, ETH: { label:"neutral", score:0.501, confidence:0.881 }, SOL: { label:"positive", score:0.792, confidence:0.912 } }, aggregateSentiment:"positive", signalStrength:"strong", sourceCount:1423, inferenceMs:1247 }, disburseTxSig:"5x9Kd2..." },
  { jobId: "789xyz001", status: "processing", createdAt: new Date(Date.now()-15000).toISOString(), amountLamports: 500000 },
];

// ── Page ───────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [jobs, setJobs] = useState<Job[]>(MOCK_JOBS);
  const [triggering, setTriggering] = useState(false);
  const [lastSignal, setLastSignal] = useState<TradingSignal>(null);
  const [analystHealth, setAnalystHealth] = useState<AgentHealth | null>(null);

  // Poll analyst health
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`${ANALYST_URL}/api/v1/health`);
        if (res.ok) setAnalystHealth(await res.json() as AgentHealth);
      } catch { /* agent not running yet */ }
    };
    void poll();
    const t = setInterval(() => void poll(), 3000);
    return () => clearInterval(t);
  }, []);

  // Poll strategy signal
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(`${QUANT_URL}/api/v1/strategy/status`);
        if (res.ok) { const d = await res.json() as { lastSignal: TradingSignal }; setLastSignal(d.lastSignal); }
      } catch { /* agent not running yet */ }
    };
    void poll();
    const t = setInterval(() => void poll(), 2000);
    return () => clearInterval(t);
  }, []);

  const triggerJob = async () => {
    setTriggering(true);
    try {
      await fetch(`${QUANT_URL}/api/v1/strategy/trigger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbols: ["BTC", "ETH", "SOL"], lookbackHours: 24 }),
      });
    } catch { /* agent not running */ }
    setTimeout(() => setTriggering(false), 3000);
  };

  const latestJob = jobs[0];
  const completedJobs = jobs.filter(j => j.status === "disbursed");

  return (
    <div>
      {/* ── Nav ── */}
      <nav className="nav">
        <div className="nav-inner">
          <span className="nav-logo">⚡ Nexus-402</span>
          <div className="flex-row" style={{ gap: "1rem" }}>
            <span style={{ fontSize:"0.75rem", color:"var(--text-muted)" }}>Solana Frontier 2026</span>
            <span className="badge badge-initialized">devnet</span>
          </div>
        </div>
      </nav>

      <main className="container" style={{ padding:"2rem 1.5rem" }}>

        {/* ── Header ── */}
        <div style={{ marginBottom:"2rem", position:"relative" }}>
          <h1 style={{ marginBottom:"0.5rem" }}>Agent Labor Market</h1>
          <p style={{ color:"var(--text-secondary)", maxWidth:"600px" }}>
            Quant Agent hires Sentiment Analyst Agent via x402 HTTP payment protocol.
            Funds locked in Anchor escrow until proof is verified.
          </p>
        </div>

        {/* ── Stats Row ── */}
        <div className="grid-3" style={{ marginBottom:"2rem" }}>
          <div className="card">
            <p style={{ fontSize:"0.75rem", color:"var(--text-muted)", marginBottom:"0.5rem" }}>TOTAL JOBS</p>
            <div className="stat-num">{jobs.length}</div>
            <p style={{ fontSize:"0.75rem", marginTop:"0.25rem" }}>{completedJobs.length} completed</p>
          </div>
          <div className="card">
            <p style={{ fontSize:"0.75rem", color:"var(--text-muted)", marginBottom:"0.5rem" }}>TOTAL DISBURSED</p>
            <div className="stat-num">{lamportsToSol(completedJobs.reduce((s,j) => s+j.amountLamports, 0))}</div>
            <p style={{ fontSize:"0.75rem", marginTop:"0.25rem" }}>SOL</p>
          </div>
          <div className="card">
            <p style={{ fontSize:"0.75rem", color:"var(--text-muted)", marginBottom:"0.5rem" }}>ANALYST STATUS</p>
            <div className="flex-row" style={{ marginTop:"0.25rem" }}>
              <span className={`badge ${analystHealth?.ok ? "badge-disbursed" : "badge-cancelled"}`}>
                <span className="pulse"></span>
                {analystHealth?.ok ? analystHealth.inferenceBackend : "offline"}
              </span>
              {analystHealth?.cpuTempC && (
                <span style={{ fontSize:"0.75rem", color:"var(--text-muted)" }}>{analystHealth.cpuTempC.toFixed(1)}°C</span>
              )}
            </div>
          </div>
        </div>

        <div className="grid-2" style={{ marginBottom:"2rem" }}>

          {/* ── Trigger Job ── */}
          <div className="card">
            <div className="flex-between" style={{ marginBottom:"1rem" }}>
              <h2>Run Analysis Cycle</h2>
              <button className="btn btn-primary" onClick={() => void triggerJob()} disabled={triggering}>
                {triggering ? "⏳ Running..." : "▶ Trigger Job"}
              </button>
            </div>
            <p style={{ fontSize:"0.875rem", marginBottom:"1rem" }}>
              Quant Agent will request sentiment analysis for BTC/ETH/SOL,
              negotiate via x402, lock funds in escrow, and disburse on verified proof.
            </p>
            <div style={{ background:"var(--bg-surface)", borderRadius:"0.5rem", padding:"0.75rem", fontSize:"0.8125rem" }}>
              <div className="flex-between" style={{ marginBottom:"0.375rem" }}>
                <span style={{ color:"var(--text-muted)" }}>Symbols</span>
                <span className="mono">BTC / ETH / SOL</span>
              </div>
              <div className="flex-between" style={{ marginBottom:"0.375rem" }}>
                <span style={{ color:"var(--text-muted)" }}>Lookback</span>
                <span className="mono">24h</span>
              </div>
              <div className="flex-between">
                <span style={{ color:"var(--text-muted)" }}>Payment</span>
                <span className="mono" style={{ color:"var(--accent-blue)" }}>0.0005 SOL</span>
              </div>
            </div>
          </div>

          {/* ── Trading Signal ── */}
          <div className="card">
            <h2 style={{ marginBottom:"1rem" }}>Trading Signal</h2>
            {lastSignal ? (
              <div>
                <div className="flex-row" style={{ marginBottom:"1rem" }}>
                  <span style={{ fontSize:"2rem", fontWeight:"700", color: actionColor(lastSignal.action) }}>
                    {lastSignal.action.toUpperCase()}
                  </span>
                  <span className="badge badge-processing">{lastSignal.confidence} confidence</span>
                  <span className="badge badge-initialized">{lastSignal.riskLevel}</span>
                </div>
                <p style={{ fontSize:"0.875rem", color:"var(--text-secondary)", marginBottom:"0.75rem" }}>
                  {lastSignal.reasoning}
                </p>
              </div>
            ) : (
              <div style={{ textAlign:"center", padding:"2rem 0", color:"var(--text-muted)" }}>
                <p style={{ marginBottom:"0.5rem" }}>No signal yet</p>
                <p style={{ fontSize:"0.8125rem" }}>Trigger a job to generate the first signal</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Latest Job Detail ── */}
        {latestJob?.result && (
          <div className="card" style={{ marginBottom:"2rem" }}>
            <div className="flex-between" style={{ marginBottom:"1.25rem" }}>
              <h2>Latest Sentiment Results</h2>
              <div className="flex-row">
                <span className={`badge badge-${latestJob.status === "disbursed" ? "disbursed" : "processing"}`}>
                  <span className="pulse"></span>{latestJob.status}
                </span>
                {latestJob.result.inferenceMs && (
                  <span style={{ fontSize:"0.75rem", color:"var(--text-muted)" }}>
                    {latestJob.result.inferenceMs}ms inference
                  </span>
                )}
              </div>
            </div>
            <div className="grid-3">
              {Object.entries(latestJob.result.scores).map(([sym, score]) => (
                <div key={sym} style={{ background:"var(--bg-surface)", borderRadius:"0.5rem", padding:"1rem" }}>
                  <div className="flex-between" style={{ marginBottom:"0.75rem" }}>
                    <span style={{ fontWeight:"600" }}>{sym}</span>
                    <span style={{ fontSize:"0.75rem", color: sentimentColor(score.label), fontWeight:"500" }}>
                      {score.label}
                    </span>
                  </div>
                  <div className="sentiment-bar" style={{ marginBottom:"0.5rem" }}>
                    <div
                      className={`sentiment-bar-fill fill-${score.label}`}
                      style={{ width:`${score.score * 100}%` }}
                    />
                  </div>
                  <div className="flex-between" style={{ fontSize:"0.75rem", color:"var(--text-muted)" }}>
                    <span>Score: {(score.score * 100).toFixed(1)}%</span>
                    <span>Conf: {(score.confidence * 100).toFixed(1)}%</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop:"1rem", fontSize:"0.8125rem", color:"var(--text-muted)", display:"flex", gap:"1.5rem" }}>
              <span>Aggregate: <strong style={{ color: sentimentColor(latestJob.result.aggregateSentiment) }}>{latestJob.result.aggregateSentiment}</strong></span>
              <span>Signal: <strong style={{ color:"var(--text-primary)" }}>{latestJob.result.signalStrength}</strong></span>
              <span>Sources: <strong style={{ color:"var(--text-primary)" }}>{latestJob.result.sourceCount.toLocaleString()}</strong></span>
            </div>
          </div>
        )}

        {/* ── Job History ── */}
        <div className="card">
          <h2 style={{ marginBottom:"1.25rem" }}>Job History</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Job ID</th>
                <th>Status</th>
                <th>Amount</th>
                <th>Created</th>
                <th>Disburse Tx</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map(job => (
                <tr key={job.jobId}>
                  <td><span className="mono">{job.jobId.slice(0,12)}...</span></td>
                  <td>
                    <span className={`badge badge-${job.status === "disbursed" ? "disbursed" : job.status === "processing" ? "processing" : job.status === "cancelled" ? "cancelled" : "initialized"}`}>
                      <span className="pulse"></span>{job.status}
                    </span>
                  </td>
                  <td className="mono">{lamportsToSol(job.amountLamports)} SOL</td>
                  <td style={{ fontSize:"0.8125rem" }}>{new Date(job.createdAt).toLocaleTimeString()}</td>
                  <td>
                    {job.disburseTxSig ? (
                      <a href={`https://explorer.solana.com/tx/${job.disburseTxSig}?cluster=devnet`}
                         target="_blank" rel="noreferrer"
                         style={{ color:"var(--accent-blue)", fontSize:"0.8125rem" }}>
                        <span className="mono">{job.disburseTxSig.slice(0,8)}...</span> ↗
                      </a>
                    ) : (
                      <span style={{ color:"var(--text-muted)", fontSize:"0.8125rem" }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
