#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import figlet from "figlet";
import { Blockchain, BlockchainConfig } from "./core/Blockchain";
import * as fs from "fs";
import * as path from "path";

/**
 * Main entry point for the Blockchain CLI
 * This file sets up the command structure and initializes the application
 */

// Global blockchain instance
let blockchain: Blockchain | null = null;

/**
 * Initialize blockchain with default configuration
 */
function initBlockchain(dbPath?: string): Blockchain {
  const config: BlockchainConfig = {
    genesisMessage: "Genesis Block - TypeScript Blockchain Implementation",
    initialDifficulty: 2, // Lower difficulty for demo purposes
    blockReward: 50,
    minerAddress: "genesis-miner",
  };

  return new Blockchain(config, dbPath);
}

/**
 * Get or create blockchain instance
 */
function getBlockchain(dbPath?: string): Blockchain {
  if (!blockchain) {
    blockchain = initBlockchain(dbPath);
  }
  return blockchain;
}

function showBanner(): void {
  console.log(
    chalk.cyan(
      figlet.textSync("Blockchain CLI", {
        font: "Standard",
        horizontalLayout: "default",
        verticalLayout: "default",
      })
    )
  );
}

function createProgram(): Command {
  const program = new Command();

  program
    .name("blockchain")
    .version("1.0.0")
    .addHelpText(
      "beforeAll",
      `${chalk.blue("A TypeScript blockchain implementation with PoW consensus")}\n${chalk.gray(
        "TypeScript • Proof-of-Work • UTXO Model • SQLite"
      )}\n`
    );

  // Core blockchain commands
  program
    .command("init")
    .description("Initialize a new blockchain")
    .option("-d, --database <path>", "Database file path", "data/blockchain.db")
    .action((options) => {
      try {
        console.log(chalk.blue("🚀 Initializing blockchain..."));

        // Ensure data directory exists
        const dbDir = path.dirname(options.database);
        if (!fs.existsSync(dbDir)) {
          fs.mkdirSync(dbDir, { recursive: true });
        }

        blockchain = initBlockchain(options.database);
        console.log(chalk.green("✅ Blockchain initialized successfully!"));

        const stats = blockchain.getExtendedStats();
        console.log(`📊 Chain length: ${stats.totalBlocks} blocks`);
        console.log(`🔗 Genesis hash: ${stats.chainState.genesisHash}`);
      } catch (error) {
        console.error(
          chalk.red("❌ Initialization failed:"),
          error instanceof Error ? error.message : error
        );
      }
    });

  program
    .command("mine")
    .description("Mine a new block")
    .option("-a, --address <address>", "Miner address", "default-miner")
    .option("-d, --database <path>", "Database file path", "data/blockchain.db")
    .action(async (options) => {
      try {
        const bc = getBlockchain(options.database);
        console.log(
          chalk.blue(`⛏️  Mining new block for address: ${options.address}`)
        );

        const minedBlock = await bc.mineBlock(options.address);
        if (minedBlock) {
          console.log(chalk.green("✅ Block mined successfully!"));
          console.log(`📦 Block #${minedBlock.index}`);
          console.log(`🔗 Hash: ${minedBlock.hash}`);
          console.log(`💰 Reward: ${bc.getBalance(options.address)}`);
        } else {
          console.log(chalk.red("❌ Mining failed"));
        }
      } catch (error) {
        console.error(
          chalk.red("❌ Mining error:"),
          error instanceof Error ? error.message : error
        );
      }
    });

  program
    .command("transfer")
    .description("Create and submit a transaction")
    .requiredOption("-f, --from <address>", "Sender address")
    .requiredOption("-t, --to <address>", "Recipient address")
    .requiredOption("-a, --amount <number>", "Amount to transfer")
    .option("-d, --database <path>", "Database file path", "data/blockchain.db")
    .action((options) => {
      try {
        const bc = getBlockchain(options.database);
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
        console.error(
          chalk.red("❌ Transfer error:"),
          error instanceof Error ? error.message : error
        );
      }
    });

  program
    .command("balance")
    .description("Check address balance")
    .requiredOption("-a, --address <address>", "Address to check")
    .option("-d, --database <path>", "Database file path", "data/blockchain.db")
    .action((options) => {
      try {
        const bc = getBlockchain(options.database);
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
        console.error(
          chalk.red("❌ Balance check error:"),
          error instanceof Error ? error.message : error
        );
      }
    });

  program
    .command("chain")
    .description("Display the blockchain")
    .option("-l, --limit <number>", "Limit number of blocks to show", "10")
    .option("-d, --database <path>", "Database file path", "data/blockchain.db")
    .action((options) => {
      try {
        const bc = getBlockchain(options.database);
        const chain = bc.getChain();
        const limit = parseInt(options.limit);

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
        console.error(
          chalk.red("❌ Chain display error:"),
          error instanceof Error ? error.message : error
        );
      }
    });

  // Advanced commands for data persistence
  program
    .command("stats")
    .description("Show blockchain statistics")
    .option("-d, --database <path>", "Database file path", "data/blockchain.db")
    .action((options) => {
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
        console.error(
          chalk.red("❌ Stats error:"),
          error instanceof Error ? error.message : error
        );
      }
    });

  program
    .command("validate")
    .description("Validate blockchain integrity")
    .option("-d, --database <path>", "Database file path", "data/blockchain.db")
    .action((options) => {
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
        console.error(
          chalk.red("❌ Validation error:"),
          error instanceof Error ? error.message : error
        );
      }
    });

  program
    .command("export")
    .description("Export blockchain to file")
    .requiredOption("-f, --file <path>", "Export file path")
    .option("-d, --database <path>", "Database file path", "data/blockchain.db")
    .action((options) => {
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
        console.error(
          chalk.red("❌ Export error:"),
          error instanceof Error ? error.message : error
        );
      }
    });

  program
    .command("import")
    .description("Import blockchain from file")
    .requiredOption("-f, --file <path>", "Import file path")
    .option("-d, --database <path>", "Database file path", "data/blockchain.db")
    .action((options) => {
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
          blockchain = null;
          const newBc = getBlockchain(options.database);
          const stats = newBc.getStats();
          console.log(
            `📊 Imported ${stats.totalBlocks} blocks with ${stats.totalTransactions} transactions`
          );
        } else {
          console.log(chalk.red("❌ Import failed"));
        }
      } catch (error) {
        console.error(
          chalk.red("❌ Import error:"),
          error instanceof Error ? error.message : error
        );
      }
    });

  program
    .command("demo-double-spend")
    .description("Demonstrate double-spend prevention")
    .option("-d, --database <path>", "Database file path", "data/blockchain.db")
    .action((options) => {
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
        console.error(
          chalk.red("❌ Demo error:"),
          error instanceof Error ? error.message : error
        );
      }
    });

  program
    .command("demo-tamper")
    .description("Demonstrate tampering detection")
    .option("-b, --block <index>", "Block index to tamper with", "1")
    .option("-d, --database <path>", "Database file path", "data/blockchain.db")
    .action((options) => {
      try {
        const bc = getBlockchain(options.database);
        const blockIndex = parseInt(options.block);

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
        console.error(
          chalk.red("❌ Demo error:"),
          error instanceof Error ? error.message : error
        );
      }
    });

  program
    .command("mempool")
    .description("Show pending transactions")
    .option("-d, --database <path>", "Database file path", "data/blockchain.db")
    .action((options) => {
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
        console.error(
          chalk.red("❌ Mempool error:"),
          error instanceof Error ? error.message : error
        );
      }
    });

  return program;
}

async function main(): Promise<void> {
  try {
    showBanner();

    const program = createProgram();

    // Show help if no arguments provided
    if (process.argv.length <= 2) {
      program.help();
      return;
    }

    await program.parseAsync(process.argv);
  } catch (error) {
    console.error(
      chalk.red("❌ Error:"),
      error instanceof Error ? error.message : "Unknown error"
    );

    // Clean up blockchain connection if it exists
    if (blockchain) {
      blockchain.close();
    }

    process.exit(1);
  } finally {
    // Clean up blockchain connection
    if (blockchain) {
      blockchain.close();
    }
  }
}

// Run the CLI if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error(chalk.red("❌ Fatal error:"), error);
    process.exit(1);
  });
}

export { main };
