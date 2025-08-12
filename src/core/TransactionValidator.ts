import { Transaction, TxInput, UTXOSet } from "./Transaction";

/**
 * Result of a transaction validation check.
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Details about a double-spend attempt.
 */
export interface DoubleSpendAttempt {
  attemptedTxId: string;
  conflictingTxId: string;
  conflictingInput: TxInput;
  utxoId: string;
  timestamp: number;
}

/**
 * Comprehensive transaction validator with double-spend prevention.
 * This class provides advanced validation beyond basic transaction structure.
 */
export class TransactionValidator {
  private utxoSet: UTXOSet;
  private mempool: Map<string, Transaction>;
  private doubleSpendAttempts: DoubleSpendAttempt[] = [];

  constructor(utxoSet: UTXOSet) {
    this.utxoSet = utxoSet;
    this.mempool = new Map();
  }

  /**
   * Validates a transaction comprehensively including double-spend checks.
   * @param transaction - The transaction to validate
   * @param includeMempoolCheck - Whether to check against mempool conflicts
   * @returns Detailed validation result
   */
  public validateTransaction(
    transaction: Transaction,
    includeMempoolCheck: boolean = true
  ): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    // Basic transaction structure validation
    if (!transaction.isValid()) {
      result.isValid = false;
      result.errors.push("Basic transaction structure is invalid");
      return result;
    }

    // Skip input validation for coinbase transactions (no inputs)
    if (transaction.inputs.length === 0) {
      // Coinbase transaction validation
      if (transaction.outputs.length === 0) {
        result.isValid = false;
        result.errors.push(
          "Coinbase transaction must have at least one output"
        );
      }
      return result;
    }

    // Check for duplicate inputs within the same transaction
    const inputCheck = this.checkDuplicateInputs(transaction);
    if (!inputCheck.isValid) {
      result.isValid = false;
      result.errors.push(...inputCheck.errors);
    }

    // Check that all inputs reference valid unspent UTXOs
    const utxoCheck = this.checkUTXOValidity(transaction);
    if (!utxoCheck.isValid) {
      result.isValid = false;
      result.errors.push(...utxoCheck.errors);
    }

    // Check for sufficient balance
    const balanceCheck = this.checkSufficientBalance(transaction);
    if (!balanceCheck.isValid) {
      result.isValid = false;
      result.errors.push(...balanceCheck.errors);
    }

    // Check for conflicts with mempool transactions
    if (includeMempoolCheck) {
      const mempoolCheck = this.checkMempoolConflicts(transaction);
      if (!mempoolCheck.isValid) {
        result.isValid = false;
        result.errors.push(...mempoolCheck.errors);

        // Record double-spend attempt
        this.recordDoubleSpendAttempt(transaction, mempoolCheck.errors);
      }
    }

