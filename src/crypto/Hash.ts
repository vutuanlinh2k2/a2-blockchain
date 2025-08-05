import { createHash } from "crypto";

/**
 * Cryptographic utility class for hashing operations.
 * Provides standardized hashing functions used throughout the blockchain.
 */
export class Hash {
  /**
   * Calculates SHA-256 hash of the input data.
   * @param data - The data to hash (string or Buffer)
   * @returns The hexadecimal hash string
   */
  public static sha256(data: string | Buffer): string {
    return createHash("sha256").update(data).digest("hex");
  }

  /**
   * Creates a hash from multiple pieces of data concatenated together.
   * @param data - Array of data pieces to concatenate and hash
   * @returns The hexadecimal hash string
   */
  public static combineAndHash(data: (string | number)[]): string {
    const combined = data.join("");
    return Hash.sha256(combined);
  }

  /**
   * Validates that a hash string is a valid SHA-256 hash.
   * @param hash - The hash string to validate
   * @returns True if the hash is valid, false otherwise
   */
  public static isValidSha256(hash: string): boolean {
    // SHA-256 produces 64 character hexadecimal strings
    const sha256Regex = /^[a-f0-9]{64}$/i;
    return sha256Regex.test(hash);
  }

  /**
   * Checks if a hash meets a specific difficulty requirement.
   * Difficulty is represented by the number of leading zeros required.
   * @param hash - The hash to check
   * @param difficulty - Number of leading zeros required
   * @returns True if the hash meets the difficulty requirement
   */
  public static meetsDifficulty(hash: string, difficulty: number): boolean {
    const target = "0".repeat(difficulty);
    return hash.startsWith(target);
  }

  /**
   * Calculates the difficulty of a hash (number of leading zeros).
   * @param hash - The hash to analyze
   * @returns The number of leading zeros
   */
  public static calculateDifficulty(hash: string): number {
    let difficulty = 0;
    for (const char of hash) {
      if (char === "0") {
        difficulty++;
      } else {
        break;
      }
    }
    return difficulty;
  }

  /**
   * Generates a target hash string for a given difficulty.
   * @param difficulty - The difficulty level
   * @returns A string representing the target (leading zeros followed by 'f's)
   */
  public static getDifficultyTarget(difficulty: number): string {
    return "0".repeat(difficulty) + "f".repeat(64 - difficulty);
  }

  /**
   * Calculates the hash rate (hashes per second) based on time and attempts.
   * @param attempts - Number of hash attempts made
   * @param timeMs - Time taken in milliseconds
   * @returns Hash rate in hashes per second
   */
  public static calculateHashRate(attempts: number, timeMs: number): number {
    if (timeMs === 0) return 0;
    return Math.round((attempts / timeMs) * 1000);
  }

  /**
   * Estimates the time to find a hash with the given difficulty.
   * @param difficulty - The difficulty level
   * @param hashRate - Hash rate in hashes per second
   * @returns Estimated time in seconds
   */
  public static estimateMiningTime(
    difficulty: number,
    hashRate: number
  ): number {
    if (hashRate === 0) return Infinity;

    // Expected number of attempts = 2^(4 * difficulty) for hexadecimal
    const expectedAttempts = Math.pow(16, difficulty);
    return expectedAttempts / hashRate;
  }

  /**
   * Formats hash rate for human-readable display.
   * @param hashRate - Hash rate in hashes per second
   * @returns Formatted string (e.g., "1.2 KH/s", "3.4 MH/s")
   */
  public static formatHashRate(hashRate: number): string {
    if (hashRate < 1000) {
      return `${hashRate} H/s`;
    } else if (hashRate < 1000000) {
      return `${(hashRate / 1000).toFixed(1)} KH/s`;
    } else if (hashRate < 1000000000) {
      return `${(hashRate / 1000000).toFixed(1)} MH/s`;
    } else {
      return `${(hashRate / 1000000000).toFixed(1)} GH/s`;
    }
  }
}
