import { createHash } from "crypto";

/**
 * Represents a transaction input that references a previous unspent output (UTXO).
 * This is how transactions "spend" previous outputs.
 */
export interface TxInput {
  /** The transaction ID that contains the output being spent */
  txId: string;
  /** The index of the output within that transaction */
  outputIndex: number;
  /** Digital signature proving ownership (simplified for this implementation) */
  signature?: string;
}

/**
 * Represents a transaction output that creates a new UTXO.
 * This is where value is transferred to a new address.
 */
export interface TxOutput {
  /** The recipient address */
  address: string;
  /** The amount being transferred (in satoshis/smallest unit) */
  amount: number;
}

/**
 * Represents a complete transaction with inputs and outputs.
 * Implements the UTXO (Unspent Transaction Output) model.
 */
export class Transaction {
  public readonly id: string;
  public readonly timestamp: number;
  public readonly inputs: TxInput[];
  public readonly outputs: TxOutput[];

  /**
   * Creates a new transaction.
   * @param inputs - Array of transaction inputs (UTXOs being spent)
   * @param outputs - Array of transaction outputs (new UTXOs being created)
   * @param timestamp - When the transaction was created (defaults to current time)
   */
  constructor(inputs: TxInput[], outputs: TxOutput[], timestamp?: number) {
    this.inputs = inputs;
    this.outputs = outputs;
    this.timestamp = timestamp || Date.now();
    this.id = this.calculateId();
  }

  /**
   * Calculates the unique transaction ID by hashing all transaction data.
   * @returns The transaction ID as a hexadecimal string
   */
  private calculateId(): string {
    const data = {
      timestamp: this.timestamp,
      inputs: this.inputs,
      outputs: this.outputs,
    };
    return createHash("sha256").update(JSON.stringify(data)).digest("hex");
  }

  /**
   * Gets the total amount being sent in this transaction.
   * @returns Total output amount
   */
  public getTotalOutputAmount(): number {
    return this.outputs.reduce((sum, output) => sum + output.amount, 0);
  }

  /**
   * Validates the transaction structure and logic.
   * @returns True if the transaction is valid, false otherwise
   */
  public isValid(): boolean {
    // Basic validation checks
    if (this.inputs.length === 0 && this.outputs.length === 0) {
      return false; // Empty transaction
    }

    // Check that all outputs have positive amounts
    for (const output of this.outputs) {
      if (output.amount <= 0) {
        return false;
      }
    }

    // Check that transaction ID is correctly calculated
    const expectedId = this.calculateId();
    if (this.id !== expectedId) {
      return false;
    }

    return true;
  }

  /**
   * Creates a coinbase transaction (mining reward).
   * This is a special transaction with no inputs that creates new coins.
   * @param minerAddress - The address to receive the mining reward
   * @param amount - The reward amount
   * @returns A new coinbase transaction
   */
  public static createCoinbase(
    minerAddress: string,
    amount: number
  ): Transaction {
    return new Transaction(
      [], // No inputs for coinbase
      [{ address: minerAddress, amount }]
    );
  }

  /**
   * Serializes the transaction to a JSON string.
   * @returns JSON representation of the transaction
   */
  public serialize(): string {
    return JSON.stringify({
      id: this.id,
      timestamp: this.timestamp,
      inputs: this.inputs,
      outputs: this.outputs,
    });
  }

  /**
   * Deserializes a transaction from a JSON string.
   * @param json - The JSON string to deserialize
   * @returns A new Transaction instance
   */
  public static deserialize(json: string): Transaction {
    const data = JSON.parse(json);
    const tx = new Transaction(data.inputs, data.outputs, data.timestamp);

    // Verify the ID matches
    if (tx.id !== data.id) {
      throw new Error("Transaction ID mismatch during deserialization");
    }

    return tx;
  }
}

/**
 * Represents an unspent transaction output (UTXO).
 * This is the core of the UTXO model for tracking balances.
 */
export class UTXO {
  public readonly txId: string;
  public readonly outputIndex: number;
  public readonly address: string;
  public readonly amount: number;
  public spent: boolean;
  public spentInTx: string | undefined;

  constructor(
    txId: string,
    outputIndex: number,
    address: string,
    amount: number,
    spent: boolean = false,
    spentInTx?: string
  ) {
    this.txId = txId;
    this.outputIndex = outputIndex;
    this.address = address;
    this.amount = amount;
    this.spent = spent;
    this.spentInTx = spentInTx;
  }

  /**
   * Creates a unique identifier for this UTXO.
   * @returns A string in the format "txId:outputIndex"
   */
  public getId(): string {
    return `${this.txId}:${this.outputIndex}`;
  }

  /**
   * Marks this UTXO as spent by a specific transaction.
   * @param spentInTx - The ID of the transaction that spent this UTXO
   */
  public markAsSpent(spentInTx: string): void {
    this.spent = true;
    this.spentInTx = spentInTx;
  }
}

/**
 * Manages the pool of pending transactions (mempool).
 * This is where transactions wait before being included in a block.
 */
export class TransactionPool {
  private transactions: Map<string, Transaction> = new Map();

