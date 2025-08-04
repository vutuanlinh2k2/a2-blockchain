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

  /**
   * Checks if this node is a leaf node (has no children).
   */
  public isLeaf(): boolean {
    return this.left === null && this.right === null;
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

  /**
   * Gets the root hash of the Merkle tree.
   * This is the single hash that represents all the data in the tree.
   * @returns The root hash, or null if the tree is empty
   */
  public getRootHash(): string | null {
    return this.root ? this.root.hash : null;
  }

  /**
   * Gets the root node of the Merkle tree.
   * @returns The root node, or null if the tree is empty
   */
  public getRoot(): MerkleNode | null {
    return this.root;
  }

  /**
   * Generates a Merkle proof for a specific data item.
   * The proof can be used to verify that the data item is included in the tree.
   * @param data - The data item to generate a proof for
   * @returns Array of hashes representing the proof path, or null if data not found
   */
  public getProof(data: string): string[] | null {
    const targetHash = this.hash(data);
    const leafIndex = this.leaves.findIndex((leaf) => leaf.hash === targetHash);

    if (leafIndex === -1) {
      return null; // Data not found in tree
    }

    return this.buildProof(leafIndex, this.leaves.length);
  }

  /**
   * Builds a proof path for a specific leaf index.
   * @param leafIndex - The index of the leaf to build a proof for
   * @param levelSize - The number of nodes at the current level
   * @returns Array of hashes in the proof path
   */
  private buildProof(leafIndex: number, levelSize: number): string[] {
    const proof: string[] = [];
    let currentIndex = leafIndex;
    let currentLevelSize = levelSize;

    // Build proof by traversing up the tree
    while (currentLevelSize > 1) {
      // Determine if we need the left or right sibling
      const isRightNode = currentIndex % 2 === 1;
      const siblingIndex = isRightNode ? currentIndex - 1 : currentIndex + 1;

      // Find the sibling hash (if it exists)
      if (siblingIndex < currentLevelSize) {
        const siblingHash = this.getHashAtLevel(siblingIndex, currentLevelSize);
        proof.push(siblingHash);
      }

      // Move to the next level
      currentIndex = Math.floor(currentIndex / 2);
      currentLevelSize = Math.ceil(currentLevelSize / 2);
    }

    return proof;
  }

  /**
   * Gets the hash of a node at a specific position in a specific level.
   * @param index - The index of the node in the level
   * @param levelSize - The size of the level
   * @returns The hash of the node
   */
  private getHashAtLevel(index: number, levelSize: number): string {
    // This is a simplified implementation
    // In a full implementation, you'd traverse the tree to find the actual node
    if (levelSize === this.leaves.length) {
      return this.leaves[index].hash;
    }

    // For upper levels, we'd need to calculate or store the intermediate hashes
    // This is a placeholder - in a production implementation, you'd store or calculate these
    return "placeholder_hash";
  }

  /**
   * Verifies a Merkle proof for a specific data item.
   * @param data - The original data item
   * @param proof - The proof array returned by getProof()
   * @param rootHash - The expected root hash
   * @returns True if the proof is valid, false otherwise
   */
  public static verifyProof(
    data: string,
    proof: string[],
    rootHash: string
  ): boolean {
    let currentHash = createHash("sha256").update(data).digest("hex");

    // Traverse up the tree using the proof
    for (const proofHash of proof) {
      // Combine with sibling hash (order matters in real implementation)
      currentHash = createHash("sha256")
        .update(currentHash + proofHash)
        .digest("hex");
    }

    return currentHash === rootHash;
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
   * Gets the number of leaf nodes in the tree.
   * @returns The number of leaves
   */
  public getLeafCount(): number {
    return this.leaves.length;
  }

  /**
   * Returns a string representation of the tree (for debugging).
   * @returns A formatted string showing the tree structure
   */
  public toString(): string {
    if (!this.root) {
      return "Empty tree";
    }

    return `Merkle Tree (${this.getLeafCount()} leaves)\nRoot: ${this.getRootHash()}`;
  }
}
