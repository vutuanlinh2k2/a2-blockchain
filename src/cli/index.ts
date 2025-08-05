/**
 * CLI module entry point
 * Exports all command creation functions and utilities
 */

import { Command } from "commander";
import chalk from "chalk";
import { showBanner, closeBlockchain } from "./utils";

// Import command creators
import {
  createInitCommand,
  createMineCommand,
  createTransferCommand,
  createBalanceCommand,
} from "./commands/core";

import {
  createChainCommand,
  createStatsCommand,
  createMempoolCommand,
} from "./commands/display";

import {
  createValidateCommand,
  createExportCommand,
  createImportCommand,
} from "./commands/maintenance";

import {
  createDemoDoubleSpendCommand,
  createDemoTamperCommand,
  createDemoBlockStructureCommand,
  createDemoMiningCommand,
  createDemoTransactionsCommand,
  createDemoOrderingCommand,
  createDemoPersistenceCommand,
  createDemoFullWorkflowCommand,
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
      )}\n`
    );

  // Core blockchain commands
  program.addCommand(createInitCommand());
  program.addCommand(createMineCommand());
  program.addCommand(createTransferCommand());
  program.addCommand(createBalanceCommand());

  // Display commands
  program.addCommand(createChainCommand());
  program.addCommand(createStatsCommand());
  program.addCommand(createMempoolCommand());

  // Maintenance commands
  program.addCommand(createValidateCommand());
  program.addCommand(createExportCommand());
  program.addCommand(createImportCommand());

  // Demo commands - All Required Features (1-8)
  program.addCommand(createDemoBlockStructureCommand()); // Feature 1: Block Structure
  program.addCommand(createDemoTamperCommand()); // Feature 2: Cryptographic Hashing
  program.addCommand(createDemoTransactionsCommand()); // Feature 3: Transaction Handling
  program.addCommand(createDemoMiningCommand()); // Feature 4: Consensus Mechanism
  program.addCommand(createDemoDoubleSpendCommand()); // Feature 5: Double-Spend Prevention
  program.addCommand(createDemoOrderingCommand()); // Feature 6: Global Ordering
  program.addCommand(createDemoPersistenceCommand()); // Feature 7: Data Persistence
  program.addCommand(createDemoFullWorkflowCommand()); // Feature 8: Complete Workflow

  return program;
}

/**
 * Main CLI function
 */
export async function runCLI(): Promise<void> {
  try {
    showBanner();

    const program = createProgram();

    // Show help if no arguments provided
    if (process.argv.length <= 2) {
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
