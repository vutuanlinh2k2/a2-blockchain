/**
 * Core blockchain commands (init, mine, transfer, balance)
 */

import { Command } from "commander";
import chalk from "chalk";
import {
  getBlockchain,
  initBlockchain,
  ensureDataDirectory,
  handleError,
  DEFAULT_CORE_DB_PATH,
} from "../utils";
import { MinerOptions, TransferOptions, BalanceOptions } from "../types";

/**
 * Mine command - Mine a new block
 */
export function createMineCommand(): Command {
  return new Command("mine")
    .description("Mine a new block")
    .option("-a, --address <address>", "Miner address", "default-miner")
    .action(async (options: MinerOptions) => {
      try {
        const bc = getBlockchain(DEFAULT_CORE_DB_PATH);
        console.log(
          chalk.blue(`⛏️  Mining new block for address: ${options.address}`)
        );

        const minedBlock = await bc.mineBlock(options.address!);
        if (!minedBlock) {
          console.log(chalk.red("❌ Mining failed"));
        }
      } catch (error) {
        handleError("Mining", error);
      }
    });
}

/**
 * Transfer command - Create and submit a transaction
 */
export function createTransactionCommand(): Command {
  return new Command("tx")
    .description("Create and submit a transaction")
    .requiredOption("-f, --from <address>", "Sender address")
    .requiredOption("-t, --to <address>", "Recipient address")
    .requiredOption("-a, --amount <number>", "Amount to transfer")
    .action((options: TransferOptions) => {
      try {
        const bc = getBlockchain(DEFAULT_CORE_DB_PATH);
        const amount = parseFloat(options.amount);

        if (isNaN(amount) || amount <= 0) {
          console.error(chalk.red("❌ Invalid amount"));
          return;
        }

        console.log(
          chalk.blue(
            `💸 Creating transaction: ${options.from} → ${options.to} (${amount})`
          )
        );

        const transaction = bc.createTransaction(
          options.from,
          options.to,
          amount
        );

        if (transaction) {
          const result = bc.addTransaction(transaction);
          if (result.isValid) {
            console.log(
              chalk.green("✅ Transaction created and added to pool!")
            );
          } else {
            console.log(chalk.red("❌ Transaction rejected:"));
            result.errors.forEach((error) => console.log(`   ${error}`));
          }
        } else {
          console.log(chalk.red("❌ Failed to create transaction"));
        }
      } catch (error) {
        handleError("Transfer", error);
      }
    });
}

/**
 * Balance command - Check address balance
 */
export function createBalanceCommand(): Command {
  return new Command("balance")
    .description("Check address balance")
    .requiredOption("-a, --address <address>", "Address to check")
    .action((options: BalanceOptions) => {
      try {
        const bc = getBlockchain(DEFAULT_CORE_DB_PATH);
        const balance = bc.getBalance(options.address);
        const utxos = bc.getUTXOs(options.address);

        console.log(chalk.magenta(`💰 Balance for ${options.address}:`));
        console.log(
          `   Total: ${balance} ${chalk.gray("(confirmed UTXOs only; pending mempool transactions are excluded until mined)")}`
        );

        if (utxos.length > 0) {
          console.log(`📋 UTXOs (${utxos.length}):`);
          utxos.forEach((utxo, index) => {
            console.log(
              `   [${index + 1}] id=${utxo.txId}, outputIndex=${utxo.outputIndex}, amount=${utxo.amount}`
            );
          });
        }
      } catch (error) {
        handleError("Balance check", error);
      }
    });
}
