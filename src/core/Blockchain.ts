import chalk from "chalk";
import { Block } from "./Block";
import { Transaction, TransactionPool, UTXOSet, UTXO } from "./Transaction";
import { ProofOfWork } from "./ProofOfWork";
import { BlockchainDB } from "../storage/Database";
import { BlockchainStorage } from "../storage/BlockchainStorage";
import { TransactionValidator, ValidationResult } from "./TransactionValidator";

/**
 * Statistics about the current state of the blockchain.
 */
export interface ChainStats {
  totalBlocks: number;
  totalTransactions: number;
  currentDifficulty: number;
  averageBlockTime: number;
  hashRate: number;
  chainLength: number;
  latestBlockHash: string;
  totalValue: number;
}

export interface BlockchainConfig {
  genesisMessage?: string;
  initialDifficulty: number;
  blockReward: number;
}

/**
 * The main Blockchain class that manages the chain of blocks.
 * Implements global ordering, validation, and chain management.
 */
export class Blockchain {
  private blocks: Block[] = [];
  private readonly db: BlockchainDB | null;
  private readonly storage: BlockchainStorage | null;
  private readonly transactionPool: TransactionPool;
  private readonly utxoSet: UTXOSet;
  private readonly proofOfWork: ProofOfWork;
  private readonly config: BlockchainConfig;
  private readonly transactionValidator: TransactionValidator;

  /**
   * Creates a new blockchain instance.
   * @param config - Blockchain configuration
   * @param dbPath - Path to the SQLite database file
   */
  constructor(config: BlockchainConfig, dbPath?: string) {
    this.config = config;

    if (dbPath) {
      this.db = new BlockchainDB(dbPath);
      this.storage = new BlockchainStorage(this.db);
    } else {
      this.db = null;
      this.storage = null;
    }

    this.transactionPool = new TransactionPool();
    this.utxoSet = new UTXOSet();
    this.proofOfWork = new ProofOfWork();
    this.transactionValidator = new TransactionValidator(this.utxoSet);

    // Load existing blockchain from database or initialize with genesis block
    this.loadOrInitializeChain();

    // Restore persisted mempool (if any)
    this.restoreMempoolFromStorage();
  }

  // =============================================================================
  // PUBLIC API
  // =================================
  /**
   * Gets the blockchain configuration.
   * @returns The blockchain configuration
   */
  public getConfig(): BlockchainConfig {
    return { ...this.config }; // Return a copy to prevent external modification
  }

  /**
   * Gets the latest block in the chain.
   * @returns The most recent block
   */
  public getLatestBlock(): Block {
    return this.blocks[this.blocks.length - 1];
  }

  /**
   * Gets the entire blockchain.
   * @returns Array of all blocks in the chain
   */
  public getChain(): Block[] {
    return [...this.blocks]; // Return a copy to prevent external modification
  }

  /**
   * Validates the entire blockchain.
   * @returns True if the entire chain is valid
   */
  public validateChain(): boolean {
    for (let i = 1; i < this.blocks.length; i++) {
      const currentBlock = this.blocks[i];
      const previousBlock = this.blocks[i - 1];

      // Validate current block
      if (!currentBlock.isValid()) {
        console.log(`❌ Invalid block at index ${i}`);
        return false;
      }

      // Validate proof-of-work
      if (!this.proofOfWork.validateProofOfWork(currentBlock)) {
        console.log(`❌ Invalid proof-of-work at index ${i}`);
        return false;
      }

      // Validate chain linkage
      if (!currentBlock.isValidSuccessor(previousBlock)) {
        console.log(`❌ Broken chain linkage at index ${i}`);
        return false;
      }
    }
    return true;
  }

  /**
   * Gets the balance for a specific address.
   * @param address - The address to check
   * @returns The current balance
   */
  public getBalance(address: string): number {
    return this.utxoSet.getBalance(address);
  }

  /**
   * Gets all UTXOs for a specific address.
   * @param address - The address to get UTXOs for
   * @returns Array of unspent UTXOs
   */
  public getUTXOs(address: string) {
    return this.utxoSet.getUTXOsForAddress(address);
  }

