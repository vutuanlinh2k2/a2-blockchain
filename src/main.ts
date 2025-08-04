#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import figlet from "figlet";

/**
 * Main entry point for the Blockchain CLI
 * This file sets up the command structure and initializes the application
 */

function showBanner(): void {
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

function createProgram(): Command {
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

  // Placeholder commands - will be implemented in later steps
  program
    .command("init")
    .description("Initialize a new blockchain")
    .action(() => {
      console.log(
        chalk.green("✅ Blockchain initialization - Coming in Step 2!")
      );
    });

  program
    .command("mine")
    .description("Mine a new block")
    .action(() => {
      console.log(chalk.blue("⛏️  Mining functionality - Coming in Step 6!"));
    });

  program
    .command("transfer")
    .description("Create and submit a transaction")
    .action(() => {
      console.log(chalk.yellow("💸 Transaction system - Coming in Step 3!"));
    });

  program
    .command("balance")
    .description("Check address balance")
    .action(() => {
      console.log(chalk.magenta("💰 Balance checking - Coming in Step 8!"));
    });

  program
    .command("chain")
    .description("Display the blockchain")
    .action(() => {
      console.log(chalk.cyan("⛓️  Chain visualization - Coming in Step 10!"));
    });

  return program;
}

async function main(): Promise<void> {
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
    process.exit(1);
  }
}

// Run the CLI if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error(chalk.red("❌ Fatal error:"), error);
    process.exit(1);
  });
}

export { main };
