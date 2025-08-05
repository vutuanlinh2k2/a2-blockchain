/**
 * Common types and interfaces for CLI commands
 */

export interface BaseOptions {
  database?: string;
}

export interface MinerOptions extends BaseOptions {
  address?: string;
}

export interface TransferOptions extends BaseOptions {
  from: string;
  to: string;
  amount: string;
}

export interface BalanceOptions extends BaseOptions {
  address: string;
}

export interface ChainOptions extends BaseOptions {
  limit?: string;
}

export interface FileOptions extends BaseOptions {
  file: string;
}

export interface DemoTamperOptions extends BaseOptions {
  block?: string;
}