  /**
   * Gets statistics about the blockchain.
   * @returns Chain statistics
   */
  public getStats(): ChainStats {
    const totalTransactions = this.blocks.reduce(
      (sum, block) => sum + block.getTransactionCount(),
      0
    );

    // Calculate average block time
    let averageBlockTime = 0;
    if (this.blocks.length > 1) {
      const timeSpan =
        this.getLatestBlock().timestamp - this.blocks[0].timestamp;
      averageBlockTime = timeSpan / (this.blocks.length - 1);
    }

    // Calculate total value in circulation
    const totalValue = this.blocks.reduce(
      (sum, block) => sum + block.getTotalOutputValue(),
      0
    );

    return {
      totalBlocks: this.blocks.length,
      totalTransactions,
      currentDifficulty: this.getLatestBlock().difficulty,
      averageBlockTime,
      hashRate: 0, // Would need recent mining data to calculate
      chainLength: this.blocks.length,
      latestBlockHash: this.getLatestBlock().hash,
      totalValue,
    };
  }

  /**
   * Gets the transaction pool.
   * @returns The current transaction pool
   */
  public getTransactionPool(): TransactionPool {
    return this.transactionPool;
  }

  /**
   * Gets the UTXO set.
   * @returns The current UTXO set
   */
  public getUTXOSet(): UTXOSet {
    return this.utxoSet;
  }

  /**
   * Creates a transaction for testing purposes.
   * @param fromAddress - Address sending funds (must have UTXOs)
   * @param toAddress - Address receiving funds
   * @param amount - Amount to send
   * @returns Created transaction or null if insufficient funds
   */
  public createTransaction(
    fromAddress: string,
    toAddress: string,
    amount: number
  ): Transaction | null {
    // Note: CLI layer logs the user-facing "creating transaction" message.

    // Get UTXOs for the sender
    const senderUTXOs = this.utxoSet.getUTXOsForAddress(fromAddress);

    if (senderUTXOs.length === 0) {
      console.log(`❌ No UTXOs found for address: ${fromAddress}`);
      return null;
    }

    // Calculate total available balance
    const totalBalance = senderUTXOs.reduce(
      (sum, utxo) => sum + utxo.amount,
      0
    );

    if (totalBalance < amount) {
      console.log(
        `❌ Insufficient balance: need ${amount}, have ${totalBalance}`
      );
      return null;
    }

    // Select UTXOs to spend (simple strategy: use first available)
    let selectedValue = 0;
    const inputUTXOs = [];

    for (const utxo of senderUTXOs) {
      inputUTXOs.push(utxo);
      selectedValue += utxo.amount;

      if (selectedValue >= amount) {
        break;
      }
    }

    // Create transaction inputs
    const inputs = inputUTXOs.map((utxo) => ({
      txId: utxo.txId,
      outputIndex: utxo.outputIndex,
    }));

    // Create transaction outputs
    const outputs = [
      { address: toAddress, amount }, // Payment to recipient
    ];

    // Add change output if necessary
    const change = selectedValue - amount;
    if (change > 0) {
      outputs.push({ address: fromAddress, amount: change }); // Change back to sender
    }

    const transaction = new Transaction(inputs, outputs);

    console.log(chalk.blue(`\n✅ Transaction created: ${transaction.id}`));
    console.log(`   Inputs (${inputs.length}):`);
    inputUTXOs.forEach((utxo, idx) => {
      console.log(
        `     [${idx}] txId=${utxo.txId.substring(0, 10)}..., outputIndex=${
          utxo.outputIndex
        }, address=${utxo.address}, amount=${utxo.amount}`
      );
    });
    console.log(`   Outputs (${outputs.length}):`);
    outputs.forEach((out, idx) => {
      const type = out.address === fromAddress ? "change" : "payment";
      console.log(
        `     [${idx}] to=${out.address}, amount=${out.amount} (${type})`
      );
    });

    return transaction;
  }

