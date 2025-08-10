import { createHash } from "crypto";
import { Transaction } from "./Transaction";
import { MerkleTree } from "../crypto/MerkleTree";

/**
 * Represents a block in the blockchain.
 * Each block contains a collection of transactions and is linked to the previous block
 * through cryptographic hashes, forming an immutable chain.
 */
export class Block {
  public readonly index: number;
  public readonly timestamp: number;
  public readonly transactions: Transaction[];
  public readonly previousHash: string;
  public readonly merkleRoot: string;
  public readonly nonce: number;
  public readonly difficulty: number;
  public readonly hash: string;

  /**
   * Creates a new block.
   * @param index - The position of this block in the chain (0 for genesis)
   * @param transactions - Array of transactions included in this block
   * @param previousHash - Hash of the previous block in the chain
   * @param nonce - The proof-of-work nonce value
   * @param difficulty - The difficulty target for this block
   * @param timestamp - When the block was created (defaults to current time)
   */
  constructor(
    index: number,
    transactions: Transaction[],
    previousHash: string,
    nonce: number = 0,
    difficulty: number = 4,
    timestamp?: number
  ) {
    this.index = index;
    this.timestamp = timestamp || Date.now();
    this.transactions = [...transactions]; // Create a copy to prevent external modification
    this.previousHash = previousHash;
    this.nonce = nonce;
    this.difficulty = difficulty;

    // Calculate Merkle root from transactions
    this.merkleRoot = this.calculateMerkleRoot();

    // Calculate the block hash
    this.hash = this.calculateHash();
  }

  /**
   * Calculates the Merkle root hash of all transactions in the block.
   * @returns The Merkle root hash as a hexadecimal string
   */
  private calculateMerkleRoot(): string {
    if (this.transactions.length === 0) {
      // Empty block - use a default hash
      return "0".repeat(64);
    }

    const transactionIds = this.transactions.map((tx) => tx.id);
    const merkleTree = MerkleTree.fromTransactionIds(transactionIds);
    return merkleTree.getRootHash() || "0".repeat(64);
  }

  /**
   * Calculates the hash of this block based on all its critical data.
   * This hash must include all data that should be immutable.
   * @returns The block hash as a hexadecimal string
   */
  public calculateHash(): string {
    const blockData = {
      index: this.index,
      timestamp: this.timestamp,
      previousHash: this.previousHash,
      merkleRoot: this.merkleRoot,
      nonce: this.nonce,
      difficulty: this.difficulty,
    };

    return createHash("sha256").update(JSON.stringify(blockData)).digest("hex");
  }

  /**
   * Validates the structure and integrity of this block.
   * @returns True if the block is valid, false otherwise
   */
  public isValid(): boolean {
    // Check that the hash is correctly calculated
    const expectedHash = this.calculateHash();
    if (this.hash !== expectedHash) {
      console.log(`❌ Block ${this.index}: Hash mismatch`);
      return false;
    }

    // Check that the Merkle root is correctly calculated
    const expectedMerkleRoot = this.calculateMerkleRoot();
    if (this.merkleRoot !== expectedMerkleRoot) {
      console.log(`❌ Block ${this.index}: Merkle root mismatch`);
      return false;
    }

    // Validate all transactions in the block
    for (const transaction of this.transactions) {
      if (!transaction.isValid()) {
        console.log(
          `❌ Block ${this.index}: Invalid transaction ${transaction.id}`
        );
        return false;
      }
    }

    // Check that the block meets the difficulty requirement (for PoW)
    const hashTarget = "0".repeat(this.difficulty);
    if (!this.hash.startsWith(hashTarget)) {
      console.log(
        `❌ Block ${this.index}: Hash doesn't meet difficulty requirement`
      );
      return false;
    }


    return true;
  }

