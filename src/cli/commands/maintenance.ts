/**
 * Maintenance commands (validate, export, import)
 */

import { Command } from "commander";
import chalk from "chalk";
import {
  getBlockchain,
  resetBlockchain,
  handleError,
  initBlockchain,
} from "../utils";
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

/**
 * Clear database command - Clear all blockchain data
 */
export function createClearDbCommand(): Command {
  return new Command("clear-db")
    .description("Clear all blockchain data from database")
    .option("-d, --database <path>", "Database file path", "data/blockchain.db")
    .action((options: BaseOptions) => {
      try {
        console.log(
          chalk.yellow(
            "⚠️  WARNING: This will permanently delete all blockchain data!"
          )
        );

        const bc = getBlockchain(options.database);
        const storage = bc.getStorage();

        console.log(chalk.blue("🧹 Clearing database..."));

        storage.clearAllData();

        // Reset global instance to reflect cleared state
        resetBlockchain();

        console.log(chalk.green("✅ Database cleared successfully!"));
      } catch (error) {
        handleError("Clear database", error);
      }
    });
}

/**
 * Seed database command - Initialize database with genesis block (if empty)
 */
export function createSeedDbCommand(): Command {
  return new Command("seed-db")
    .description("Seed database with genesis block (only if database is empty)")
    .option("-d, --database <path>", "Database file path", "data/blockchain.db")
    .action((options: BaseOptions) => {
      try {
        // Check if database is empty first, before initializing blockchain
        // This prevents automatic genesis block creation
        const { BlockchainDB } = require("../../storage/Database");
        const {
          BlockchainStorage,
        } = require("../../storage/BlockchainStorage");

        const tempDb = new BlockchainDB(options.database);
        const tempStorage = new BlockchainStorage(tempDb);

        if (!tempStorage.isDatabaseEmpty()) {
          console.log(
            chalk.yellow("⚠️  Database is not empty. Seeding skipped.")
          );
          console.log(
            "Use 'reset-db' to clear and seed, or 'clear-db' to clear only."
          );
          tempDb.close();
          return;
        }

        tempDb.close();

        console.log(chalk.blue("🌱 Seeding database with genesis block..."));

        // Now create the blockchain (which will create genesis block)
        const newBc = initBlockchain(options.database);
        const stats = newBc.getStats();

        console.log(chalk.green("✅ Database seeded successfully!"));
        console.log(
          `📊 Created ${stats.totalBlocks} blocks with ${stats.totalTransactions} transactions`
        );
      } catch (error) {
        handleError("Seed database", error);
      }
    });
}

/**
 * Reset database command - Clear and seed database
 */
export function createResetDbCommand(): Command {
  return new Command("reset-db")
    .description("Clear database and seed with genesis block")
    .option("-d, --database <path>", "Database file path", "data/blockchain.db")
    .action((options: BaseOptions) => {
      try {
        console.log(
          chalk.yellow(
            "⚠️  WARNING: This will permanently delete all blockchain data!"
          )
        );

        const bc = getBlockchain(options.database);
        const storage = bc.getStorage();

        console.log(chalk.blue("🧹 Clearing database..."));
        storage.clearAllData();

        console.log(chalk.blue("🌱 Seeding database with genesis block..."));

        // Reset and reinitialize to create genesis block
        resetBlockchain();
        const newBc = initBlockchain(options.database);
        const stats = newBc.getStats();

        console.log(chalk.green("✅ Database reset and seeded successfully!"));
        console.log(
          `📊 Created ${stats.totalBlocks} blocks with ${stats.totalTransactions} transactions`
        );
      } catch (error) {
        handleError("Reset database", error);
      }
    });
}