  /**
   * Demonstrates comprehensive double-spend prevention.
   * Creates a scenario and shows how the system prevents double-spending.
   * @returns Detailed demonstration results
   */
  public demonstrateDoubleSpendPrevention(options?: { quiet?: boolean }): {
    success: boolean;
    originalTx: Transaction | null;
    conflictingTx: Transaction | null;
    validationResults: {
      original: ValidationResult;
      conflicting: ValidationResult;
    } | null;
    scenario: string;
  } {
    const quiet = options?.quiet === true;
    if (!quiet) {
      console.log("🔬 Demonstrating comprehensive double-spend prevention...");
    }

    // Find an address with UTXOs for testing
    const allAddresses = this.getAllAddressesWithBalance();

    if (allAddresses.length === 0) {
      console.log(
        "❌ No addresses with balance found. Mine some blocks first."
      );
      return {
        success: false,
        originalTx: null,
        conflictingTx: null,
        validationResults: null,
        scenario: "No addresses with balance available for testing",
      };
    }

    const testAddress = allAddresses[0];
    const balance = this.getBalance(testAddress.address);

    if (!quiet) {
      console.log(
        `📝 Using test address: ${testAddress.address} (balance: ${balance})`
      );
    }

    // Create original legitimate transaction
    const originalTx = this.createTransaction(
      testAddress.address,
      "legitimate-recipient",
      Math.min(50, Math.floor(balance / 2)) // Send half of balance or 50, whichever is smaller
    );

    if (!originalTx) {
      return {
        success: false,
        originalTx: null,
        conflictingTx: null,
        validationResults: null,
        scenario: "Failed to create original transaction",
      };
    }

    if (!quiet) {
      console.log("📋 Scenario: Attempting to spend the same UTXOs twice");
    }

    // Add original transaction to blockchain (this should succeed)
    const originalValidation = this.addTransaction(originalTx);

    // Create conflicting transaction using the same inputs
    const conflictingTx = new Transaction(
      originalTx.inputs, // Same inputs = double-spend attempt!
      [
        {
          address: "attacker-address",
          amount: originalTx.getTotalOutputAmount(),
        },
      ]
    );

    console.log(
      chalk.yellow(`\n✅ Conflict Transaction created: ${conflictingTx.id}`)
    );

    if (!quiet) {
      console.log(
        `\n🚨 Attempting double-spend with transaction: ${conflictingTx.id}`
      );
    }

    // Try to add conflicting transaction (this should fail)
    const conflictingValidation = this.addTransaction(conflictingTx);

    // Analysis
    const preventionSuccessful =
      originalValidation.isValid && !conflictingValidation.isValid;

    if (!quiet) {
      console.log("\n📊 Double-Spend Prevention Analysis:");
      console.log(
        `   Original transaction valid: ${originalValidation.isValid}`
      );
      console.log(
        `   Conflicting transaction valid: ${conflictingValidation.isValid}`
      );
      console.log(
        `   Prevention successful: ${preventionSuccessful ? "✅ YES" : "❌ NO"}`
      );
      if (conflictingValidation.errors.length > 0) {
        console.log(
          `   Prevention mechanism: ${conflictingValidation.errors.join(", ")}`
        );
      }
    }

    return {
      success: preventionSuccessful,
      originalTx,
      conflictingTx,
      validationResults: {
        original: originalValidation,
        conflicting: conflictingValidation,
      },
      scenario: "Same UTXO spent in two different transactions",
    };
  }

