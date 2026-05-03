use anchor_lang::prelude::*;

/// On-chain state of a job escrow PDA.
/// Seeds: [b"job", initiator.key().as_ref(), job_id.as_ref()]
#[account]
#[derive(InitSpace)]
pub struct Job {
    /// The agent that created and funded this job.
    pub initiator: Pubkey,
    /// The analyst agent designated to perform this job.
    pub worker: Pubkey,
    /// Unique 32-byte job identifier (UUID hash from off-chain).
    pub job_id: [u8; 32],
    /// Amount locked in this escrow (lamports).
    pub amount_lamports: u64,
    /// SHA-256 hash of the sentiment result JSON.
    /// Set by `post_proof`; verified by initiator before `disburse_funds`.
    pub proof_hash: [u8; 32],
    /// Current lifecycle state of the job.
    pub status: JobStatus,
    /// Unix timestamp after which the job can be cancelled.
    pub expires_at: i64,
    /// Unix timestamp when this account was created.
    pub created_at: i64,
    /// PDA bump seed.
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, InitSpace)]
pub enum JobStatus {
    /// Funds locked; awaiting worker proof submission.
    Initialized,
    /// Worker has submitted proof hash; awaiting initiator disbursement.
    ProofSubmitted,
    /// Funds released to worker; job complete.
    Disbursed,
    /// Initiator reclaimed funds after expiry.
    Cancelled,
}
