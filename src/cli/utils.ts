/**
 * CLI utility functions
 */

import chalk from "chalk";
import figlet from "figlet";
import { Blockchain, BlockchainConfig } from "../core/Blockchain";
import * as fs from "fs";
import * as path from "path";

// Global blockchain instance
let blockchain: Blockchain | null = null;

// Default database paths
export const DEFAULT_CORE_DB_PATH = "data/blockchain.db";
export const DEFAULT_DEMO_DB_PATH = "data/demo.db";

/**
 * Initialize blockchain with default configuration
 */
export function initBlockchain(
  dbPath: string = DEFAULT_CORE_DB_PATH
): Blockchain {
  const config: BlockchainConfig = {
    genesisMessage: "Genesis Block - TypeScript Blockchain Implementation",
    initialDifficulty: 2, // Lower difficulty for demo purposes
    blockReward: 50,
    minerAddress: "genesis-miner",
  };

  // Ensure database directory exists and announce DB in use
  ensureDataDirectory(dbPath);

  return new Blockchain(config, dbPath);
}

/**
 * Get or create blockchain instance
 */
export function getBlockchain(dbPath?: string): Blockchain {
  if (!blockchain) {
    blockchain = initBlockchain(dbPath ?? DEFAULT_CORE_DB_PATH);
  }
  return blockchain;
}

/**
 * Reset blockchain instance (used for import operations)
 */
export function resetBlockchain(): void {
  blockchain = null;
}

/**
 * Close blockchain instance
 */
export function closeBlockchain(): void {
  if (blockchain) {
    blockchain.close();
    blockchain = null;
  }
}

/**
 * Show CLI banner
 */
export function showBanner(): void {
  console.log(
    chalk.cyan(
      figlet.textSync("Blockchain CLI", {
        font: "Standard",
        horizontalLayout: "default",
        verticalLayout: "default",
      })
    )
  );
}

/**
 * Ensure database directory exists
 */
export function ensureDataDirectory(dbPath: string): void {
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
}

/**
 * Handle errors consistently across commands
 */
export function handleError(commandName: string, error: unknown): void {
  console.error(
    chalk.red(`❌ ${commandName} error:`),
    error instanceof Error ? error.message : error
  );
}

/**
 * Cleanup helper for demo database: clears tables, closes connection, and deletes DB file.
 * Safe to call multiple times.
 */
export function cleanupDemoDatabase(): void {
  try {
    // If a blockchain instance exists, try to clear its data if it's using the demo DB
    if (blockchain) {
      try {
        blockchain.getStorage().clearAllData();
      } catch {}
      // Close and reset the global instance
      closeBlockchain();
    }

    // Delete the demo DB file if it exists
    if (fs.existsSync(DEFAULT_DEMO_DB_PATH)) {
      fs.unlinkSync(DEFAULT_DEMO_DB_PATH);
      // Also remove WAL/SHM files if present
      const wal = `${DEFAULT_DEMO_DB_PATH}-wal`;
      const shm = `${DEFAULT_DEMO_DB_PATH}-shm`;
      if (fs.existsSync(wal)) fs.unlinkSync(wal);
      if (fs.existsSync(shm)) fs.unlinkSync(shm);
    }
  } catch (e) {
    // Swallow cleanup errors; demos are best-effort cleanup
  }
}
