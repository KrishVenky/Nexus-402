use anchor_lang::error_code;

#[error_code]
pub enum NexusEscrowError {
    // ─ Profile errors ────────────────────────────────────────────────────────
    #[msg("Stake amount is below the required minimum of 0.01 SOL")]
    InsufficientStake,

    #[msg("An analyst profile already exists for this wallet")]
    ProfileAlreadyExists,

    // ─ Job errors ────────────────────────────────────────────────────────────
    #[msg("Job payment amount is below the minimum (1000 lamports)")]
    JobAmountTooLow,

    #[msg("The worker does not have a registered analyst profile")]
    WorkerProfileNotFound,

    #[msg("The job has expired and can no longer accept proof submissions")]
    JobExpired,

    #[msg("The job has not yet expired and cannot be cancelled")]
    JobNotExpired,

    #[msg("Invalid job status for this instruction")]
    InvalidJobStatus,

    #[msg("Only the job initiator may perform this action")]
    Unauthorized,

    #[msg("Only the designated worker may submit proof for this job")]
    UnauthorizedWorker,

    #[msg("Proof hash cannot be empty (all zeros)")]
    EmptyProofHash,

    #[msg("Arithmetic overflow in lamport calculation")]
    MathOverflow,
}
