import { Command } from "commander";
import chalk from "chalk";
import {
  getBlockchain,
  handleError,
  DEFAULT_CORE_DB_PATH,
  resetBlockchain,
  initBlockchainWithConfig,
  tryGetBlockchain,
} from "../utils";
import { BlockchainConfig } from "../../core/Blockchain";
import {
  MinerOptions,
  TransactionOptions,
  BalanceOptions,
  ChainOptions,
  InitOptions,
} from "../types";
import { format } from "date-fns";

/**
 * Init command - Initialize a new blockchain with custom configuration
 */
export function createInitCommand(): Command {
  return new Command("init")
    .description("Initialize a new blockchain with clean state")
    .option(
      "-m, --genesis-message <message>",
      "Genesis block message",
      "Genesis Block"
    )
    .option(
      "-d, --initial-difficulty <number>",
      "Initial mining difficulty",
      "2"
    )
    .option("-r, --block-reward <number>", "Block reward for mining", "50")
    .action(async (options: InitOptions) => {
      try {
        // Parse and validate options
        const genesisMessage = options.genesisMessage || "Genesis Block";
        const initialDifficulty = parseInt(options.initialDifficulty || "2");
        const blockReward = parseFloat(options.blockReward || "50");

        if (isNaN(initialDifficulty) || initialDifficulty < 1) {
          console.error(
            chalk.red("❌ Invalid difficulty. Must be a number >= 1")
          );
          return;
        }

        if (isNaN(blockReward) || blockReward <= 0) {
          console.error(
            chalk.red("❌ Invalid block reward. Must be a number > 0")
          );
          return;
        }

        console.log(
          chalk.yellow(
            "⚠️  WARNING: This will permanently delete all existing blockchain data!"
          )
        );
        console.log(chalk.blue("🔧 Initializing new blockchain..."));

        // Clear existing blockchain instance and database
        resetBlockchain();

        // Clear existing database if it exists
        try {
          const { BlockchainDB } = require("../../storage/Database");
          const {
            BlockchainStorage,
          } = require("../../storage/BlockchainStorage");

          const tempDb = new BlockchainDB(DEFAULT_CORE_DB_PATH);
          const tempStorage = new BlockchainStorage(tempDb);
          tempStorage.clearAllData();
          tempDb.close();
        } catch (error) {
          // Database might not exist yet, which is fine
        }

        // Create new blockchain with custom config
        const config: BlockchainConfig = {
          genesisMessage,
          initialDifficulty,
          blockReward,
        };

        const bc = initBlockchainWithConfig(config, DEFAULT_CORE_DB_PATH);

        console.log(chalk.green("\n✅ Blockchain initialized successfully!"));
        console.log(chalk.blue("📋 Configuration:"));
        console.log(`   Genesis Message: "${genesisMessage}"`);
        console.log(`   Initial Difficulty: ${initialDifficulty}`);
        console.log(`   Block Reward: ${blockReward}`);
        console.log(
          chalk.gray(
            "\nYou can now use other commands to interact with your blockchain."
          )
        );
      } catch (error) {
        handleError("Initialize blockchain", error);
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
        const result = tryGetBlockchain(DEFAULT_CORE_DB_PATH);
        if (result.error) {
          console.error(chalk.red(result.error));
          return;
        }

        const bc = result.blockchain!;
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
 * Transaction command - Create and submit a transaction
 */
export function createTransactionCommand(): Command {
  return new Command("tx")
    .description("Create and submit a transaction")
    .requiredOption("-f, --from <address>", "Sender address")
    .requiredOption("-t, --to <address>", "Recipient address")
    .requiredOption("-a, --amount <number>", "Amount to transfer")
    .action((options: TransactionOptions) => {
      try {
        const result = tryGetBlockchain(DEFAULT_CORE_DB_PATH);
        if (result.error) {
          console.error(chalk.red(result.error));
          return;
        }

        const bc = result.blockchain!;
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
          const txResult = bc.addTransaction(transaction);
          if (txResult.isValid) {
            console.log(
              chalk.green("✅ Transaction created and added to pool!")
            );
          } else {
            console.log(chalk.red("❌ Transaction rejected:"));
            txResult.errors.forEach((error) => console.log(`   ${error}`));
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
        const result = tryGetBlockchain(DEFAULT_CORE_DB_PATH);
        if (result.error) {
          console.error(chalk.red(result.error));
          return;
        }

        const bc = result.blockchain!;
        const balance = bc.getBalance(options.address);
        const utxos = bc.getUTXOs(options.address);

        console.log();
        console.log(chalk.blue(`💰 Balance for ${options.address}:`));
        console.log(
          `   Total: ${balance} ${chalk.gray("(confirmed UTXOs only; pending mempool transactions are excluded until mined)")}`
        );

        if (utxos.length > 0) {
          console.log(chalk.blue(`📋 UTXOs (${utxos.length}):`));
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

/**
 * Chain command - Display the blockchain
 */
export function createDisplayChainCommand(): Command {
  return new Command("display-chain")
    .description("Display the blockchain")
    .option("-l, --limit <number>", "Limit number of blocks to show", "10")
    .action((options: ChainOptions) => {
      try {
        const result = tryGetBlockchain(DEFAULT_CORE_DB_PATH);
        if (result.error) {
          console.error(chalk.red(result.error));
          return;
        }

        const bc = result.blockchain!;
        const chain = bc.getChain();
        const limit = parseInt(options.limit || "10");

        console.log(chalk.cyan("\n⛓️  Blockchain:"));
        console.log(`📊 Total blocks: ${chain.length}`);

        const blocksToShow = chain.slice(-limit);
        blocksToShow.forEach((block, index) => {
          const isLatest = index === blocksToShow.length - 1;
          const prefix = isLatest ? "🔴" : "🔗";

          console.log(chalk.yellow(`\n${prefix} Block #${block.index}`));
          console.log(`   Hash: ${block.hash}`);
          console.log(`   Previous: ${block.previousHash}`);
          console.log(
            `   Timestamp: ${format(new Date(block.timestamp), "dd-MM-yyyy (HH:mm:ss)")}`
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
        const result = tryGetBlockchain(DEFAULT_CORE_DB_PATH);
        if (result.error) {
          console.error(chalk.red(result.error));
          return;
        }

        const bc = result.blockchain!;
        const pool = bc.getTransactionPool();
        const transactions = pool.getAllTransactions();
        const utxoSet = bc.getUTXOSet();

        console.log(
          chalk.cyan(`\n📋 Transaction Pool (${transactions.length}):`)
        );

        if (transactions.length === 0) {
          console.log("   No pending transactions");
        } else {
          transactions.forEach((tx, index) => {
            console.log(
              chalk.yellow(`[${index + 1}] Transaction ID: ${tx.id}`)
            );
            console.log(
              `    Received: ${format(new Date(tx.timestamp), "dd-MM-yyyy (HH:mm:ss)")}`
            );

            // Inputs
            console.log(`    Inputs (${tx.inputs.length}):`);
            if (tx.inputs.length === 0) {
              console.log(chalk.gray("     (Coinbase transaction)"));
            } else {
              tx.inputs.forEach((input, i) => {
                const utxo = utxoSet.getUTXO(input.txId, input.outputIndex);
                if (utxo) {
                  console.log(
                    `      [${i}] txId=${chalk.bold(
                      `${input.txId.substring(0, 10)}...`
                    )}, outputIndex=${chalk.bold(
                      input.outputIndex
                    )}, address=${chalk.bold(
                      utxo.address
                    )}, amount=${chalk.bold(utxo.amount.toString())}`
                  );
                } else {
                  // Fallback if UTXO not found (should not happen in a valid mempool)
                  console.log(
                    `      [${i}] txId=${chalk.bold(
                      `${input.txId.substring(0, 10)}...`
                    )}, outputIndex=${chalk.bold(
                      input.outputIndex
                    )} ${chalk.red("(UTXO not found)")}`
                  );
                }
              });
            }

            // Outputs
            console.log(`    Outputs (${tx.outputs.length}):`);
            tx.outputs.forEach((output, i) => {
              console.log(
                `      [${i}] to=${chalk.bold(
                  output.address
                )}, amount=${chalk.bold(output.amount.toString())}`
              );
            });
          });
        }
      } catch (error) {
        handleError("Mempool", error);
      }
    });
}
