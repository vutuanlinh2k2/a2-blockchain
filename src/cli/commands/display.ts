/**
 * Display commands (chain, stats, mempool)
 */

import { Command } from "commander";
import chalk from "chalk";
import { getBlockchain, handleError, DEFAULT_CORE_DB_PATH } from "../utils";
import { ChainOptions } from "../types";

/**
 * Chain command - Display the blockchain
 */
export function createDisplayChainCommand(): Command {
  return new Command("display-chain")
    .description("Display the blockchain")
    .option("-l, --limit <number>", "Limit number of blocks to show", "10")
    .action((options: ChainOptions) => {
      try {
        const bc = getBlockchain(DEFAULT_CORE_DB_PATH);
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
 * Mempool command - Show pending transactions
 */
export function createDisplayMempoolCommand(): Command {
  return new Command("display-mempool")
    .description("Show pending transactions")
    .action(() => {
      try {
        const bc = getBlockchain(DEFAULT_CORE_DB_PATH);
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