  /**
   * Demonstrates chain tampering for educational purposes. This method is destructive
   * and should only be used in controlled demo environments.
   * @param blockIndex - Index of the block to tamper with
   * @param tamperedAmount - The amount to change a transaction to for the demo
   * @returns True if tampering was successfully applied to the in-memory chain.
   */
  public tamperBlockData(blockIndex: number, tamperedAmount = 500): boolean {
    if (blockIndex >= this.blocks.length || blockIndex <= 0) {
      console.log("❌ Invalid block index for tampering demonstration.");
      return false;
    }

    const blockToTamper = this.blocks[blockIndex];

    console.log(
      `   Original hash of block #${blockIndex}: ${blockToTamper.hash}`
    );

    const txToTamper = blockToTamper.transactions.find(
      (tx) => tx.outputs.length > 0 && !tx.isCoinbase()
    );

    let tamperedBlock;

    if (!txToTamper) {
      console.log(
        "   No suitable transaction to tamper with. Modifying timestamp as a fallback."
      );
      tamperedBlock = new Block(
        blockToTamper.index,
        blockToTamper.transactions,
        blockToTamper.previousHash,
        blockToTamper.nonce,
        blockToTamper.difficulty,
        blockToTamper.timestamp + 1000 // Modify timestamp
      );
    } else {
      console.log(
        `   Tampering with transaction ${txToTamper.id.substring(
          0,
          10
        )}... in block #${blockIndex}`
      );

      const tamperedTransactions = blockToTamper.transactions.map((tx) => {
        if (tx.id === txToTamper.id) {
          const tamperedOutputs = tx.outputs.map((o, i) =>
            i === 0 ? { ...o, amount: tamperedAmount } : o
          );
          return new Transaction(tx.inputs, tamperedOutputs, tx.timestamp);
        }
        return tx;
      });

      tamperedBlock = new Block(
        blockToTamper.index,
        tamperedTransactions,
        blockToTamper.previousHash,
        blockToTamper.nonce,
        blockToTamper.difficulty,
        blockToTamper.timestamp
      );
    }

    this.blocks[blockIndex] = tamperedBlock;
    console.log(
      `   New hash of tampered block #${blockIndex}: ${tamperedBlock.hash}`
    );

    return true;
  }

  /**
   * Adds a new block to the chain after validation.
   * @param block - The block to add
   * @returns True if the block was added successfully
   */
  public addBlock(block: Block): boolean {
    // Validate the block structure
    if (!block.isValid()) {
      console.log(`❌ Block ${block.index} failed structure validation`);
      return false;
    }

    // Validate proof-of-work
    if (!this.proofOfWork.validateProofOfWork(block)) {
      console.log(`❌ Block ${block.index} failed proof-of-work validation`);
      return false;
    }

    // Validate that it follows the previous block
    const previousBlock = this.getLatestBlock();
    if (!block.isValidSuccessor(previousBlock)) {
      console.log(`❌ Block ${block.index} is not a valid successor`);
      return false;
    }

    // Validate chronological ordering
    if (!this.validateChronologicalOrder(block)) {
      console.log(`❌ Block ${block.index} violates chronological ordering`);
      return false;
    }

    // Validate all transactions in the block
    if (!this.validateBlockTransactions(block)) {
      console.log(`❌ Block ${block.index} contains invalid transactions`);
      return false;
    }

    // Add the block to the chain
    this.blocks.push(block);

    // Save block to database
    if (this.storage) {
      if (!this.storage.saveBlock(block)) {
        // Rollback if database save fails
        this.blocks.pop();
        console.log(
          `❌ Failed to save block ${block.index} to database, rolling back`
        );
        return false;
      }
    }

    // Update UTXO set
    this.updateUTXOSet(block);

    // Remove included transactions from the pool
    this.removeTransactionsFromPool(block);

    // Update chain state in database
    if (this.storage) {
      this.storage.saveChainState("chain_tip", block.hash);
      this.storage.saveChainState(
        "chain_length",
        this.blocks.length.toString()
      );
    }

    console.log(
      chalk.green(
        `✅ Block ${block.index} added to chain and saved to database`
      )
    );

    return true;
  }

