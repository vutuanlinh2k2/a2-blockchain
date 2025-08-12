/**
 * Common types and interfaces for CLI commands
 */

export interface BaseOptions {
  database?: string;
}

export interface MinerOptions extends BaseOptions {
  address?: string;
}

export interface TransactionOptions extends BaseOptions {
  from: string;
  to: string;
  amount: string;
}

export interface BalanceOptions extends BaseOptions {
  address: string;
}

export interface InitOptions extends BaseOptions {
  genesisMessage?: string;
  initialDifficulty?: string;
  blockReward?: string;
}
