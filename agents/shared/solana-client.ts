import { Connection, Commitment } from "@solana/web3.js";

let _connection: Connection | null = null;

/**
 * Returns a singleton RPC connection.
 * WHY singleton: prevents connection pool exhaustion in agent processes.
 */
export const createConnection = (
  rpcUrl?: string,
  commitment: Commitment = "confirmed"
): Connection => {
  if (_connection) return _connection;

  const url = rpcUrl ?? process.env["SOLANA_RPC_URL"] ?? "https://api.devnet.solana.com";
  _connection = new Connection(url, { commitment, confirmTransactionInitialTimeout: 30_000 });
  return _connection;
};

export const resetConnection = (): void => {
  _connection = null;
};
