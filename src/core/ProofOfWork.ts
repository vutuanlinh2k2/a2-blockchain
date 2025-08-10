import { Block } from "./Block";
import { Transaction } from "./Transaction";
import { Hash } from "../crypto/Hash";

/**
 * Mining statistics for tracking performance and progress.
 */
export interface MiningStats {
  startTime: number;
  endTime?: number;
  attempts: number;
  hashRate: number;
  difficulty: number;
  targetHash: string;
  finalHash?: string;
  success: boolean;
}

/**
 * Configuration for difficulty adjustment algorithm.
 */
export interface DifficultyConfig {
  targetBlockTime: number; // Target time between blocks in milliseconds
  adjustmentInterval: number; // Number of blocks between difficulty adjustments
  maxAdjustment: number; // Maximum difficulty change per adjustment (e.g., 4x)
}

/**
 * Implements Proof-of-Work consensus mechanism.
 * This class handles mining, difficulty adjustment, and block validation
 * according to the PoW algorithm similar to Bitcoin.
 */
export class ProofOfWork {
  private readonly config: DifficultyConfig;

  /**
   * Creates a new ProofOfWork instance.
   * @param config - Configuration for difficulty adjustment
   */
  constructor(config?: Partial<DifficultyConfig>) {
    this.config = {
      targetBlockTime: 10000, // 10 seconds default
      adjustmentInterval: 5, // Adjust every 5 blocks
      maxAdjustment: 4, // Max 4x difficulty change
      ...config,
    };
  }

  /**
   * Mines a block by finding a nonce that produces a hash meeting the difficulty requirement.
   * @param block - The candidate block to mine
   * @param onProgress - Optional callback for progress updates
   * @returns The mined block with valid proof-of-work, or null if mining was stopped
   */
  public async mineBlock(
    block: Block,
    onProgress?: (stats: Partial<MiningStats>) => boolean
  ): Promise<Block | null> {
    const stats: MiningStats = {
      startTime: Date.now(),
      attempts: 0,
      hashRate: 0,
      difficulty: block.difficulty,
      targetHash: Hash.getDifficultyTarget(block.difficulty),
      success: false,
    };

    console.log(`🎯 Target: ${stats.targetHash.substring(0, 20)}...`);

    let currentBlock = block;
    let lastProgressUpdate = Date.now();
    const progressInterval = 1000; // Update progress every second

    while (true) {
      // Check if hash meets difficulty requirement
      if (currentBlock.hasValidProofOfWork()) {
        stats.endTime = Date.now();
        stats.finalHash = currentBlock.hash;
        stats.success = true;
        stats.hashRate = Hash.calculateHashRate(
          stats.attempts,
          stats.endTime - stats.startTime
        );

        console.log(`🎉 Block mined successfully!`);
        console.log(`   Nonce: ${currentBlock.nonce}`);
        console.log(`   Hash: ${currentBlock.hash}`);
        console.log(
          `   Reward: ${currentBlock.transactions[0].outputs[0].amount}`
        );
        console.log(`   Attempts: ${stats.attempts.toLocaleString()}`);
        console.log(
          `   Time: ${((stats.endTime - stats.startTime) / 1000).toFixed(2)}s`
        );
        console.log(`   Hash Rate: ${Hash.formatHashRate(stats.hashRate)}`);

        return currentBlock;
      }

      // Increment attempts and nonce
      stats.attempts++;
      currentBlock = currentBlock.incrementNonce();

      // Update progress periodically
      const now = Date.now();
      if (now - lastProgressUpdate >= progressInterval) {
        const elapsed = now - stats.startTime;
        stats.hashRate = Hash.calculateHashRate(stats.attempts, elapsed);

        // Call progress callback if provided
        if (onProgress) {
          const shouldContinue = onProgress(stats);
          if (!shouldContinue) {
            console.log("🛑 Mining stopped by user");
            return null;
          }
        }

        lastProgressUpdate = now;

        // Log progress
        const timeElapsed = (elapsed / 1000).toFixed(1);
        console.log(
          `⛏️  Mining... ${stats.attempts.toLocaleString()} attempts, ` +
            `${Hash.formatHashRate(stats.hashRate)}, ${timeElapsed}s`
        );
      }

      // Safety check to prevent infinite loops in development
      if (stats.attempts > 10000000) {
        console.log("⚠️  Mining stopped: Too many attempts (safety limit)");
        console.log("   Consider reducing difficulty for development");
        return null;
      }
    }
  }

