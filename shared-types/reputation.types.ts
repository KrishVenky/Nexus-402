// ─── Reputation & Metaplex Agent Types ───────────────────────────────────────
// Metaplex Core NFT (014 registry) for on-chain agent identity + reputation

export type AgentType = "quant" | "analyst" | "hybrid";

export type MetaplexAgentMetadata = {
  name: string;                     // e.g. "Nexus Analyst Agent #1"
  description: string;
  image: string;                    // URI to agent avatar
  externalUrl?: string;
  attributes: AgentAttribute[];
  properties: {
    category: "agent";
    agentType: AgentType;
    createdAt: string;              // ISO 8601
  };
};

export type AgentAttribute = {
  traitType: string;
  value: string | number;
};

// Standard attribute trait types for Nexus-402 agents
export type NexusAgentTraits = {
  agent_type: AgentType;
  jobs_completed: number;
  jobs_attempted: number;
  reputation_score: number;         // 0–10000
  reputation_tier: ReputationTier;
  stake_sol: number;                // locked SOL stake
  inference_backend: string;        // "hailo8_npu" | "onnx_cpu" | "mock"
  model_version: string;            // e.g. "finbert-1.0"
  last_job_completed: string | null; // ISO 8601
  registered_at: string;            // ISO 8601
};

export type ReputationTier = "bronze" | "silver" | "gold" | "platinum" | "legendary";

export const REPUTATION_TIERS: Record<ReputationTier, { min: number; max: number }> = {
  bronze:    { min: 0,    max: 2499 },
  silver:    { min: 2500, max: 4999 },
  gold:      { min: 5000, max: 7499 },
  platinum:  { min: 7500, max: 9499 },
  legendary: { min: 9500, max: 10000 },
};

export const getReputationTier = (score: number): ReputationTier => {
  if (score >= 9500) return "legendary";
  if (score >= 7500) return "platinum";
  if (score >= 5000) return "gold";
  if (score >= 2500) return "silver";
  return "bronze";
};

export const buildAgentAttributes = (traits: NexusAgentTraits): AgentAttribute[] => [
  { traitType: "Agent Type",        value: traits.agent_type },
  { traitType: "Jobs Completed",    value: traits.jobs_completed },
  { traitType: "Jobs Attempted",    value: traits.jobs_attempted },
  { traitType: "Reputation Score",  value: traits.reputation_score },
  { traitType: "Reputation Tier",   value: traits.reputation_tier },
  { traitType: "Stake (SOL)",       value: traits.stake_sol },
  { traitType: "Inference Backend", value: traits.inference_backend },
  { traitType: "Model Version",     value: traits.model_version },
  { traitType: "Last Job",          value: traits.last_job_completed ?? "never" },
  { traitType: "Registered At",     value: traits.registered_at },
];

// Registry entry returned by Metaplex 014 lookups
export type AgentRegistryEntry = {
  nftAddress: string;              // Core NFT pubkey (base58)
  walletAddress: string;           // Agent wallet pubkey
  metadata: MetaplexAgentMetadata;
  traits: NexusAgentTraits;
  onChainUri: string;              // Metaplex metadata URI
};
