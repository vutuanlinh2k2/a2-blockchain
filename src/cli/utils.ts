import chalk from "chalk";
import figlet from "figlet";
import { Blockchain, BlockchainConfig } from "../core/Blockchain";
import * as fs from "fs";
import * as path from "path";

let blockchain: Blockchain | null = null;

export const DEFAULT_CORE_DB_PATH = "data/blockchain.db";

export function initBlockchain(dbPath?: string): Blockchain {
  const config: BlockchainConfig = {
    genesisMessage: "Genesis Block",
    initialDifficulty: 2,
    blockReward: 50,
  };

  if (dbPath) {
    ensureDataDirectory(dbPath);
  }

  return new Blockchain(config, dbPath);
}

/**
 * Initialize blockchain with custom configuration
 */
export function initBlockchainWithConfig(
  config: BlockchainConfig,
  dbPath?: string
): Blockchain {
  if (dbPath) {
    ensureDataDirectory(dbPath);
  }

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
 * Try to get blockchain instance, returns result with error handling
 * This function requires an existing database - it will not auto-create one
 */
export function tryGetBlockchain(dbPath?: string): {
  blockchain?: Blockchain;
  error?: string;
} {
  try {
    const actualDbPath = dbPath ?? DEFAULT_CORE_DB_PATH;

    // Check if database file exists
    if (!fs.existsSync(actualDbPath)) {
      return {
        error: `No blockchain database found. Use 'init' command to initialize a new blockchain.`,
      };
    }

    if (!blockchain) {
      // Try to load existing blockchain from database only
      blockchain = initBlockchain(actualDbPath);
    }
    return { blockchain };
  } catch (error) {
    // Reset blockchain instance on error
    blockchain = null;
    return {
      error: `Failed to load blockchain: ${error instanceof Error ? error.message : error}. Use 'init' command to initialize a new blockchain.`,
    };
  }
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
