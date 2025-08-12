import { Command } from "commander";
import chalk from "chalk";
import { showBanner, closeBlockchain } from "./utils";

import {
  createInitCommand,
  createMineCommand,
  createTransactionCommand,
  createBalanceCommand,
  createDisplayChainCommand,
  createDisplayMempoolCommand,
} from "./commands/core";

import { createSeedBlockchainDataCommand } from "./commands/maintenance";

import {
  createDemoImmutabilityCommand,
  createDemoDoubleSpendPreventionCommand,
  createDemoDifficultyAdjustmentCommand,
} from "./commands/demo";

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
  program.addCommand(createTransactionCommand());
  program.addCommand(createBalanceCommand());
  program.addCommand(createDisplayChainCommand());
  program.addCommand(createDisplayMempoolCommand());

  // Utilities commands
  program.addCommand(createSeedBlockchainDataCommand());

  // Demo commands
  program.addCommand(createDemoImmutabilityCommand());
  program.addCommand(createDemoDoubleSpendPreventionCommand());
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
