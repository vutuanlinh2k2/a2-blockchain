/**
 * CLI module entry point
 * Exports all command creation functions and utilities
 */

import { Command } from "commander";
import chalk from "chalk";
import { showBanner, closeBlockchain } from "./utils";

// Import command creators
import {
  createMineCommand,
  createTransactionCommand,
  createBalanceCommand,
  createDisplayChainCommand,
  createDisplayMempoolCommand,
} from "./commands/core";

import {
  createClearBlockchainDataCommand,
  createSeedBlockchainDataCommand,
} from "./commands/maintenance";

import {
  createDemoImmutabilityCommand,
  createDemoDoubleSpendPreventionCommand,
  createDemoDifficultyAdjustmentCommand,
} from "./commands/demo";

/**
 * Create the main CLI program with all commands
 */
export function createProgram(): Command {
  const program = new Command();

  program
    .name("blockchain")
    .version("1.0.0")
    .addHelpText(
      "beforeAll",
      `${chalk.blue("A TypeScript blockchain implementation with PoW consensus")}\n${chalk.gray(
        "TypeScript • Proof-of-Work • UTXO Model • SQLite"
      )}\n\n${chalk.yellow(
        "Core commands use data/blockchain.db. Demo commands use an isolated data/demo.db and auto-clean after each run."
      )}\n`
    );

  // Core blockchain commands
  program.addCommand(createMineCommand());
  program.addCommand(createTransactionCommand());
  program.addCommand(createBalanceCommand());

  // Display commands
  program.addCommand(createDisplayChainCommand());
  program.addCommand(createDisplayMempoolCommand());

  // Utilities commands
  program.addCommand(createClearBlockchainDataCommand());
  program.addCommand(createSeedBlockchainDataCommand());

  // Demo commands - All Required Features (1-8)
  program.addCommand(createDemoImmutabilityCommand()); // Feature 2: Immutability
  program.addCommand(createDemoDoubleSpendPreventionCommand()); // Feature 3: Double-Spend Prevention
  program.addCommand(createDemoDifficultyAdjustmentCommand());

  return program;
}

/**
 * Main CLI function
 */
export async function runCLI(): Promise<void> {
  try {
    const program = createProgram();

    // Show help if no arguments provided
    if (process.argv.length <= 2) {
      showBanner();
      program.help();
      return;
    }

    await program.parseAsync(process.argv);
  } catch (error) {
    console.error(
      chalk.red("❌ Error:"),
      error instanceof Error ? error.message : "Unknown error"
    );

    closeBlockchain();
    process.exit(1);
  } finally {
    closeBlockchain();
  }
}

// Re-export utilities for external use
export { showBanner, getBlockchain, initBlockchain } from "./utils";