    return result;
  }

  /**
   * Adds a transaction to the mempool for conflict checking.
   * @param transaction - The transaction to add
   */
  public addToMempool(transaction: Transaction): void {
    this.mempool.set(transaction.id, transaction);
  }

  /**
   * Removes a transaction from the mempool.
   * @param transactionId - The transaction ID to remove
   */
  public removeFromMempool(transactionId: string): void {
    this.mempool.delete(transactionId);
  }

  /**
   * Creates a demonstration of double-spend prevention.
   * @param originalTx - The original valid transaction
   * @returns A conflicting transaction and validation results
   */
  public demonstrateDoubleSpend(originalTx: Transaction): {
    conflictingTx: Transaction;
    originalValidation: ValidationResult;
    conflictingValidation: ValidationResult;
  } {
    console.log("🔬 Demonstrating double-spend prevention...");

    // Validate the original transaction
    this.addToMempool(originalTx);
    const originalValidation = this.validateTransaction(originalTx, false);

    console.log(`   ✅ Original transaction: ${originalTx.id}`);
    console.log(`   Valid: ${originalValidation.isValid}`);

    // Create a conflicting transaction using the same inputs
    const conflictingTx = new Transaction(
      originalTx.inputs, // Same inputs (double-spend attempt)
      [
        {
          address: "attacker-address",
          amount: originalTx.getTotalOutputAmount(),
        },
      ] // Different outputs
    );

    console.log(`   🚨 Conflicting transaction: ${conflictingTx.id}`);

    // Validate the conflicting transaction (should fail)
    const conflictingValidation = this.validateTransaction(conflictingTx, true);

    console.log(`   Valid: ${conflictingValidation.isValid}`);
    console.log(`   Errors: ${conflictingValidation.errors.join(", ")}`);

    if (!conflictingValidation.isValid) {
      console.log("   ✅ Double-spend successfully prevented!");
    } else {
      console.log("   ❌ Double-spend prevention failed!");
    }

    return {
      conflictingTx,
      originalValidation,
      conflictingValidation,
    };
  }

  /**
   * Checks for duplicate inputs within a single transaction.
   * @param transaction - The transaction to check
   * @returns Validation result
   */
  private checkDuplicateInputs(transaction: Transaction): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };
    const seenInputs = new Set<string>();

    for (const input of transaction.inputs) {
      const inputId = `${input.txId}:${input.outputIndex}`;

      if (seenInputs.has(inputId)) {
        result.isValid = false;
        result.errors.push(`Duplicate input detected: ${inputId}`);
      }

      seenInputs.add(inputId);
    }

    return result;
  }

  /**
   * Checks that all transaction inputs reference valid unspent UTXOs.
   * @param transaction - The transaction to check
   * @returns Validation result
   */
  private checkUTXOValidity(transaction: Transaction): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    for (const input of transaction.inputs) {
      if (!this.utxoSet.hasUnspentUTXO(input.txId, input.outputIndex)) {
        result.isValid = false;
        result.errors.push(
          `Input references invalid or spent UTXO: ${input.txId}:${input.outputIndex}`
        );
      }
    }

    return result;
  }

  /**
   * Checks that the transaction doesn't spend more than available.
   * @param transaction - The transaction to check
   * @returns Validation result
   */
  private checkSufficientBalance(transaction: Transaction): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    let totalInputValue = 0;
    const totalOutputValue = transaction.getTotalOutputAmount();

    // Calculate total input value from UTXOs
    for (const input of transaction.inputs) {
      const allUTXOs = this.utxoSet.getAllUTXOs(); // Get all UTXOs
      const utxo = allUTXOs.find(
        (u) => u.txId === input.txId && u.outputIndex === input.outputIndex
      );

      if (utxo) {
        totalInputValue += utxo.amount;
      }
    }

    if (totalInputValue < totalOutputValue) {
      result.isValid = false;
      result.errors.push(
        `Insufficient balance: trying to spend ${totalOutputValue} but only have ${totalInputValue}`
      );
    }

    return result;
  }

  /**
   * Checks for conflicts with transactions already in the mempool.
   * @param transaction - The transaction to check
   * @returns Validation result
   */
  private checkMempoolConflicts(transaction: Transaction): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    for (const input of transaction.inputs) {
      const inputId = `${input.txId}:${input.outputIndex}`;

      // Check if any mempool transaction already spends this UTXO
      for (const [mempoolTxId, mempoolTx] of this.mempool) {
        if (mempoolTxId === transaction.id) continue; // Skip self

        for (const mempoolInput of mempoolTx.inputs) {
          const mempoolInputId = `${mempoolInput.txId}:${mempoolInput.outputIndex}`;

          if (inputId === mempoolInputId) {
            result.isValid = false;
            result.errors.push(
              `Double-spend detected: UTXO ${input.txId} (outputIndex: ${input.outputIndex}) already spent by transaction ${mempoolTxId}`
            );
          }
        }
      }
    }

    return result;
  }

  /**
   * Records a double-spend attempt for analysis.
   * @param transaction - The transaction that attempted double-spend
   * @param errors - The validation errors
   */
  private recordDoubleSpendAttempt(
    transaction: Transaction,
    errors: string[]
  ): void {
    // Find conflicting transaction from error messages
    for (const error of errors) {
      const match = error.match(/already spent by transaction (\w+)/);
      if (match) {
        const conflictingTxId = match[1];

        // Find the conflicting input
        for (const input of transaction.inputs) {
          const attempt: DoubleSpendAttempt = {
            attemptedTxId: transaction.id,
            conflictingTxId,
            conflictingInput: input,
            utxoId: `${input.txId}:${input.outputIndex}`,
            timestamp: Date.now(),
          };

          this.doubleSpendAttempts.push(attempt);
          // Intentionally avoid verbose console logging here to prevent duplicate output.
        }
      }
    }
  }
}
