use anchor_lang::prelude::*;

/// Sybil-resistant analyst profile.
/// Seeds: [b"analyst", owner.key().as_ref()]
///
/// WHY stake: Prevents trivial Sybil attacks where bad actors create infinite
/// analyst wallets. The 0.01 SOL stake is slashable in future versions.
#[account]
#[derive(InitSpace)]
pub struct AnalystProfile {
    /// Wallet that owns this profile.
    pub owner: Pubkey,
    /// Locked SOL stake (must be >= MIN_ANALYST_STAKE = 10_000_000 lamports).
    pub stake_amount: u64,
    /// Total jobs completed successfully.
    pub jobs_completed: u64,
    /// Total jobs the worker was assigned to (including cancellations).
    pub jobs_attempted: u64,
    /// Score in basis points (0–10_000). Updated after each disburse_funds.
    /// Formula: (jobs_completed * 10_000) / max(jobs_attempted, 1)
    pub reputation_score: u64,
    /// Optional Metaplex Core NFT address for on-chain identity.
    /// Set via a separate update instruction (not gated on hackathon scope).
    pub reputation_nft: Option<Pubkey>,
    /// Unix timestamp of profile creation.
    pub registered_at: i64,
    /// PDA bump seed.
    pub bump: u8,
}

impl AnalystProfile {
    /// Minimum stake to register as an analyst (0.01 SOL).
    pub const MIN_STAKE: u64 = 10_000_000;

    /// Recompute reputation score after a job outcome.
    /// Uses saturating arithmetic to prevent overflow.
    pub fn update_reputation(&mut self, job_succeeded: bool) {
        self.jobs_attempted = self.jobs_attempted.saturating_add(1);
        if job_succeeded {
            self.jobs_completed = self.jobs_completed.saturating_add(1);
        }
        // Score = (completed / attempted) * 10_000
        self.reputation_score = self
            .jobs_completed
            .saturating_mul(10_000)
            .checked_div(self.jobs_attempted)
            .unwrap_or(0);
    }
}
