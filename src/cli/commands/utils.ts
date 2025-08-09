import { Command } from "commander";
import chalk from "chalk";
import {
  getBlockchain,
  resetBlockchain,
  handleError,
  initBlockchain,
  DEFAULT_CORE_DB_PATH,
} from "../utils";

/**
 * Clear database command - Clear all blockchain data
 */
export function createClearBlockchainDataCommand(): Command {
  return new Command("clear-blockchain")
    .description("Clear all blockchain data from database")
    .action(() => {
      try {
        console.log(
          chalk.yellow(
            "⚠️  WARNING: This will permanently delete all blockchain data!"
          )
        );

        const bc = getBlockchain(DEFAULT_CORE_DB_PATH);
        const storage = bc.getStorage();

        console.log(chalk.red("\n🧹 Clearing database..."));

        storage.clearAllData();

        // Reset global instance to reflect cleared state
        resetBlockchain();

        console.log(chalk.green("\n✅ Database cleared successfully!"));
      } catch (error) {
        handleError("Clear database", error);
      }
    });
}

/**
 * Seed database command - Initialize database with genesis block (if empty)
 */
// TODO: seed data with more data, move this inside a script
export function createSeedBlockchainDataCommand(): Command {
  return new Command("seed-blockchain")
    .description(
      "Seed database with a 5-block sample chain (only if database is empty)"
    )
    .action(async () => {
      try {
        // Check if database is empty first, before initializing blockchain
        // This prevents automatic genesis block creation when not desired
        const { BlockchainDB } = require("../../storage/Database");
        const {
          BlockchainStorage,
        } = require("../../storage/BlockchainStorage");

        const tempDb = new BlockchainDB(DEFAULT_CORE_DB_PATH);
        const tempStorage = new BlockchainStorage(tempDb);

        if (!tempStorage.isDatabaseEmpty()) {
          console.log(
            chalk.yellow("⚠️  Database is not empty. Seeding skipped.")
          );
          console.log(
            "Use 'clear-blockchain' to clear the database, then rerun 'seed-blockchain'."
          );
          tempDb.close();
          return;
        }

        tempDb.close();

        console.log(chalk.blue("🌱 Seeding blockchain data..."));

        // Initialize blockchain (creates genesis block at index 0)
        const bc = initBlockchain(DEFAULT_CORE_DB_PATH);

        // Addresses used in seed data
        const miner1 = "miner1";
        const alice = "alice";
        const bob = "bob";
        const carol = "carol";

        // Helper to safely add a tx to mempool
        const addTx = (
          label: string,
          from: string,
          to: string,
          amount: number
        ) => {
          const tx = bc.createTransaction(from, to, amount);
          if (!tx) {
            console.log(
              chalk.yellow(`   ℹ️  Skipped ${label}: insufficient funds`)
            );
            return false;
          }
          const validation = bc.addTransaction(tx);
          if (!validation.isValid) {
            console.log(
              chalk.yellow(
                `   ℹ️  Skipped ${label}: ${validation.errors.join(", ")}`
              )
            );
            return false;
          }
          return true;
        };

        // Mine Block #1: award miner1
        await bc.mineBlock(miner1);
        console.log();

        // Prepare and mine Block #2: distribute to alice
        addTx("miner1 → alice (20)", miner1, alice, 20);
        await bc.mineBlock(miner1);
        console.log();

        // Prepare and mine Block #3: alice → bob, and further distribute from miner1 → carol
        addTx("alice → bob (5)", alice, bob, 5);
        console.log();
        addTx("miner1 → carol (12)", miner1, carol, 12);
        await bc.mineBlock(miner1);
        console.log();

        // Prepare and mine Block #4: small movements among users
        addTx("bob → alice (3)", bob, alice, 3);
        console.log();
        addTx("carol → alice (4)", carol, alice, 4);
        await bc.mineBlock(miner1);
        console.log();

        console.log(chalk.green("✅ Database seeded successfully!"));
        console.log();
      } catch (error) {
        handleError("Seed database", error);
      }
    });
}
