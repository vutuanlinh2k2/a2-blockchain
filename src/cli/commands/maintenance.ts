/**
 * Maintenance commands (validate, export, import)
 */

import { Command } from "commander";
import chalk from "chalk";
import { getBlockchain, resetBlockchain, handleError } from "../utils";
import { BaseOptions, FileOptions } from "../types";

/**
 * Validate command - Validate blockchain integrity
 */
export function createValidateCommand(): Command {
  return new Command("validate")
    .description("Validate blockchain integrity")
    .option("-d, --database <path>", "Database file path", "data/blockchain.db")
    .action((options: BaseOptions) => {
      try {
        const bc = getBlockchain(options.database);

        console.log(chalk.blue("🔍 Validating blockchain integrity..."));

        const chainValid = bc.validateChain();
        const persistenceValid = bc.validatePersistenceIntegrity();

        if (chainValid && persistenceValid) {
          console.log(chalk.green("✅ Blockchain validation successful!"));
          console.log("   ✓ Chain structure is valid");
          console.log("   ✓ Persistence integrity verified");
        } else {
          console.log(chalk.red("❌ Blockchain validation failed!"));
          if (!chainValid) console.log("   ✗ Chain structure is invalid");
          if (!persistenceValid)
            console.log("   ✗ Persistence integrity compromised");
        }
      } catch (error) {
        handleError("Validation", error);
      }
    });
}

/**
 * Export command - Export blockchain to file
 */
export function createExportCommand(): Command {
  return new Command("export")
    .description("Export blockchain to file")
    .requiredOption("-f, --file <path>", "Export file path")
    .option("-d, --database <path>", "Database file path", "data/blockchain.db")
    .action((options: FileOptions) => {
      try {
        const bc = getBlockchain(options.database);

        console.log(
          chalk.blue(`📤 Exporting blockchain to ${options.file}...`)
        );

        const success = bc.exportToFile(options.file);
        if (success) {
          console.log(chalk.green("✅ Export completed successfully!"));
        } else {
          console.log(chalk.red("❌ Export failed"));
        }
      } catch (error) {
        handleError("Export", error);
      }
    });
}

/**
 * Import command - Import blockchain from file
 */
export function createImportCommand(): Command {
  return new Command("import")
    .description("Import blockchain from file")
    .requiredOption("-f, --file <path>", "Import file path")
    .option("-d, --database <path>", "Database file path", "data/blockchain.db")
    .action((options: FileOptions) => {
      try {
        const bc = getBlockchain(options.database);

        console.log(
          chalk.yellow("⚠️  WARNING: This will replace the current blockchain!")
        );
        console.log(
          chalk.blue(`📥 Importing blockchain from ${options.file}...`)
        );

        const success = bc.importFromFile(options.file);
        if (success) {
          console.log(chalk.green("✅ Import completed successfully!"));

          // Reset global instance to reflect imported state
          resetBlockchain();
          const newBc = getBlockchain(options.database);
          const stats = newBc.getStats();
          console.log(
            `📊 Imported ${stats.totalBlocks} blocks with ${stats.totalTransactions} transactions`
          );
        } else {
          console.log(chalk.red("❌ Import failed"));
        }
      } catch (error) {
        handleError("Import", error);
      }
    });
}