  /**
   * Mines a new block with pending transactions.
   * @param minerAddress - Address to receive the mining reward
   * @returns The mined block, or null if mining failed
   */
  public async mineBlock(
    minerAddress: string,
    overrideTimestamp?: number
  ): Promise<Block | null> {
    // Create coinbase transaction (mining reward)
    const coinbaseTransaction = Transaction.createCoinbase(
      minerAddress,
      this.config.blockReward
    );

    // Select transactions from the pool
    const pendingTransactions =
      this.transactionPool.selectTransactionsForBlock(10);

    // Include coinbase transaction at the beginning
    const blockTransactions = [coinbaseTransaction, ...pendingTransactions];

    // Calculate next difficulty
    const currentDifficulty = this.calculateNextDifficulty();

    // Create candidate block with a timestamp strictly greater than the previous block
    const previousBlock = this.getLatestBlock();
    const candidateTimestamp =
      overrideTimestamp ?? Math.max(Date.now(), previousBlock.timestamp + 1);
    const candidateBlock = new Block(
      previousBlock.index + 1,
      blockTransactions,
      previousBlock.hash,
      0,
      currentDifficulty,
      candidateTimestamp
    );

    console.log(
      chalk.blue(
        `\n📦 Mining block #${candidateBlock.index} with ${blockTransactions.length} transactions`
      )
    );

    console.log(`💳 Transactions:`);
    // Log a concise, one-line summary for each transaction included in the block
    for (let i = 0; i < blockTransactions.length; i++) {
      const tx = blockTransactions[i];
      const isCoinbase = tx.inputs.length === 0;
      const totalAmount = tx.getTotalOutputAmount();

      // Derive sender addresses from referenced UTXOs (if not coinbase)
      let fromAddresses = "coinbase";
      if (!isCoinbase) {
        const allUTXOs = this.utxoSet.getAllUTXOs();
        const froms = tx.inputs.map((input) => {
          const utxo = allUTXOs.find(
            (u) => u.txId === input.txId && u.outputIndex === input.outputIndex
          );
          return utxo ? utxo.address : "unknown";
        });
        const uniqueFroms = Array.from(new Set(froms));
        fromAddresses = uniqueFroms.join("+") || "unknown";
      }

      // Recipient addresses and amounts
      const toField = tx.outputs.map((o) => `${o.address}`);

      const txType = isCoinbase ? "coinbase" : "payment";
      console.log(
        `   [${i}] from=${fromAddresses}, to=${toField}, amount=${totalAmount}, type=${txType}`
      );
    }

    // Mine the block
    const minedBlock = await this.proofOfWork.mineBlock(candidateBlock);

    if (minedBlock) {
      // Add the mined block to the chain
      if (this.addBlock(minedBlock)) {
        return minedBlock;
      }
    }

    return null;
  }

  /**
   * Adds a transaction to the transaction pool with comprehensive validation.
   * @param transaction - The transaction to add
   * @returns ValidationResult with detailed feedback
   */
  public addTransaction(transaction: Transaction): ValidationResult {
    console.log(`🔍 Validating transaction: ${transaction.id}`);

    // Comprehensive validation including double-spend checks
    const validationResult =
      this.transactionValidator.validateTransaction(transaction);

    if (validationResult.isValid) {
      // Add to transaction pool
      const added = this.transactionPool.addTransaction(transaction);
      if (added) {
        // Add to validator's mempool for conflict detection
        this.transactionValidator.addToMempool(transaction);
        console.log(`✅ Transaction added to pool: ${transaction.id}`);

        // Persist to mempool storage so it survives CLI process exits
        if (this.storage) {
          this.storage.saveMempoolTransaction(
            transaction.id,
            transaction.timestamp,
            transaction.serialize()
          );
        }

        // Log any warnings
        if (validationResult.warnings.length > 0) {
          console.log(`⚠️  Warnings: ${validationResult.warnings.join(", ")}`);
        }
      } else {
        validationResult.isValid = false;
        validationResult.errors.push("Failed to add transaction to pool");
      }
    } else {
      console.log(`❌ Transaction rejected: ${transaction.id}`);
      console.log(`   Errors: ${validationResult.errors.join(", ")}`);
    }

    return validationResult;
  }

  /**
   * Gets the blockchain storage instance for direct access.
   * @returns The blockchain storage instance
   */
  public getStorage(): BlockchainStorage {
    if (!this.storage) {
      throw new Error("Storage is not available for an in-memory blockchain.");
    }
    return this.storage;
  }

  /**
   * Closes the database connection.
   */
  public close(): void {
    if (this.db) {
      this.db.close();
    }
  }

  // =============================================================================
  // PRIVATE METHODS
  // =============================================================================