  /**
   * Calculates the appropriate difficulty for the next block based on recent block times.
   * @param recentBlocks - Array of recent blocks (should include at least adjustmentInterval blocks)
   * @param currentDifficulty - Current difficulty level
   * @returns New difficulty level
   */
  public calculateNextDifficulty(
    recentBlocks: Block[],
    currentDifficulty: number
  ): number {
    // Need at least 2 blocks to calculate time difference
    if (recentBlocks.length < 2) {
      return currentDifficulty;
    }

    // Only adjust difficulty at specified intervals
    const latestBlock = recentBlocks[recentBlocks.length - 1];
    if (latestBlock.index % this.config.adjustmentInterval !== 0) {
      return currentDifficulty;
    }

    // Need enough blocks for a meaningful adjustment
    if (recentBlocks.length < this.config.adjustmentInterval) {
      return currentDifficulty;
    }

    // Calculate actual time taken for the last adjustment interval
    const intervalBlocks = recentBlocks.slice(-this.config.adjustmentInterval);
    const oldestBlock = intervalBlocks[0];
    const newestBlock = intervalBlocks[intervalBlocks.length - 1];

    const actualTime = newestBlock.timestamp - oldestBlock.timestamp;
    const expectedTime =
      this.config.targetBlockTime * (this.config.adjustmentInterval - 1);

    // Calculate adjustment ratio
    const ratio = actualTime / expectedTime;

    // Apply limits to prevent extreme adjustments
    const limitedRatio = Math.max(
      1 / this.config.maxAdjustment,
      Math.min(this.config.maxAdjustment, ratio)
    );

    // Calculate new difficulty
    let newDifficulty: number;
    if (limitedRatio > 1) {
      // Blocks are taking too long, decrease difficulty
      newDifficulty = Math.max(1, currentDifficulty - 1);
    } else if (limitedRatio < 0.5) {
      // Blocks are too fast, increase difficulty significantly
      newDifficulty = currentDifficulty + 2;
    } else if (limitedRatio < 0.8) {
      // Blocks are somewhat too fast, increase difficulty
      newDifficulty = currentDifficulty + 1;
    } else {
      // Time is close to target, keep current difficulty
      newDifficulty = currentDifficulty;
    }

    // Ensure difficulty doesn't go below 1
    newDifficulty = Math.max(1, newDifficulty);

    if (newDifficulty !== currentDifficulty) {
      console.log(`📊 Difficulty adjustment:`);
      console.log(
        `   Block interval: ${latestBlock.index - this.config.adjustmentInterval + 1} to ${latestBlock.index}`
      );
      console.log(`   Expected time: ${(expectedTime / 1000).toFixed(1)}s`);
      console.log(`   Actual time: ${(actualTime / 1000).toFixed(1)}s`);
      console.log(`   Ratio: ${ratio.toFixed(2)}`);
      console.log(`   Difficulty: ${currentDifficulty} → ${newDifficulty}`);
    }

    return newDifficulty;
  }

  /**
   * Validates that a block meets the proof-of-work requirements.
   * @param block - The block to validate
   * @returns True if the block has valid proof-of-work
   */
  public validateProofOfWork(block: Block): boolean {
    // Check that the block hash meets the difficulty requirement
    if (!block.hasValidProofOfWork()) {
      console.log(
        `❌ Block ${block.index}: Hash doesn't meet difficulty ${block.difficulty}`
      );
      console.log(`   Hash: ${block.hash}`);
      console.log(`   Required: ${"0".repeat(block.difficulty)}`);
      return false;
    }

    // Verify that the hash is correctly calculated
    const expectedHash = block.calculateHash();
    if (block.hash !== expectedHash) {
      console.log(`❌ Block ${block.index}: Hash calculation mismatch`);
      console.log(`   Stored: ${block.hash}`);
      console.log(`   Calculated: ${expectedHash}`);
      return false;
    }

    return true;
  }

  /**
   * Estimates the time required to mine a block at the given difficulty.
   * @param difficulty - The mining difficulty
   * @param hashRate - Hash rate in hashes per second
   * @returns Estimated time in seconds
   */
  public estimateMiningTime(difficulty: number, hashRate: number): number {
    return Hash.estimateMiningTime(difficulty, hashRate);
  }

  /**
   * Creates a mining progress reporter that logs mining statistics.
   * @param logInterval - How often to log progress (in attempts)
   * @returns Progress callback function
   */
  public createProgressReporter(
    logInterval: number = 50000
  ): (stats: Partial<MiningStats>) => boolean {
    let lastLoggedAttempts = 0;

    return (stats: Partial<MiningStats>) => {
      if (!stats.attempts) return true;

      // Log progress at specified intervals
      if (stats.attempts - lastLoggedAttempts >= logInterval) {
        const elapsed = Date.now() - (stats.startTime || 0);
        const timeStr = (elapsed / 1000).toFixed(1);
        const hashRateStr = Hash.formatHashRate(stats.hashRate || 0);
        const eta = this.estimateMiningTime(
          stats.difficulty || 1,
          stats.hashRate || 1
        );
        const etaStr = eta === Infinity ? "∞" : `${eta.toFixed(1)}s`;

        console.log(
          `   📈 ${stats.attempts.toLocaleString()} attempts, ` +
            `${hashRateStr}, ${timeStr}s elapsed, ETA: ${etaStr}`
        );

        lastLoggedAttempts = stats.attempts;
      }

      return true; // Continue mining
    };
  }

  /**
   * Gets the current configuration.
   * @returns The difficulty configuration
   */
  public getConfig(): DifficultyConfig {
    return { ...this.config };
  }

  /**
   * Creates a mining candidate block from transactions.
   * @param index - Block index
   * @param transactions - Transactions to include
   * @param previousHash - Hash of previous block
   * @param difficulty - Mining difficulty
   * @returns A block ready for mining
   */
  public createMiningCandidate(
    index: number,
    transactions: Transaction[],
    previousHash: string,
    difficulty: number
  ): Block {
    return Block.createCandidate(index, transactions, previousHash, difficulty);
  }
}
