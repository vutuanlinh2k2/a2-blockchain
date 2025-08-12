import { Command } from "commander";
import chalk from "chalk";
import { getBlockchain, handleError, DEFAULT_CORE_DB_PATH } from "../utils";

/**
 * Seed database command - Initialize database with genesis block (if empty)
 */
export function createSeedBlockchainDataCommand(): Command {
  return new Command("seed-chain")
    .description(
      "Seed database with a 5-block sample chain (only if database is empty)"
    )
    .action(async () => {
      try {
        // Check if database has more than just the genesis block (block count > 1)
        const { BlockchainDB } = require("../../storage/Database");

        const tempDb = new BlockchainDB(DEFAULT_CORE_DB_PATH);
        const blockCount = tempDb
          .getInstance()
          .prepare("SELECT COUNT(*) as count FROM blocks")
          .get() as any;
        if (blockCount.count > 1) {
          console.log(
            chalk.yellow(
              "⚠️  Database already contains more than genesis block. Seeding skipped."
            )
          );
          console.log(
            "Use 'init' to clear the database and initialize a new blockchain, then rerun 'seed-chain'."
          );
          tempDb.close();
          return;
        }

        tempDb.close();

        console.log(chalk.blue("🌱 Seeding blockchain data..."));

        // Get existing blockchain (should already exist from init command)
        const bc = getBlockchain(DEFAULT_CORE_DB_PATH);

        // Get the block reward to calculate appropriate transaction amounts
        const config = bc.getConfig();
        const blockReward = config.blockReward;

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

        // Calculate dynamic transaction amounts based on block reward
        const amount1 = Math.floor(blockReward * 0.4); // 40% of block reward for miner1 → alice
        const amount2 = Math.floor(blockReward * 0.1); // 10% of block reward for alice → bob
        const amount3 = Math.floor(blockReward * 0.24); // 24% of block reward for miner1 → carol
        const amount4 = Math.floor(blockReward * 0.06); // 6% of block reward for bob → alice
        const amount5 = Math.floor(blockReward * 0.08); // 8% of block reward for carol → alice

        // Prepare and mine Block #2: distribute to alice
        addTx(`miner1 → alice (${amount1})`, miner1, alice, amount1);
        await bc.mineBlock(miner1);
        console.log();

        // Prepare and mine Block #3: alice → bob, and further distribute from miner1 → carol
        addTx(`alice → bob (${amount2})`, alice, bob, amount2);
        console.log();
        addTx(`miner1 → carol (${amount3})`, miner1, carol, amount3);
        await bc.mineBlock(miner1);
        console.log();

        // Prepare and mine Block #4: small movements among users
        addTx(`bob → alice (${amount4})`, bob, alice, amount4);
        console.log();
        addTx(`carol → alice (${amount5})`, carol, alice, amount5);
        await bc.mineBlock(miner1);
        console.log();

        console.log(chalk.green("✅ Database seeded successfully!"));
        console.log();
      } catch (error) {
        handleError("Seed database", error);
      }
    });
}
