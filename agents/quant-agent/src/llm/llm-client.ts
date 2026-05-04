/**
 * llm-client.ts — Quant Agent LLM Integration
 * 
 * Supports:
 * - Local Ollama (provider: 'ollama')
 * - Ollama Cloud (provider: 'ollama-cloud')
 * - OpenAI / Groq (provider: 'openai')
 */

import { createLogger } from "../../../shared/logger";
import { SentimentResult } from "../../../../shared-types";

const log = createLogger("llm-client");

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
  const provider = process.env["LLM_PROVIDER"]?.toLowerCase() ?? "ollama";
  
  switch (provider) {
    case "openai":
      return generateWithOpenAI(sentiment);
    case "ollama-cloud":
      return generateWithOllama(sentiment, true);
    case "ollama":
    default:
      return generateWithOllama(sentiment, false);
  }
};

async function generateWithOpenAI(sentiment: SentimentResult): Promise<TradingSignal> {
  const apiKey = process.env["OPENAI_API_KEY"];
  const model = process.env["OPENAI_MODEL"] ?? "gpt-4o-mini";
  const baseUrl = process.env["OPENAI_BASE_URL"] ?? "https://api.openai.com/v1";

  if (!apiKey || apiKey.includes("replace-this")) {
    log.warn("OpenAI API key missing — using fallback");
    return buildFallbackSignal(sentiment);
  }

  const prompt = buildPrompt(sentiment);

  try {
    const { default: fetch } = await import("node-fetch");
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.2
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) throw new Error(`OpenAI error: ${res.status}`);
    const body = await res.json() as any;
    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new Error("Empty response");
    return JSON.parse(content) as TradingSignal;
  } catch (err) {
    log.warn("OpenAI failed", { error: String(err) });
    return buildFallbackSignal(sentiment);
  }
}

async function generateWithOllama(sentiment: SentimentResult, isCloud: boolean): Promise<TradingSignal> {
  const baseUrl = isCloud 
    ? (process.env["OLLAMA_CLOUD_BASE_URL"] ?? "https://ollama.com/api")
    : (process.env["OLLAMA_BASE_URL"] ?? "http://localhost:11434");
    
  const model = process.env["OLLAMA_MODEL"] ?? "llama3.2";
  const apiKey = process.env["OLLAMA_CLOUD_API_KEY"];

  const prompt = buildPrompt(sentiment);

  try {
    const { default: fetch } = await import("node-fetch");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (isCloud && apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const res = await fetch(`${baseUrl}/generate`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        prompt: `${SYSTEM_PROMPT}\n\n${prompt}`,
        stream: false,
        format: "json",
        options: { temperature: 0.2 },
      }),
      signal: AbortSignal.timeout(45_000), // Cloud might be slower on free tier
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Ollama ${isCloud ? 'Cloud' : 'Local'} error: ${res.status} ${text}`);
    }

    const body = await res.json() as { response?: string; error?: string };
    if (body.error) throw new Error(body.error);
    if (!body.response) throw new Error("Empty response");

    const signal = JSON.parse(body.response) as TradingSignal;
    log.info(`Ollama ${isCloud ? 'Cloud' : 'Local'} signal generated`, { action: signal.action });
    return signal;
  } catch (err) {
    log.warn(`Ollama ${isCloud ? 'Cloud' : 'Local'} failed`, { error: String(err) });
    return buildFallbackSignal(sentiment);
  }
}

const buildFallbackSignal = (sentiment: SentimentResult): TradingSignal => {
  // ... (same as before)
  const agg = sentiment.aggregateSentiment;
  const strength = sentiment.signalStrength;
  const action: TradingSignal["action"] = agg === "positive" ? "buy" : agg === "negative" ? "sell" : "hold";
  const confidence: TradingSignal["confidence"] = strength === "strong" ? "high" : strength === "moderate" ? "medium" : "low";
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
    reasoning: "Rule-based fallback (LLM unavailable).",
    suggestedPositions: positions,
    riskLevel: strength === "strong" ? "aggressive" : "moderate",
  };
};
