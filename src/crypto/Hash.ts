import { createHash, createHmac } from "crypto";

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
   * Calculates double SHA-256 hash (SHA-256 of SHA-256).
   * This is commonly used in Bitcoin for additional security.
   * @param data - The data to hash
   * @returns The hexadecimal double-hash string
   */
  public static doubleSha256(data: string | Buffer): string {
    const firstHash = Hash.sha256(data);
    return Hash.sha256(firstHash);
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
   * Creates an HMAC (Hash-based Message Authentication Code).
   * @param key - The secret key
   * @param data - The data to authenticate
   * @returns The hexadecimal HMAC string
   */
  public static hmacSha256(key: string, data: string): string {
    return createHmac("sha256", key).update(data).digest("hex");
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
   * Compares two hashes numerically (treats them as big integers).
   * @param hash1 - First hash
   * @param hash2 - Second hash
   * @returns -1 if hash1 < hash2, 0 if equal, 1 if hash1 > hash2
   */
  public static compareHashes(hash1: string, hash2: string): number {
    // Convert to BigInt for comparison
    const num1 = BigInt("0x" + hash1);
    const num2 = BigInt("0x" + hash2);

    if (num1 < num2) return -1;
    if (num1 > num2) return 1;
    return 0;
  }

  /**
   * Creates a hash from an object by serializing it to JSON first.
   * @param obj - The object to hash
   * @returns The hexadecimal hash string
   */
  public static hashObject(obj: any): string {
    const jsonString = JSON.stringify(obj);
    return Hash.sha256(jsonString);
  }

  /**
   * Creates a deterministic hash from multiple inputs.
   * Used for creating consistent hashes from block data.
   * @param inputs - Object containing the inputs to hash
   * @returns The hexadecimal hash string
   */
  public static hashInputs(inputs: Record<string, any>): string {
    // Sort keys to ensure deterministic order
    const sortedKeys = Object.keys(inputs).sort();
    const orderedData = sortedKeys.map((key) => `${key}:${inputs[key]}`);
    return Hash.sha256(orderedData.join("|"));
  }

  /**
   * Generates a random nonce value for mining.
   * @returns A random number suitable for use as a nonce
   */
  public static generateNonce(): number {
    return Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
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
