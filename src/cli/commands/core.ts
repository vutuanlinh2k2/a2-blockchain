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
 * Init command - Initialize a new blockchain
 */
export function createInitCommand(): Command {
  return new Command("init")
    .description("Initialize a new blockchain")
    .action(() => {
      try {
        console.log(chalk.blue("🚀 Initializing blockchain..."));

        ensureDataDirectory(DEFAULT_CORE_DB_PATH);
        const blockchain = initBlockchain(DEFAULT_CORE_DB_PATH);

        console.log(chalk.green("✅ Blockchain initialized successfully!"));

        const stats = blockchain.getExtendedStats();
        console.log(`📊 Chain length: ${stats.totalBlocks} blocks`);
        console.log(`🔗 Genesis hash: ${stats.chainState.genesisHash}`);
      } catch (error) {
        handleError("Initialization", error);
      }
    });
}

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
// todo: change to createTransactionCommand ?
export function createTransferCommand(): Command {
  return new Command("transfer")
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
          chalk.yellow(
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
              chalk.green("✅ Transaction created and added to pool")
            );
            console.log(`🆔 Transaction ID: ${transaction.id}`);
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
        console.log(`   Total: ${balance}`);
        console.log(`   UTXOs: ${utxos.length}`);

        if (utxos.length > 0) {
          console.log("📋 UTXO Details:");
          utxos.forEach((utxo, index) => {
            console.log(
              `   ${index + 1}. ${utxo.txId}:${utxo.outputIndex} = ${utxo.amount}`
            );
          });
        }
      } catch (error) {
        handleError("Balance check", error);
      }
    });
}
