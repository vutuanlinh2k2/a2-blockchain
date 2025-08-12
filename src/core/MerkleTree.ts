import { createHash } from "crypto";

/**
 * Represents a node in the Merkle tree.
 * Each node contains a hash and references to its children (if any).
 */
export class MerkleNode {
  public hash: string;
  public left: MerkleNode | null;
  public right: MerkleNode | null;

  constructor(
    hash: string,
    left: MerkleNode | null = null,
    right: MerkleNode | null = null
  ) {
    this.hash = hash;
    this.left = left;
    this.right = right;
  }
}

/**
 * Implements a Merkle tree for efficient transaction verification.
 * The Merkle tree allows for efficient and secure verification of large data structures.
 * In our blockchain, it's used to create a single hash that represents all transactions in a block.
 */
export class MerkleTree {
  private root: MerkleNode | null;
  private leaves: MerkleNode[];

  /**
   * Creates a new Merkle tree from an array of data items.
   * @param data - Array of strings to build the tree from (typically transaction IDs)
   */
  constructor(data: string[]) {
    if (data.length === 0) {
      throw new Error("Cannot create Merkle tree with empty data");
    }

    this.leaves = data.map((item) => new MerkleNode(this.hash(item)));
    this.root = this.buildTree(this.leaves);
  }

  /**
   * Gets the root hash of the Merkle tree.
   * This is the single hash that represents all the data in the tree.
   * @returns The root hash, or null if the tree is empty
   */
  public getRootHash(): string | null {
    return this.root ? this.root.hash : null;
  }

  /**
   * Creates a Merkle tree from an array of transaction IDs.
   * This is a convenience method specifically for blockchain transactions.
   * @param transactionIds - Array of transaction IDs
   * @returns A new MerkleTree instance
   */
  public static fromTransactionIds(transactionIds: string[]): MerkleTree {
    if (transactionIds.length === 0) {
      // Create a tree with a single empty transaction for empty blocks
      return new MerkleTree(["0".repeat(64)]); // Empty transaction hash
    }

    return new MerkleTree(transactionIds);
  }

  /**
   * Calculates SHA-256 hash of the input data.
   * @param data - The data to hash
   * @returns The hexadecimal hash string
   */
  private hash(data: string): string {
    return createHash("sha256").update(data).digest("hex");
  }

  /**
   * Combines two hashes to create a parent hash.
   * @param left - Left child hash
   * @param right - Right child hash
   * @returns Combined hash
   */
  private combineHashes(left: string, right: string): string {
    return this.hash(left + right);
  }

  /**
   * Recursively builds the Merkle tree from leaf nodes.
   * @param nodes - Current level of nodes
   * @returns The root node of the tree
   */
  private buildTree(nodes: MerkleNode[]): MerkleNode {
    // Base case: if only one node, it's the root
    if (nodes.length === 1) {
      return nodes[0];
    }

    const nextLevel: MerkleNode[] = [];

    // Process pairs of nodes
    for (let i = 0; i < nodes.length; i += 2) {
      const left = nodes[i];
      const right = i + 1 < nodes.length ? nodes[i + 1] : left; // Duplicate last node if odd count

      const parentHash = this.combineHashes(left.hash, right.hash);
      const parentNode = new MerkleNode(parentHash, left, right);
      nextLevel.push(parentNode);
    }

    // Recursively build the next level
    return this.buildTree(nextLevel);
  }
}
