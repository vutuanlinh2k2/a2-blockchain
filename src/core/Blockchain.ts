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

/**
 * Configuration for the blockchain.
 */
export interface BlockchainConfig {
  genesisMessage?: string;
  initialDifficulty?: number;
  maxBlockSize?: number;
  blockReward?: number;
  minerAddress: string;
}

export interface ResolvedBlockchainConfig {
  genesisMessage?: string;
  initialDifficulty: number;
  maxBlockSize: number;
  blockReward: number;
  minerAddress: string;
}

/**
 * The main Blockchain class that manages the chain of blocks.
 * Implements global ordering, validation, and chain management.
 */
export class Blockchain {
  private blocks: Block[] = [];
  private readonly db: BlockchainDB;
  private readonly storage: BlockchainStorage;
  private readonly transactionPool: TransactionPool;
  private readonly utxoSet: UTXOSet;
  private readonly proofOfWork: ProofOfWork;
  private readonly config: ResolvedBlockchainConfig;
  private readonly transactionValidator: TransactionValidator;

  /**
   * Creates a new blockchain instance.
   * @param config - Blockchain configuration
   * @param dbPath - Path to the SQLite database file
   */
  constructor(config: BlockchainConfig, dbPath?: string) {
    this.config = {
      ...config,
      initialDifficulty: config.initialDifficulty ?? 4,
      maxBlockSize: config.maxBlockSize ?? 1000000, // 1MB
      blockReward: config.blockReward ?? 50,
    } as ResolvedBlockchainConfig;

    this.db = new BlockchainDB(dbPath);
    this.storage = new BlockchainStorage(this.db);
    this.transactionPool = new TransactionPool();
    this.utxoSet = new UTXOSet();
    this.proofOfWork = new ProofOfWork();
    this.transactionValidator = new TransactionValidator(this.utxoSet);

    // Load existing blockchain from database or initialize with genesis block
    this.initializeChain();

    // Restore persisted mempool (if any)
    this.restoreMempoolFromStorage();
  }

  /**
   * Initializes the blockchain by loading from database or creating genesis block.
   */
  private initializeChain(): void {
    console.log("🔄 Initializing blockchain...");

    // Try to load existing blockchain from database
    const loadedBlocks = this.storage.loadBlocks();

    if (loadedBlocks.length > 0) {
      console.log(
        `📖 Loaded existing blockchain with ${loadedBlocks.length} blocks`
      );
      this.blocks = loadedBlocks;

      // Reconstruct UTXO set from database
      this.reconstructUTXOSetFromDatabase();

      // Validate the loaded chain
      if (!this.validateChain()) {
        console.error("❌ Loaded blockchain is invalid! Starting fresh.");
        this.blocks = [];
        this.utxoSet.clear();
        this.createGenesisBlock();
      } else {
        console.log("✅ Loaded blockchain validated successfully\n");

        // Save chain tip to state
        this.storage.saveChainState("chain_tip", this.getLatestBlock().hash);
        this.storage.saveChainState(
          "chain_length",
          this.blocks.length.toString()
        );
      }
    } else {
      console.log("📝 No existing blockchain found, creating genesis block");
      this.createGenesisBlock();
    }
  }

  /**
   * Restores the in-memory mempool from persisted database entries.
   */
  private restoreMempoolFromStorage(): void {
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
    this.storage.saveBlock(genesisBlock);
    this.storage.saveChainState("chain_tip", genesisBlock.hash);
    this.storage.saveChainState("chain_length", "1");
    this.storage.saveChainState("genesis_hash", genesisBlock.hash);

    console.log("🎉 Genesis block created and saved");
    console.log(`   Hash: ${genesisBlock.hash}`);
  }

