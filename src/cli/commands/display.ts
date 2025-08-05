/**
 * Display commands (chain, stats, mempool)
 */

import { Command } from "commander";
import chalk from "chalk";
import { getBlockchain, handleError } from "../utils";
import { BaseOptions, ChainOptions } from "../types";

/**
 * Chain command - Display the blockchain
 */
export function createChainCommand(): Command {
  return new Command("chain")
    .description("Display the blockchain")
    .option("-l, --limit <number>", "Limit number of blocks to show", "10")
    .option("-d, --database <path>", "Database file path", "data/blockchain.db")
    .action((options: ChainOptions) => {
      try {
        const bc = getBlockchain(options.database);
        const chain = bc.getChain();
        const limit = parseInt(options.limit || "10");

        console.log(chalk.cyan("⛓️  Blockchain:"));
        console.log(`📊 Total blocks: ${chain.length}`);

        const blocksToShow = chain.slice(-limit);
        blocksToShow.forEach((block, index) => {
          const isLatest = index === blocksToShow.length - 1;
          const prefix = isLatest ? "🔴" : "🔗";

          console.log(`\n${prefix} Block #${block.index}`);
          console.log(`   Hash: ${block.hash}`);
          console.log(`   Previous: ${block.previousHash}`);
          console.log(
            `   Timestamp: ${new Date(block.timestamp).toISOString()}`
          );
          console.log(`   Transactions: ${block.getTransactionCount()}`);
          console.log(`   Difficulty: ${block.difficulty}`);
          console.log(`   Nonce: ${block.nonce}`);
        });
      } catch (error) {
        handleError("Chain display", error);
      }
    });
}

/**
 * Stats command - Show blockchain statistics
 */
export function createStatsCommand(): Command {
  return new Command("stats")
    .description("Show blockchain statistics")
    .option("-d, --database <path>", "Database file path", "data/blockchain.db")
    .action((options: BaseOptions) => {
      try {
        const bc = getBlockchain(options.database);
        const stats = bc.getExtendedStats();

        console.log(chalk.blue("📊 Blockchain Statistics:"));
        console.log(`   Total Blocks: ${stats.totalBlocks}`);
        console.log(`   Total Transactions: ${stats.totalTransactions}`);
        console.log(`   Current Difficulty: ${stats.currentDifficulty}`);
        console.log(
          `   Average Block Time: ${stats.averageBlockTime.toFixed(2)}ms`
        );
        console.log(`   Total Value: ${stats.totalValue}`);
        console.log(`   Latest Block: ${stats.latestBlockHash}`);

        console.log(chalk.green("\n💾 Database Statistics:"));
        console.log(`   Blocks in DB: ${stats.databaseStats.blockCount}`);
        console.log(
          `   Transactions in DB: ${stats.databaseStats.transactionCount}`
        );
        console.log(`   UTXOs: ${stats.databaseStats.utxoCount}`);
        console.log(`   Spent UTXOs: ${stats.databaseStats.spentUtxoCount}`);
        console.log(
          `   Chain State Entries: ${stats.databaseStats.chainStateCount}`
        );

        console.log(chalk.yellow("\n🔗 Chain State:"));
        console.log(`   Chain Tip: ${stats.chainState.tip}`);
        console.log(`   Chain Length: ${stats.chainState.length}`);
        console.log(`   Genesis Hash: ${stats.chainState.genesisHash}`);
      } catch (error) {
        handleError("Stats", error);
      }
    });
}

/**
 * Mempool command - Show pending transactions
 */
export function createMempoolCommand(): Command {
  return new Command("mempool")
    .description("Show pending transactions")
    .option("-d, --database <path>", "Database file path", "data/blockchain.db")
    .action((options: BaseOptions) => {
      try {
        const bc = getBlockchain(options.database);
        const pool = bc.getTransactionPool();
        const transactions = pool.getAllTransactions();

        console.log(
          chalk.cyan(`📋 Transaction Pool (${transactions.length} pending):`)
        );

        if (transactions.length === 0) {
          console.log("   No pending transactions");
        } else {
          transactions.forEach((tx, index) => {
            console.log(`\n   ${index + 1}. ${tx.id}`);
            console.log(`      Inputs: ${tx.inputs.length}`);
            console.log(`      Outputs: ${tx.outputs.length}`);
            console.log(`      Amount: ${tx.getTotalOutputAmount()}`);
            console.log(
              `      Timestamp: ${new Date(tx.timestamp).toISOString()}`
            );
          });
        }
      } catch (error) {
        handleError("Mempool", error);
      }
    });
}
