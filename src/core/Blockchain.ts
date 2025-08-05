import { Block } from "./Block";
import { Transaction, TransactionPool, UTXOSet } from "./Transaction";
import { ProofOfWork } from "./consensus/ProofOfWork";
import { BlockchainDB } from "../storage/Database";

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
  private readonly transactionPool: TransactionPool;
  private readonly utxoSet: UTXOSet;
  private readonly proofOfWork: ProofOfWork;
  private readonly config: ResolvedBlockchainConfig;

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
    this.transactionPool = new TransactionPool();
    this.utxoSet = new UTXOSet();
    this.proofOfWork = new ProofOfWork();

    // Initialize with genesis block if chain is empty
    this.initializeChain();
  }

  /**
   * Initializes the blockchain with the genesis block if it doesn't exist.
   */
  private initializeChain(): void {
    if (this.blocks.length === 0) {
      const genesisBlock = Block.createGenesis(this.config.genesisMessage);
      this.blocks.push(genesisBlock);
      this.updateUTXOSet(genesisBlock);

      console.log("🎉 Blockchain initialized with genesis block");
      console.log(`   Hash: ${genesisBlock.hash}`);
    }
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

    // Update UTXO set
    this.updateUTXOSet(block);

    // Remove included transactions from the pool
    this.removeTransactionsFromPool(block);

    console.log(`✅ Block ${block.index} added to chain`);
    console.log(`   Hash: ${block.hash}`);
    console.log(`   Transactions: ${block.getTransactionCount()}`);

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
      }

      // Add new UTXOs from outputs
      transaction.outputs.forEach((output, index) => {
        const utxo = {
          txId: transaction.id,
          outputIndex: index,
          address: output.address,
          amount: output.amount,
          spent: false,
        };
        this.utxoSet.addUTXO(utxo as any);
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
    }
  }

  /**
   * Mines a new block with pending transactions.
   * @param minerAddress - Address to receive the mining reward
   * @returns The mined block, or null if mining failed
   */
  public async mineBlock(minerAddress: string): Promise<Block | null> {
    console.log("⛏️  Starting block mining...");

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
      `📦 Mining block #${candidateBlock.index} with ${blockTransactions.length} transactions`
    );

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
   * Adds a transaction to the transaction pool.
   * @param transaction - The transaction to add
   * @returns True if the transaction was added successfully
   */
  public addTransaction(transaction: Transaction): boolean {
    // Validate transaction
    if (!transaction.isValid()) {
      console.log(`❌ Invalid transaction: ${transaction.id}`);
      return false;
    }

    // Check that inputs reference valid UTXOs
    if (!this.utxoSet.canSpendTransaction(transaction)) {
      console.log(`❌ Transaction references invalid UTXOs: ${transaction.id}`);
      return false;
    }

    // Add to transaction pool
    return this.transactionPool.addTransaction(transaction);
  }

  /**
   * Gets the latest block in the chain.
   * @returns The most recent block
   */
  public getLatestBlock(): Block {
    return this.blocks[this.blocks.length - 1];
  }

  /**
   * Gets a block by its index.
   * @param index - The block index
   * @returns The block if found, undefined otherwise
   */
  public getBlock(index: number): Block | undefined {
    return this.blocks.find((block) => block.index === index);
  }

  /**
   * Gets a block by its hash.
   * @param hash - The block hash
   * @returns The block if found, undefined otherwise
   */
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
    const originalUTXOSet = new UTXOSet();

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
   * Closes the database connection.
   */
  public close(): void {
    this.db.close();
  }

  /**
   * Returns a formatted string representation of the blockchain.
   * @param includeTransactions - Whether to include transaction details
   * @returns Formatted blockchain string
   */
  public toString(includeTransactions: boolean = false): string {
    let result = `Blockchain (${this.blocks.length} blocks)\n`;
    result += "=".repeat(50) + "\n";

    for (const block of this.blocks) {
      result += block.toString(includeTransactions) + "\n";
      result += "-".repeat(50) + "\n";
    }

    return result;
  }
}
