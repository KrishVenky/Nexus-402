/**
 * ollama-client.ts — Quant Agent LLM Integration
 *
 * Uses local Ollama to generate structured trading signals from FinBERT sentiment scores.
 * Model: llama3.2 (default) — configurable via OLLAMA_MODEL env var.
 *
 * WHY local Ollama: No API cost, no latency to cloud, runs on same laptop as agents.
 * The LLM is used for *strategy reasoning*, not raw inference — it takes structured
 * numerical sentiment scores and explains them in terms a trader would act on.
 */

import { createLogger } from "../../../shared/logger";
import { SentimentResult } from "../../../../shared-types";

const log = createLogger("ollama");

export type TradingSignal = {
  action: "buy" | "sell" | "hold";
  confidence: "high" | "medium" | "low";
  reasoning: string;
  suggestedPositions: Record<string, { direction: "long" | "short" | "flat"; weight: number }>;
  riskLevel: "aggressive" | "moderate" | "conservative";
};

const SYSTEM_PROMPT = `You are a quantitative trading AI. You receive structured sentiment analysis results 
from a FinBERT model that analyzed social media and news for crypto assets.

Given the sentiment scores, generate a structured trading signal with:
1. Overall market action: buy/sell/hold
2. Confidence level
3. Brief reasoning (2-3 sentences max)
4. Position suggestions per asset (long/short/flat with weight 0.0-1.0)
5. Risk level

Always respond with valid JSON only. No prose outside JSON.`;

const buildPrompt = (sentiment: SentimentResult): string => {
  const scoreStr = Object.entries(sentiment.scores)
    .map(([sym, s]) => `${sym}: ${s.label} (score=${s.score.toFixed(3)}, conf=${s.confidence.toFixed(3)})`)
    .join("\n");

  return `Sentiment analysis results:
${scoreStr}
Aggregate: ${sentiment.aggregateSentiment} (signal strength: ${sentiment.signalStrength})
Sources analyzed: ${sentiment.sourceCount}

Generate a trading signal JSON:`;
};

export const generateTradingSignal = async (
  sentiment: SentimentResult
): Promise<TradingSignal> => {
  const baseUrl = process.env["OLLAMA_BASE_URL"] ?? "http://localhost:11434";
  const model = process.env["OLLAMA_MODEL"] ?? "llama3.2";

  const prompt = buildPrompt(sentiment);

  try {
    const { default: fetch } = await import("node-fetch");
    const res = await fetch(`${baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt: `${SYSTEM_PROMPT}\n\n${prompt}`,
        stream: false,
        format: "json",
        options: { temperature: 0.2, top_p: 0.9 }, // Low temp for consistent signals
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      throw new Error(`Ollama returned ${res.status}`);
    }

    const body = await res.json() as { response?: string; error?: string };

    if (body.error) throw new Error(body.error);
    if (!body.response) throw new Error("Empty response from Ollama");

    const signal = JSON.parse(body.response) as TradingSignal;
    log.info("Ollama signal generated", { action: signal.action, confidence: signal.confidence });
    return signal;
  } catch (err) {
    log.warn("Ollama unavailable — using fallback signal", { error: String(err) });
    return buildFallbackSignal(sentiment);
  }
};

/**
 * Rule-based fallback signal when Ollama is unavailable.
 * WHY: Demo must work even if Ollama isn't running. Fallback uses the same
 * deterministic logic a basic quant would use without LLM.
 */
const buildFallbackSignal = (sentiment: SentimentResult): TradingSignal => {
  const agg = sentiment.aggregateSentiment;
  const strength = sentiment.signalStrength;

  const action: TradingSignal["action"] =
    agg === "positive" ? "buy" : agg === "negative" ? "sell" : "hold";

  const confidence: TradingSignal["confidence"] =
    strength === "strong" ? "high" : strength === "moderate" ? "medium" : "low";

  const positions: TradingSignal["suggestedPositions"] = {};
  for (const [symbol, score] of Object.entries(sentiment.scores)) {
    positions[symbol] = {
      direction: score.label === "positive" ? "long" : score.label === "negative" ? "short" : "flat",
      weight: score.confidence,
    };
  }

  return {
    action,
    confidence,
    reasoning: `Aggregate sentiment is ${agg} with ${strength} signal strength across ${sentiment.sourceCount} sources. Fallback rule-based signal (Ollama unavailable).`,
    suggestedPositions: positions,
    riskLevel: strength === "strong" ? "aggressive" : "moderate",
  };
};