  /**
   * Validates that this block correctly follows the previous block.
   * @param previousBlock - The block that should come before this one
   * @returns True if this block correctly follows the previous block
   */
  public isValidSuccessor(previousBlock: Block): boolean {
    // Check that the index is sequential
    if (this.index !== previousBlock.index + 1) {
      console.log(`❌ Block ${this.index}: Non-sequential index`);
      return false;
    }

    // Check that the previousHash matches the previous block's hash
    if (this.previousHash !== previousBlock.hash) {
      console.log(`❌ Block ${this.index}: Previous hash mismatch`);
      return false;
    }

    // Check that the timestamp is after the previous block
    if (this.timestamp <= previousBlock.timestamp) {
      console.log(`❌ Block ${this.index}: Timestamp not after previous block`);
      return false;
    }

    return true;
  }

  /**
   * Creates a new block with an incremented nonce value.
   * This is used during the mining process to find a valid proof-of-work.
   * @returns A new Block instance with nonce incremented by 1
   */
  public incrementNonce(): Block {
    return new Block(
      this.index,
      this.transactions,
      this.previousHash,
      this.nonce + 1,
      this.difficulty,
      this.timestamp
    );
  }

  /**
   * Checks if this block satisfies the proof-of-work difficulty requirement.
   * @returns True if the block hash meets the difficulty target
   */
  public hasValidProofOfWork(): boolean {
    const hashTarget = "0".repeat(this.difficulty);
    return this.hash.startsWith(hashTarget);
  }

  /**
   * Gets the total number of transactions in this block.
   * @returns The transaction count
   */
  public getTransactionCount(): number {
    return this.transactions.length;
  }

  /**
   * Gets the total value of all transaction outputs in this block.
   * This can be useful for calculating block rewards and fees.
   * @returns The total output value
   */
  public getTotalOutputValue(): number {
    return this.transactions.reduce(
      (total, tx) => total + tx.getTotalOutputAmount(),
      0
    );
  }

  /**
   * Serializes the block to a JSON string.
   * @returns JSON representation of the block
   */
  public serialize(): string {
    return JSON.stringify({
      index: this.index,
      timestamp: this.timestamp,
      transactions: this.transactions.map((tx) => tx.serialize()),
      previousHash: this.previousHash,
      merkleRoot: this.merkleRoot,
      nonce: this.nonce,
      difficulty: this.difficulty,
      hash: this.hash,
    });
  }

  /**
   * Deserializes a block from a JSON string.
   * @param json - The JSON string to deserialize
   * @returns A new Block instance
   */
  public static deserialize(json: string): Block {
    const data = JSON.parse(json);

    // Deserialize transactions
    const transactions = data.transactions.map((txJson: string) =>
      Transaction.deserialize(txJson)
    );

    // Create the block
    const block = new Block(
      data.index,
      transactions,
      data.previousHash,
      data.nonce,
      data.difficulty,
      data.timestamp
    );

    // Verify the hash matches
    if (block.hash !== data.hash) {
      throw new Error("Block hash mismatch during deserialization");
    }

    return block;
  }

  /**
   * Creates the genesis block (the first block in the chain).
   * The genesis block has no previous hash and contains no transactions.
   * @param genesisMessage - Optional message to include in the genesis block
   * @returns The genesis block
   */
  public static createGenesis(genesisMessage?: string): Block {
    const transactions: Transaction[] = [];

    // If a genesis message is provided, create a special transaction
    if (genesisMessage) {
      // Create a special "genesis" transaction (this is a simplification)
      const genesisTx = Transaction.createCoinbase("genesis", 0);
      transactions.push(genesisTx);
    }

    // Genesis block has no previous hash (use zeros)
    const previousHash = "0".repeat(64);

    // Create the genesis block with easy difficulty
    const genesisBlock = new Block(0, transactions, previousHash, 0, 1);
    return genesisBlock;
  }

  /**
   * Creates a candidate block for mining.
   * This is a convenience method for miners to create blocks ready for proof-of-work.
   * @param index - The block index
   * @param transactions - Transactions to include
   * @param previousHash - Hash of the previous block
   * @param difficulty - Mining difficulty
   * @returns A new block ready for mining (nonce = 0)
   */
  public static createCandidate(
    index: number,
    transactions: Transaction[],
    previousHash: string,
    difficulty: number
  ): Block {
    return new Block(index, transactions, previousHash, 0, difficulty);
  }
}
