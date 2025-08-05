/**
 * Demo commands (demo-double-spend, demo-tamper)
 */

import { Command } from "commander";
import chalk from "chalk";
import { getBlockchain, handleError } from "../utils";
import { BaseOptions, DemoTamperOptions } from "../types";

/**
 * Demo double-spend command - Demonstrate double-spend prevention
 */
export function createDemoDoubleSpendCommand(): Command {
  return new Command("demo-double-spend")
    .description("Demonstrate double-spend prevention")
    .option("-d, --database <path>", "Database file path", "data/blockchain.db")
    .action((options: BaseOptions) => {
      try {
        const bc = getBlockchain(options.database);

        console.log(
          chalk.magenta("🔬 Demonstrating double-spend prevention...")
        );

        const results = bc.demonstrateMultipleDoubleSpendScenarios();

        console.log(chalk.blue("\n📋 Double-Spend Prevention Results:"));
        results.forEach((result, index) => {
          const status =
            result.result.success !== false
              ? chalk.green("✅ PREVENTED")
              : chalk.red("❌ FAILED");

          console.log(`   ${index + 1}. ${result.scenario}: ${status}`);
        });
      } catch (error) {
        handleError("Demo", error);
      }
    });
}

/**
 * Demo tamper command - Demonstrate tampering detection
 */
export function createDemoTamperCommand(): Command {
  return new Command("demo-tamper")
    .description("Demonstrate tampering detection")
    .option("-b, --block <index>", "Block index to tamper with", "1")
    .option("-d, --database <path>", "Database file path", "data/blockchain.db")
    .action((options: DemoTamperOptions) => {
      try {
        const bc = getBlockchain(options.database);
        const blockIndex = parseInt(options.block || "1");

        console.log(
          chalk.magenta(
            `🔬 Demonstrating tampering detection on block #${blockIndex}...`
          )
        );

        const detected = bc.demonstrateTampering(blockIndex);

        if (detected) {
          console.log(chalk.green("✅ Tampering successfully detected!"));
        } else {
          console.log(chalk.red("❌ Tampering detection failed!"));
        }
      } catch (error) {
        handleError("Demo", error);
      }
    });
}