  /**
   * Reconstructs the UTXO set from the database.
   */
  private reconstructUTXOSetFromDatabase(): void {
    console.log("🔄 Reconstructing UTXO set from database...");

    this.utxoSet.clear();
    const loadedUTXOs = this.storage.loadUTXOs();

    for (const utxo of loadedUTXOs) {
      this.utxoSet.addUTXO(utxo);
    }

    console.log(`💰 Reconstructed UTXO set with ${loadedUTXOs.length} UTXOs`);
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
    if (!this.storage.saveBlock(block)) {
      // Rollback if database save fails
      this.blocks.pop();
      console.log(
        `❌ Failed to save block ${block.index} to database, rolling back`
      );
      return false;
    }

    // Update UTXO set
    this.updateUTXOSet(block);

    // Remove included transactions from the pool
    this.removeTransactionsFromPool(block);

    // Update chain state in database
    this.storage.saveChainState("chain_tip", block.hash);
    this.storage.saveChainState("chain_length", this.blocks.length.toString());

    console.log(`✅ Block ${block.index} added to chain and saved to database`);

    return true;
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
        this.storage.markUTXOSpent(
          input.txId,
          input.outputIndex,
          transaction.id
        );
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
      this.storage.deleteMempoolTransaction(transaction.id);
    }
  }

  /**
   * Mines a new block with pending transactions.
   * @param minerAddress - Address to receive the mining reward
   * @returns The mined block, or null if mining failed
   */
  public async mineBlock(minerAddress: string): Promise<Block | null> {
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

    // Create candidate block
    const candidateBlock = this.proofOfWork.createMiningCandidate(
      this.getLatestBlock().index + 1,
      blockTransactions,
      this.getLatestBlock().hash,
      currentDifficulty
    );

    console.log(
      chalk.blue(
        `\n📦 Mining block #${candidateBlock.index} with ${blockTransactions.length} transactions`
      )
    );

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
        `   tx#${i}, from=${fromAddresses}, to=${toField}, amount=${totalAmount}, type=${txType}`
      );
    }

    // Mine the block
    const progressReporter = this.proofOfWork.createProgressReporter();
    const minedBlock = await this.proofOfWork.mineBlock(
      candidateBlock,
      progressReporter
    );

    if (minedBlock) {
      // Add the mined block to the chain
      if (this.addBlock(minedBlock)) {
        return minedBlock;
      }
    }

    return null;
  }

  /**
   * Calculates the difficulty for the next block.
   * @returns The appropriate difficulty level
   */
  private calculateNextDifficulty(): number {
    const currentDifficulty = this.getLatestBlock().difficulty;
    return this.proofOfWork.calculateNextDifficulty(
      this.blocks,
      currentDifficulty
    );
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
        this.storage.saveMempoolTransaction(
          transaction.id,
          transaction.timestamp,
          transaction.serialize()
        );

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
   * Gets the latest block in the chain.
   * @returns The most recent block
   */
  public getLatestBlock(): Block {
    return this.blocks[this.blocks.length - 1];
  }

  /**
   * Gets a block by its hash.
   * @param hash - The block hash
   * @returns The block if found, undefined otherwise
   */
  // TODO: no references for now
  public getBlockByHash(hash: string): Block | undefined {
    return this.blocks.find((block) => block.hash === hash);
  }

  /**
   * Gets the entire blockchain.
   * @returns Array of all blocks in the chain
   */
  public getChain(): Block[] {
    return [...this.blocks]; // Return a copy to prevent external modification
  }

  /**
   * Gets the length of the blockchain.
   * @returns The number of blocks in the chain
   */
  // TODO: no references for now
  public getChainLength(): number {
    return this.blocks.length;
  }

  /**
   * Implements the longest chain rule by comparing and potentially switching to a longer valid chain.
   * @param alternativeChain - The alternative chain to compare against
   * @returns True if the chain was reorganized, false otherwise
   */
  public considerChainReorganization(alternativeChain: Block[]): boolean {
    console.log("🔀 Considering chain reorganization...");
    console.log(`   Current chain: ${this.blocks.length} blocks`);
    console.log(`   Alternative chain: ${alternativeChain.length} blocks`);

    // Longest chain rule: only consider longer chains
    if (alternativeChain.length <= this.blocks.length) {
      console.log(
        "   ❌ Alternative chain is not longer, keeping current chain"
      );
      return false;
    }

    // Validate the entire alternative chain
    if (!this.validateAlternativeChain(alternativeChain)) {
      console.log("   ❌ Alternative chain is invalid, keeping current chain");
      return false;
    }

    // Find the common ancestor
    const forkPoint = this.findForkPoint(alternativeChain);
    console.log(`   🍴 Fork point found at block ${forkPoint}`);

    // Store the original chain for potential rollback
    const originalChain = [...this.blocks];

    try {
      // Perform chain reorganization
      console.log("   🔄 Performing chain reorganization...");

      // Rollback to fork point
      this.rollbackToBlock(forkPoint);

      // Apply blocks from alternative chain after fork point
      for (let i = forkPoint + 1; i < alternativeChain.length; i++) {
        const block = alternativeChain[i];

        // Add block without full validation since we already validated the chain
        this.blocks.push(block);
        this.updateUTXOSet(block);
        this.removeTransactionsFromPool(block);
      }

      console.log("   ✅ Chain reorganization successful!");
      console.log(`   New chain length: ${this.blocks.length} blocks`);
      return true;
    } catch (error) {
      // Rollback to original state on error
      console.log("   ❌ Chain reorganization failed, rolling back...");
      this.blocks = originalChain;
      this.rebuildUTXOSet();
      return false;
    }
  }

  /**
   * Validates an alternative blockchain without modifying the current state.
   * @param chain - The chain to validate
   * @returns True if the chain is valid
   */
  private validateAlternativeChain(chain: Block[]): boolean {
    if (chain.length === 0) {
      return false;
    }

    // Validate genesis block matches
    if (chain[0].hash !== this.blocks[0].hash) {
      console.log("   ❌ Genesis block mismatch");
      return false;
    }

    // Validate each block in the chain
    for (let i = 1; i < chain.length; i++) {
      const currentBlock = chain[i];
      const previousBlock = chain[i - 1];

      // Validate block structure
      if (!currentBlock.isValid()) {
        console.log(`   ❌ Invalid block structure at index ${i}`);
        return false;
      }

      // Validate proof-of-work
      if (!this.proofOfWork.validateProofOfWork(currentBlock)) {
        console.log(`   ❌ Invalid proof-of-work at index ${i}`);
        return false;
      }

      // Validate chain linkage
      if (!currentBlock.isValidSuccessor(previousBlock)) {
        console.log(`   ❌ Broken chain linkage at index ${i}`);
        return false;
      }
    }

    return true;
  }

  /**
   * Finds the fork point between the current chain and an alternative chain.
   * @param alternativeChain - The alternative chain to compare
   * @returns The index of the last common block
   */
  private findForkPoint(alternativeChain: Block[]): number {
    const minLength = Math.min(this.blocks.length, alternativeChain.length);

    for (let i = 0; i < minLength; i++) {
      if (this.blocks[i].hash !== alternativeChain[i].hash) {
        return i - 1; // Return the last common block
      }
    }

    return minLength - 1;
  }

  /**
   * Rolls back the chain to a specific block index.
   * @param blockIndex - The index to roll back to
   */
  private rollbackToBlock(blockIndex: number): void {
    if (blockIndex < 0 || blockIndex >= this.blocks.length) {
      throw new Error(`Invalid rollback index: ${blockIndex}`);
    }

    console.log(
      `   ⏪ Rolling back from block ${this.blocks.length - 1} to ${blockIndex}`
    );

    // Remove blocks after the rollback point
    this.blocks = this.blocks.slice(0, blockIndex + 1);

    // Rebuild UTXO set from the remaining chain
    this.rebuildUTXOSet();
  }

  /**
   * Rebuilds the UTXO set from the current blockchain state.
   */
  private rebuildUTXOSet(): void {
    console.log("   🔄 Rebuilding UTXO set...");

    this.utxoSet.clear();

    // Process each block to rebuild UTXO set
    for (const block of this.blocks) {
      this.updateUTXOSet(block);
    }

    console.log(`   ✅ UTXO set rebuilt: ${this.utxoSet.size()} UTXOs`);
  }

  /**
   * Validates the entire blockchain.
   * @returns True if the entire chain is valid
   */
  public validateChain(): boolean {
    console.log("🔍 Validating entire blockchain...");

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

    console.log("✅ Blockchain validation successful");
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

    console.log(`✅ Transaction created: ${transaction.id}`);
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
  public demonstrateDoubleSpendPrevention(): {
    success: boolean;
    originalTx: Transaction | null;
    conflictingTx: Transaction | null;
    validationResults: {
      original: ValidationResult;
      conflicting: ValidationResult;
    } | null;
    scenario: string;
  } {
    console.log("🔬 Demonstrating comprehensive double-spend prevention...");

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

    console.log(
      `📝 Using test address: ${testAddress.address} (balance: ${balance})`
    );

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

    console.log("📋 Scenario: Attempting to spend the same UTXOs twice");

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
      `🚨 Attempting double-spend with transaction: ${conflictingTx.id}`
    );

    // Try to add conflicting transaction (this should fail)
    const conflictingValidation = this.addTransaction(conflictingTx);

    // Analysis
    const preventionSuccessful =
      originalValidation.isValid && !conflictingValidation.isValid;

    console.log("\n📊 Double-Spend Prevention Analysis:");
    console.log(`   Original transaction valid: ${originalValidation.isValid}`);
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

  /**
   * Demonstrates multiple double-spend attack scenarios.
   * @returns Array of demonstration results
   */
  public demonstrateMultipleDoubleSpendScenarios(): Array<{
    scenario: string;
    result: {
      success: boolean;
      originalTx?: Transaction | null;
      conflictingTx?: Transaction | null;
      validationResults?: {
        original: ValidationResult;
        conflicting: ValidationResult;
      } | null;
      tx1Valid?: boolean;
      tx2Valid?: boolean;
      conflictDetected?: boolean;
      errors?: string[];
    } & { scenario?: string };
  }> {
    console.log("🔬 Running comprehensive double-spend attack scenarios...");

    const scenarios = [];

    // Scenario 1: Basic same-UTXO double spend
    console.log("\n📋 Scenario 1: Basic same-UTXO double spend");
    scenarios.push({
      scenario: "Basic same-UTXO double spend",
      result: this.demonstrateDoubleSpendPrevention(),
    });

    // Scenario 2: Demonstrate transaction pool conflict detection
    console.log("\n📋 Scenario 2: Transaction pool conflict detection");
    const addresses = this.getAllAddressesWithBalance();
    if (addresses.length > 0) {
      const testAddress = addresses[0];
      const tx1 = this.createTransaction(testAddress.address, "recipient1", 10);
      const tx2 = this.createTransaction(testAddress.address, "recipient2", 20);

      if (tx1 && tx2) {
        // Make tx2 conflict with tx1 by using same inputs
        const conflictingTx2 = new Transaction(tx1.inputs, tx2.outputs);

        const validation1 = this.addTransaction(tx1);
        const validation2 = this.addTransaction(conflictingTx2);

        scenarios.push({
          scenario: "Transaction pool conflict detection",
          result: {
            success: !validation2.isValid, // Success means conflict was detected (second tx was rejected)
            tx1Valid: validation1.isValid,
            tx2Valid: validation2.isValid,
            conflictDetected: !validation2.isValid,
            errors: validation2.errors,
          },
        });
      }
    }

    // Print summary
    console.log("\n📊 Double-Spend Prevention Summary:");
    scenarios.forEach((scenario, index) => {
      console.log(
        `   ${index + 1}. ${scenario.scenario}: ${scenario.result.success !== false ? "✅ PREVENTED" : "❌ FAILED"}`
      );
    });

    return scenarios;
  }

  /**
   * Demonstrates chain reorganization for educational purposes.
   * Creates a fork scenario and shows how the longest chain rule works.
   * @returns True if reorganization was demonstrated successfully
   */
  public demonstrateChainReorganization(): boolean {
    console.log("🔬 Demonstrating chain reorganization...");

    if (this.blocks.length < 2) {
      console.log("❌ Need at least 2 blocks to demonstrate reorganization");
      return false;
    }

    // Store original chain
    const originalChain = [...this.blocks];

    try {
      // Create an alternative chain that's longer
      console.log("   📝 Creating alternative chain...");

      // Start from the second block to create a fork
      const forkPoint = 1;
      const alternativeChain = [
        this.blocks[0], // Genesis block
        this.blocks[1], // Common block
      ];

      // Add two more blocks to make it longer
      for (let i = 0; i < 2; i++) {
        const minerAddress = "demo-miner";
        const coinbaseTransaction = Transaction.createCoinbase(
          minerAddress,
          50
        );

        const newBlock = new Block(
          alternativeChain.length,
          [coinbaseTransaction],
          alternativeChain[alternativeChain.length - 1].hash,
          0, // We'll set a simple nonce for demo
          1 // Low difficulty for quick demo
        );

        alternativeChain.push(newBlock);
      }

      console.log(
        `   🔗 Alternative chain created with ${alternativeChain.length} blocks`
      );

      // Test reorganization
      const reorganized = this.considerChainReorganization(alternativeChain);

      // Restore original chain for demonstration
      this.blocks = originalChain;
      this.rebuildUTXOSet();

      if (reorganized) {
        console.log("✅ Chain reorganization demonstration successful!");
        return true;
      } else {
        console.log(
          "⚠️  Chain reorganization was not performed (expected behavior)"
        );
        return false;
      }
    } catch (error) {
      // Restore original chain on error
      this.blocks = originalChain;
      this.rebuildUTXOSet();
      console.log("❌ Chain reorganization demonstration failed:", error);
      return false;
    }
  }

  /**
   * Demonstrates chain tampering for educational purposes.
   * @param blockIndex - Index of the block to tamper with
   * @returns True if tampering was detected
   */
  public demonstrateTampering(blockIndex: number): boolean {
    if (blockIndex >= this.blocks.length || blockIndex < 0) {
      console.log("❌ Invalid block index for tampering demonstration");
      return false;
    }

    console.log("🔬 Demonstrating blockchain tampering detection...");
    console.log(`   Targeting block #${blockIndex}`);

    // Store original state
    const originalChain = this.getChain();
    const originalBlock = this.blocks[blockIndex];

    console.log(`   Original hash: ${originalBlock.hash}`);

    // Tamper with the block (modify timestamp)
    const tamperedBlock = new Block(
      originalBlock.index,
      originalBlock.transactions,
      originalBlock.previousHash,
      originalBlock.nonce,
      originalBlock.difficulty,
      originalBlock.timestamp + 1000 // Modify timestamp
    );

    // Replace the block temporarily
    this.blocks[blockIndex] = tamperedBlock;

    console.log(`   Tampered hash: ${tamperedBlock.hash}`);

    // Validate the chain to detect tampering
    const isValid = this.validateChain();

    // Restore original chain
    this.blocks = originalChain;

    if (!isValid) {
      console.log("✅ Tampering successfully detected!");
      console.log("   Chain validation failed as expected");
      return true;
    } else {
      console.log("❌ Tampering detection failed!");
      return false;
    }
  }

  /**
   * Exports the entire blockchain to a file.
   * @param filePath - Path where to save the backup file
   * @returns True if export was successful
   */
  public exportToFile(filePath: string): boolean {
    console.log(`📤 Exporting blockchain to ${filePath}...`);
    const success = this.storage.exportToFile(filePath);
    if (success) {
      console.log("✅ Blockchain export completed successfully");
    } else {
      console.log("❌ Blockchain export failed");
    }
    return success;
  }

  /**
   * Imports blockchain data from a file.
   * WARNING: This will replace the current blockchain!
   * @param filePath - Path to the backup file to import
   * @returns True if import was successful
   */
  public importFromFile(filePath: string): boolean {
    console.log(`📥 Importing blockchain from ${filePath}...`);
    console.log("⚠️  WARNING: This will replace the current blockchain!");

    const success = this.storage.importFromFile(filePath);
    if (success) {
      // Reload the blockchain from database
      console.log("🔄 Reloading blockchain from database...");
      this.initializeChain();
      console.log("✅ Blockchain import and reload completed successfully");
    } else {
      console.log("❌ Blockchain import failed");
    }
    return success;
  }

  /**
   * Gets comprehensive statistics about the blockchain including database stats.
   * @returns Extended chain statistics
   */
  public getExtendedStats(): ChainStats & {
    databaseStats: {
      blockCount: number;
      transactionCount: number;
      utxoCount: number;
      spentUtxoCount: number;
      chainStateCount: number;
    };
    chainState: {
      tip: string | null;
      length: string | null;
      genesisHash: string | null;
    };
  } {
    const basicStats = this.getStats();
    const databaseStats = this.storage.getDatabaseStats();

    const chainState = {
      tip: this.storage.loadChainState("chain_tip"),
      length: this.storage.loadChainState("chain_length"),
      genesisHash: this.storage.loadChainState("genesis_hash"),
    };

    return {
      ...basicStats,
      databaseStats,
      chainState,
    };
  }

  /**
   * Validates chain integrity against database.
   * @returns True if both in-memory and database state are consistent
   */
  public validatePersistenceIntegrity(): boolean {
    console.log("🔍 Validating persistence integrity...");

    try {
      // Check that in-memory blocks match database
      const dbBlocks = this.storage.loadBlocks();

      if (dbBlocks.length !== this.blocks.length) {
        console.log(
          `❌ Block count mismatch: memory=${this.blocks.length}, db=${dbBlocks.length}`
        );
        return false;
      }

      for (let i = 0; i < this.blocks.length; i++) {
        const memoryBlock = this.blocks[i];
        const dbBlock = dbBlocks[i];

        if (memoryBlock.hash !== dbBlock.hash) {
          console.log(
            `❌ Block ${i} hash mismatch: memory=${memoryBlock.hash}, db=${dbBlock.hash}`
          );
          return false;
        }
      }

      // Check UTXO set consistency
      const dbUTXOs = this.storage.loadUTXOs();
      const memoryUTXOCount = this.utxoSet.size();

      if (dbUTXOs.length !== memoryUTXOCount) {
        console.log(
          `❌ UTXO count mismatch: memory=${memoryUTXOCount}, db=${dbUTXOs.length}`
        );
        return false;
      }

      // Check chain state
      const dbChainLength = this.storage.loadChainState("chain_length");
      const actualLength = this.blocks.length.toString();

      if (dbChainLength !== actualLength) {
        console.log(
          `❌ Chain length mismatch: memory=${actualLength}, db=${dbChainLength}`
        );
        return false;
      }

      console.log("✅ Persistence integrity validation passed");
      return true;
    } catch (error) {
      console.error("❌ Persistence integrity validation failed:", error);
      return false;
    }
  }

  /**
   * Gets the blockchain storage instance for direct access.
   * @returns The blockchain storage instance
   */
  public getStorage(): BlockchainStorage {
    return this.storage;
  }

  /**
   * Closes the database connection.
   */
  public close(): void {
    this.db.close();
  }
}