  /**
   * Loads the blockchain from the database or creates a new one with a genesis block.
   */
  private loadOrInitializeChain(): void {
    if (this.storage) {
      const loadedBlocks = this.storage.loadBlocks();

      if (loadedBlocks.length > 0) {
        this.blocks = loadedBlocks;
        this.reconstructUTXOSetFromDatabase();

        // Load configuration from database if it exists, otherwise save current config
        this.loadOrSaveConfig();

        if (!this.validateChain()) {
          console.error("❌ Loaded blockchain is invalid! Starting fresh.");
          this.blocks = [];
          this.utxoSet.clear();
          this.createGenesisBlock();
        } else {
          this.storage.saveChainState("chain_tip", this.getLatestBlock().hash);
          this.storage.saveChainState(
            "chain_length",
            this.blocks.length.toString()
          );
          console.log(
            chalk.green(
              `✅ Blockchain loaded from database with ${this.blocks.length} blocks.`
            )
          );
        }
      } else {
        this.createGenesisBlock();
        // Save the configuration when creating a new blockchain
        this.saveConfig();
      }
    } else {
      this.createGenesisBlock();
    }
  }

  /**
   * Loads configuration from database, or saves current config if none exists.
   */
  private loadOrSaveConfig(): void {
    if (!this.storage) return;

    const savedBlockReward = this.storage.loadChainState("block_reward");
    const savedDifficulty = this.storage.loadChainState("initial_difficulty");
    const savedGenesisMessage = this.storage.loadChainState("genesis_message");

    if (savedBlockReward && savedDifficulty) {
      // Update config with saved values (cast as any to modify readonly)
      (this.config as any).blockReward = parseFloat(savedBlockReward);
      (this.config as any).initialDifficulty = parseInt(savedDifficulty);
      if (savedGenesisMessage) {
        (this.config as any).genesisMessage = savedGenesisMessage;
      }
    } else {
      // Save current config to database
      this.saveConfig();
    }
  }

  /**
   * Saves the current configuration to the database.
   */
  private saveConfig(): void {
    if (!this.storage) return;

    this.storage.saveChainState(
      "block_reward",
      this.config.blockReward.toString()
    );
    this.storage.saveChainState(
      "initial_difficulty",
      this.config.initialDifficulty.toString()
    );
    if (this.config.genesisMessage) {
      this.storage.saveChainState(
        "genesis_message",
        this.config.genesisMessage
      );
    }
  }

  /**
   * Restores the in-memory mempool from persisted database entries.
   */
  private restoreMempoolFromStorage(): void {
    if (!this.storage) return;
    try {
      const rows = this.storage.loadMempoolTransactions();
      if (!rows || rows.length === 0) return;

      for (const row of rows) {
        try {
          const tx = Transaction.deserialize(row.serialized);
          const validation = this.transactionValidator.validateTransaction(tx);
          if (validation.isValid) {
            this.transactionPool.addTransaction(tx);
            this.transactionValidator.addToMempool(tx);
          } else {
            // Drop invalid/stale entry
            this.storage.deleteMempoolTransaction(row.id);
          }
        } catch (e) {
          this.storage.deleteMempoolTransaction(row.id);
        }
      }
    } catch {}
  }

  /**
   * Creates and saves the genesis block.
   */
  private createGenesisBlock(): void {
    const genesisBlock = Block.createGenesis(this.config.genesisMessage);
    this.blocks.push(genesisBlock);
    this.updateUTXOSet(genesisBlock);

    // Save genesis block to database
    if (this.storage) {
      this.storage.saveBlock(genesisBlock);
      this.storage.saveChainState("chain_tip", genesisBlock.hash);
      this.storage.saveChainState("chain_length", "1");
      this.storage.saveChainState("genesis_hash", genesisBlock.hash);
    }

    console.log("🎉 Genesis block created and saved");
    console.log(`   Hash: ${genesisBlock.hash}`);
  }

  /**
   * Reconstructs the UTXO set from the database.
   */
  private reconstructUTXOSetFromDatabase(): void {
    if (!this.storage) return;
    this.utxoSet.clear();
    const loadedUTXOs = this.storage.loadUTXOs();

    for (const utxo of loadedUTXOs) {
      this.utxoSet.addUTXO(utxo);
    }
  }