  /**
   * Adds a transaction to the pool if it's valid and not already present.
   * @param transaction - The transaction to add
   * @returns True if added successfully, false otherwise
   */
  public addTransaction(transaction: Transaction): boolean {
    // Check if transaction is valid
    if (!transaction.isValid()) {
      console.log(`❌ Invalid transaction rejected: ${transaction.id}`);
      return false;
    }

    // Check if transaction already exists
    if (this.transactions.has(transaction.id)) {
      console.log(`⚠️ Transaction already in pool: ${transaction.id}`);
      return false;
    }

    // Add the transaction
    this.transactions.set(transaction.id, transaction);
    return true;
  }

  /**
   * Removes a transaction from the pool (typically when included in a block).
   * @param transactionId - The ID of the transaction to remove
   * @returns True if removed, false if not found
   */
  public removeTransaction(transactionId: string): boolean {
    const removed = this.transactions.delete(transactionId);
    if (removed) {
      console.log(`🗑️ Transaction removed from pool: ${transactionId}`);
    }
    return removed;
  }

  /**
   * Gets all pending transactions in the pool.
   * @returns Array of all transactions in the pool
   */
  public getAllTransactions(): Transaction[] {
    return Array.from(this.transactions.values());
  }

  /**
   * Gets the number of transactions in the pool.
   * @returns The count of pending transactions
   */
  public size(): number {
    return this.transactions.size;
  }

  /**
   * Clears all transactions from the pool.
   */
  public clear(): void {
    this.transactions.clear();
    console.log("🧹 Transaction pool cleared");
  }

  /**
   * Selects transactions for inclusion in a new block.
   * @param maxTransactions - Maximum number of transactions to select
   * @returns Array of selected transactions
   */
  public selectTransactionsForBlock(
    maxTransactions: number = 10
  ): Transaction[] {
    const transactions = this.getAllTransactions();

    // For now, simply take the first N transactions
    // In a real implementation, you might prioritize by fees
    return transactions.slice(0, maxTransactions);
  }
}

/**
 * Manages UTXO set and provides balance calculation functionality.
 * This is the core of the double-spend prevention system.
 */
export class UTXOSet {
  public utxos: Map<string, UTXO> = new Map();

  /**
   * Adds a new UTXO to the set.
   * @param utxo - The UTXO to add
   */
  public addUTXO(utxo: UTXO): void {
    this.utxos.set(utxo.getId(), utxo);
  }

  /**
   * Marks a UTXO as spent and removes it from the unspent set.
   * @param txId - The transaction ID containing the output
   * @param outputIndex - The output index within the transaction
   * @param spentInTx - The transaction ID that spent this UTXO
   * @returns True if the UTXO was found and marked as spent
   */
  public spendUTXO(
    txId: string,
    outputIndex: number,
    spentInTx: string
  ): boolean {
    const utxoId = `${txId}:${outputIndex}`;
    const utxo = this.utxos.get(utxoId);

    if (!utxo) {
      return false; // UTXO not found
    }

    if (utxo.spent) {
      return false; // Already spent
    }

    utxo.markAsSpent(spentInTx);
    this.utxos.delete(utxoId); // Remove from unspent set
    return true;
  }

  /**
   * Gets a specific UTXO by its transaction ID and output index.
   * @param txId - The transaction ID
   * @param outputIndex - The output index
   * @returns The UTXO if found, undefined otherwise
   */
  public getUTXO(txId: string, outputIndex: number): UTXO | undefined {
    const utxoId = `${txId}:${outputIndex}`;
    return this.utxos.get(utxoId);
  }

  /**
   * Gets all unspent outputs for a specific address.
   * @param address - The address to get UTXOs for
   * @returns Array of unspent UTXOs for the address
   */
  public getUTXOsForAddress(address: string): UTXO[] {
    return Array.from(this.utxos.values()).filter(
      (utxo) => utxo.address === address && !utxo.spent
    );
  }

  /**
   * Calculates the total balance for an address.
   * @param address - The address to calculate balance for
   * @returns The total unspent amount for the address
   */
  public getBalance(address: string): number {
    return this.getUTXOsForAddress(address).reduce(
      (sum, utxo) => sum + utxo.amount,
      0
    );
  }

  /**
   * Checks if a specific UTXO exists and is unspent.
   * @param txId - The transaction ID
   * @param outputIndex - The output index
   * @returns True if the UTXO exists and is unspent
   */
  public hasUnspentUTXO(txId: string, outputIndex: number): boolean {
    const utxoId = `${txId}:${outputIndex}`;
    const utxo = this.utxos.get(utxoId);
    return utxo !== undefined && !utxo.spent;
  }

  /**
   * Validates that a transaction can be spent (all inputs are valid UTXOs).
   * @param transaction - The transaction to validate
   * @returns True if all inputs reference valid unspent UTXOs
   */
  public canSpendTransaction(transaction: Transaction): boolean {
    for (const input of transaction.inputs) {
      if (!this.hasUnspentUTXO(input.txId, input.outputIndex)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Gets the total number of UTXOs in the set.
   * @returns The count of unspent UTXOs
   */
  public size(): number {
    return this.utxos.size;
  }

  /**
   * Gets all UTXOs in the set.
   * @returns Array of all unspent UTXOs
   */
  public getAllUTXOs(): UTXO[] {
    return Array.from(this.utxos.values()).filter((utxo) => !utxo.spent);
  }

  /**
   * Clears all UTXOs from the set.
   */
  public clear(): void {
    this.utxos.clear();
  }
}