  /**
   * Validates that a block maintains chronological ordering.
   * @param block - The block to validate
   * @returns True if chronological ordering is maintained
   */
  private validateChronologicalOrder(block: Block): boolean {
    const previousBlock = this.getLatestBlock();

    // Check timestamp is after previous block
    if (block.timestamp <= previousBlock.timestamp) {
      console.log(
        `❌ Block timestamp ${block.timestamp} not after previous ${previousBlock.timestamp}`
      );
      return false;
    }

    // Check timestamp is not too far in the future (max 2 hours)
    const maxFutureTime = Date.now() + 2 * 60 * 60 * 1000;
    if (block.timestamp > maxFutureTime) {
      console.log(`❌ Block timestamp ${block.timestamp} too far in future`);
      return false;
    }

    // Check sequential block index
    if (block.index !== previousBlock.index + 1) {
      console.log(
        `❌ Block index ${block.index} not sequential after ${previousBlock.index}`
      );
      return false;
    }

    return true;
  }

  /**
   * Validates all transactions in a block.
   * @param block - The block to validate
   * @returns True if all transactions are valid
   */
  private validateBlockTransactions(block: Block): boolean {
    for (const transaction of block.transactions) {
      // Validate transaction structure
      if (!transaction.isValid()) {
        console.log(`❌ Invalid transaction structure: ${transaction.id}`);
        return false;
      }

      // Check that transaction inputs reference valid UTXOs
      if (!this.utxoSet.canSpendTransaction(transaction)) {
        console.log(
          `❌ Transaction references invalid UTXOs: ${transaction.id}`
        );
        return false;
      }
    }

    return true;
  }

  /**
   * Updates the UTXO set based on a new block.
   * @param block - The block to process
   */
  private updateUTXOSet(block: Block): void {
    for (const transaction of block.transactions) {
      // Spend UTXOs referenced by inputs
      for (const input of transaction.inputs) {
        this.utxoSet.spendUTXO(input.txId, input.outputIndex, transaction.id);
        // Also mark as spent in database
        if (this.storage) {
          this.storage.markUTXOSpent(
            input.txId,
            input.outputIndex,
            transaction.id
          );
        }
      }

      // Add new UTXOs from outputs
      transaction.outputs.forEach((output, index) => {
        const utxo = new UTXO(
          transaction.id,
          index,
          output.address,
          output.amount,
          false
        );
        this.utxoSet.addUTXO(utxo);
      });
    }
  }

  /**
   * Removes transactions from the pool that are included in a block.
   * @param block - The block containing transactions to remove
   */
  private removeTransactionsFromPool(block: Block): void {
    for (const transaction of block.transactions) {
      this.transactionPool.removeTransaction(transaction.id);
      this.transactionValidator.removeFromMempool(transaction.id);
      // Also remove from persisted mempool store
      if (this.storage) {
        this.storage.deleteMempoolTransaction(transaction.id);
      }
    }
  }

  /**
   * Calculates the difficulty for the next block.
   * @returns The appropriate difficulty level
   */
  private calculateNextDifficulty(): number {
    const latestBlock = this.getLatestBlock();

    // For the block right after genesis, use the configured initial difficulty.
    if (latestBlock.index === 0) {
      return this.config.initialDifficulty;
    }

    // For all other blocks, use the dynamic adjustment logic.
    const currentDifficulty = latestBlock.difficulty;
    return this.proofOfWork.calculateNextDifficulty(
      this.blocks,
      currentDifficulty
    );
  }

  /**
   * Gets all addresses that have a positive balance.
   * @returns Array of addresses with their balances
   */
  private getAllAddressesWithBalance(): Array<{
    address: string;
    balance: number;
  }> {
    const addressBalances = new Map<string, number>();

    // We need to iterate through all blocks to find all addresses
    for (const block of this.blocks) {
      for (const transaction of block.transactions) {
        for (const output of transaction.outputs) {
          const currentBalance = addressBalances.get(output.address) || 0;
          addressBalances.set(output.address, currentBalance);
        }
      }
    }

    // Calculate actual balances
    const result = [];
    const addresses = Array.from(addressBalances.keys());
    for (const address of addresses) {
      const balance = this.getBalance(address);
      if (balance > 0) {
        result.push({ address, balance });
      }
    }

    return result.sort((a, b) => b.balance - a.balance); // Sort by balance descending
  }
}
