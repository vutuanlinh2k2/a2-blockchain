import Database from "better-sqlite3";
import { Block } from "../core/Block";
import { Transaction, UTXO } from "../core/Transaction";
import { BlockchainDB } from "./Database";

/**
 * Handles all blockchain data persistence operations.
 * Provides methods to save and load blockchain state to/from SQLite database.
 */
export class BlockchainStorage {
  private readonly db: Database.Database;

  constructor(dbInstance: BlockchainDB) {
    this.db = dbInstance.getInstance();
    this.prepareStatements();
  }

  // Prepared statements for better performance
  private saveBlockStmt!: Database.Statement;
  private saveTransactionStmt!: Database.Statement;
  private saveUTXOStmt!: Database.Statement;
  private updateUTXOStmt!: Database.Statement;
  private saveChainStateStmt!: Database.Statement;
  private saveMempoolTxStmt!: Database.Statement;
  private deleteMempoolTxStmt!: Database.Statement;
  private getAllMempoolTxStmt!: Database.Statement;
  private getBlocksStmt!: Database.Statement;
  private getTransactionsStmt!: Database.Statement;
  private getUTXOsStmt!: Database.Statement;
  private getChainStateStmt!: Database.Statement;
  private deleteUTXOStmt!: Database.Statement;

  /**
   * Prepare all SQL statements for better performance.
   */
  private prepareStatements(): void {
    this.saveBlockStmt = this.db.prepare(`
      INSERT OR REPLACE INTO blocks 
      (block_index, timestamp, previous_hash, hash, nonce, difficulty, merkle_root)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    this.saveTransactionStmt = this.db.prepare(`
      INSERT OR REPLACE INTO transactions (id, block_id, timestamp, tx_order)
      VALUES (?, ?, ?, ?)
    `);

    this.saveUTXOStmt = this.db.prepare(`
      INSERT OR REPLACE INTO transaction_outputs 
      (transaction_id, output_index, address, amount, spent, spent_in_tx)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    this.updateUTXOStmt = this.db.prepare(`
      UPDATE transaction_outputs 
      SET spent = ?, spent_in_tx = ?
      WHERE transaction_id = ? AND output_index = ?
    `);

    this.saveChainStateStmt = this.db.prepare(`
      INSERT OR REPLACE INTO chain_state (key, value) VALUES (?, ?)
    `);

    this.getBlocksStmt = this.db.prepare(`
      SELECT * FROM blocks ORDER BY block_index ASC
    `);

    this.getTransactionsStmt = this.db.prepare(`
      SELECT t.*, b.block_index 
      FROM transactions t 
      JOIN blocks b ON t.block_id = b.id 
      WHERE b.block_index = ?
      ORDER BY t.tx_order ASC
    `);

    this.getUTXOsStmt = this.db.prepare(`
      SELECT * FROM transaction_outputs WHERE spent = 0
    `);

    this.getChainStateStmt = this.db.prepare(`
      SELECT value FROM chain_state WHERE key = ?
    `);

    this.deleteUTXOStmt = this.db.prepare(`
      DELETE FROM transaction_outputs 
      WHERE transaction_id = ? AND output_index = ?
    `);

    // Mempool persistence statements
    this.saveMempoolTxStmt = this.db.prepare(`
      INSERT OR REPLACE INTO mempool_transactions (id, timestamp, serialized)
      VALUES (?, ?, ?)
    `);
    this.deleteMempoolTxStmt = this.db.prepare(`
      DELETE FROM mempool_transactions WHERE id = ?
    `);
    this.getAllMempoolTxStmt = this.db.prepare(`
      SELECT id, timestamp, serialized FROM mempool_transactions ORDER BY timestamp ASC
    `);
  }

  /**
   * Saves a complete block and its transactions to the database.
   * @param block - The block to save
   * @returns True if saved successfully
   */
  public saveBlock(block: Block): boolean {
    try {
      const transaction = this.db.transaction(() => {
        // Save the block
        const blockResult = this.saveBlockStmt.run(
          block.index,
          block.timestamp,
          block.previousHash,
          block.hash,
          block.nonce,
          block.difficulty,
          block.merkleRoot
        );

        const blockId = blockResult.lastInsertRowid;

        // Save all transactions in the block
        for (let txIndex = 0; txIndex < block.transactions.length; txIndex++) {
          const tx = block.transactions[txIndex];
          this.saveTransactionStmt.run(tx.id, blockId, tx.timestamp, txIndex);

          // Save all transaction outputs as UTXOs
          for (let i = 0; i < tx.outputs.length; i++) {
            const output = tx.outputs[i];
            this.saveUTXOStmt.run(
              tx.id,
              i,
              output.address,
              output.amount,
              0, // Initially unspent (false = 0)
              null // Not spent in any transaction yet
            );
          }
        }

        // Update spent UTXOs for transaction inputs
        for (const tx of block.transactions) {
          for (const input of tx.inputs) {
            this.updateUTXOStmt.run(
              1, // Mark as spent (true = 1)
              tx.id, // Spent in this transaction
              input.txId,
              input.outputIndex
            );
          }
        }
      });

      transaction();
      console.log(`💾 Block ${block.index} saved`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to save block ${block.index}:`, error);
      return false;
    }
  }

  /**
   * Loads all blocks from the database and reconstructs the blockchain.
   * @returns Array of blocks in chronological order
   */
  public loadBlocks(): Block[] {
    try {
      const blockRows = this.getBlocksStmt.all() as any[];
      const blocks: Block[] = [];

      for (const row of blockRows) {
        // Load transactions for this block
        const txRows = this.getTransactionsStmt.all(row.block_index) as any[];
        const transactions: Transaction[] = [];

        // Reconstruct transactions from database
        for (const txRow of txRows) {
          const transaction = this.reconstructTransaction(txRow.id);
          if (transaction) {
            transactions.push(transaction);
          }
        }

        // Create the block
        const block = new Block(
          row.block_index,
          transactions,
          row.previous_hash,
          row.nonce,
          row.difficulty,
          row.timestamp
        );

        // Verify the hash matches what's in the database
        if (block.hash !== row.hash) {
          throw new Error(
            `Block ${row.block_index} hash mismatch: expected ${row.hash}, got ${block.hash}`
          );
        }

        blocks.push(block);
      }

      console.log(`📖 Loaded ${blocks.length} blocks from database`);
      return blocks;
    } catch (error) {
      console.error("❌ Failed to load blocks from database:", error);
      return [];
    }
  }

  /**
   * Reconstructs a transaction from the database including inputs and outputs.
   * @param transactionId - The transaction ID to reconstruct
   * @returns The reconstructed transaction or null if not found
   */
  private reconstructTransaction(transactionId: string): Transaction | null {
    try {
      // Get transaction basic info
      const txInfo = this.db
        .prepare(
          `
        SELECT * FROM transactions WHERE id = ?
      `
        )
        .get(transactionId) as any;

      if (!txInfo) {
        return null;
      }

      // Get transaction inputs (spent UTXOs)
      const inputRows = this.db
        .prepare(
          `
        SELECT transaction_id as txId, output_index as outputIndex
        FROM transaction_outputs 
        WHERE spent_in_tx = ?
      `
        )
        .all(transactionId) as any[];

      const inputs = inputRows.map((row) => ({
        txId: row.txId,
        outputIndex: row.outputIndex,
      }));

      // Get transaction outputs
      const outputRows = this.db
        .prepare(
          `
        SELECT address, amount 
        FROM transaction_outputs 
        WHERE transaction_id = ?
        ORDER BY output_index ASC
      `
        )
        .all(transactionId) as any[];

      const outputs = outputRows.map((row) => ({
        address: row.address,
        amount: row.amount,
      }));

      // Create the transaction
      const transaction = new Transaction(inputs, outputs, txInfo.timestamp);

      // Verify the ID matches
      if (transaction.id !== transactionId) {
        throw new Error(
          `Transaction ID mismatch: expected ${transactionId}, got ${transaction.id}`
        );
      }

      return transaction;
    } catch (error) {
      console.error(
        `❌ Failed to reconstruct transaction ${transactionId}:`,
        error
      );
      return null;
    }
  }

  /**
   * Loads all unspent UTXOs from the database.
   * @returns Array of unspent UTXOs
   */
  public loadUTXOs(): UTXO[] {
    try {
      const utxoRows = this.getUTXOsStmt.all() as any[];
      const utxos = utxoRows.map(
        (row) =>
          new UTXO(
            row.transaction_id,
            row.output_index,
            row.address,
            row.amount,
            row.spent,
            row.spent_in_tx
          )
      );

      console.log(`💰 Loaded ${utxos.length} UTXOs from database`);
      return utxos;
    } catch (error) {
      console.error("❌ Failed to load UTXOs from database:", error);
      return [];
    }
  }

  /**
   * Marks a UTXO as spent in the database.
   * @param txId - Transaction ID containing the UTXO
   * @param outputIndex - Output index within the transaction
   * @param spentInTx - Transaction ID that spent this UTXO
   * @returns True if updated successfully
   */
  public markUTXOSpent(
    txId: string,
    outputIndex: number,
    spentInTx: string
  ): boolean {
    try {
      const result = this.updateUTXOStmt.run(1, spentInTx, txId, outputIndex); // 1 = true
      return result.changes > 0;
    } catch (error) {
      console.error(
        `❌ Failed to mark UTXO as spent ${txId}:${outputIndex}:`,
        error
      );
      return false;
    }
  }

  /**
   * Saves chain state metadata.
   * @param key - The state key
   * @param value - The state value
   * @returns True if saved successfully
   */
  public saveChainState(key: string, value: string): boolean {
    try {
      this.saveChainStateStmt.run(key, value);
      return true;
    } catch (error) {
      console.error(`❌ Failed to save chain state ${key}:`, error);
      return false;
    }
  }

  /**
   * Persist a transaction in the mempool storage.
   */
  public saveMempoolTransaction(
    id: string,
    timestamp: number,
    serialized: string
  ): boolean {
    try {
      this.saveMempoolTxStmt.run(id, timestamp, serialized);
      return true;
    } catch (error) {
      console.error(`❌ Failed to save mempool transaction ${id}:`, error);
      return false;
    }
  }

  /**
   * Remove a transaction from the mempool storage by id.
   */
  public deleteMempoolTransaction(id: string): boolean {
    try {
      this.deleteMempoolTxStmt.run(id);
      return true;
    } catch (error) {
      console.error(`❌ Failed to delete mempool transaction ${id}:`, error);
      return false;
    }
  }

  /**
   * Load all mempool transactions from storage.
   */
  public loadMempoolTransactions(): {
    id: string;
    timestamp: number;
    serialized: string;
  }[] {
    try {
      const rows = this.getAllMempoolTxStmt.all() as any[];
      return rows.map((r) => ({
        id: r.id,
        timestamp: r.timestamp,
        serialized: r.serialized,
      }));
    } catch (error) {
      console.error("❌ Failed to load mempool transactions:", error);
      return [];
    }
  }

  /**
   * Loads chain state metadata.
   * @param key - The state key to retrieve
   * @returns The state value or null if not found
   */
  public loadChainState(key: string): string | null {
    try {
      const result = this.getChainStateStmt.get(key) as any;
      return result?.value || null;
    } catch (error) {
      console.error(`❌ Failed to load chain state ${key}:`, error);
      return null;
    }
  }

  /**
   * Exports the entire blockchain to a JSON file.
   * @param filePath - Path to save the export file
   * @returns True if exported successfully
   */
  public exportToFile(filePath: string): boolean {
    try {
      const fs = require("fs");
      const path = require("path");

      // Ensure directory exists
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Load all data
      const blocks = this.loadBlocks();
      const utxos = this.loadUTXOs();

      // Get all chain state
      const chainStateRows = this.db
        .prepare(`SELECT * FROM chain_state`)
        .all() as any[];
      const chainState: Record<string, string> = {};
      for (const row of chainStateRows) {
        chainState[row.key] = row.value;
      }

      const exportData = {
        version: "1.0",
        timestamp: Date.now(),
        blocks: blocks.map((block) => ({
          index: block.index,
          timestamp: block.timestamp,
          transactions: block.transactions.map((tx) => ({
            id: tx.id,
            timestamp: tx.timestamp,
            inputs: tx.inputs,
            outputs: tx.outputs,
          })),
          previousHash: block.previousHash,
          merkleRoot: block.merkleRoot,
          nonce: block.nonce,
          difficulty: block.difficulty,
          hash: block.hash,
        })),
        utxos: utxos.map((utxo) => ({
          txId: utxo.txId,
          outputIndex: utxo.outputIndex,
          address: utxo.address,
          amount: utxo.amount,
          spent: utxo.spent,
          spentInTx: utxo.spentInTx,
        })),
        chainState,
      };

      fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2));
      console.log(`📤 Blockchain exported to ${filePath}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to export blockchain to ${filePath}:`, error);
      return false;
    }
  }

  /**
   * Imports blockchain data from a JSON file.
   * @param filePath - Path to the import file
   * @returns True if imported successfully
   */
  public importFromFile(filePath: string): boolean {
    try {
      const fs = require("fs");

      if (!fs.existsSync(filePath)) {
        console.error(`❌ Import file not found: ${filePath}`);
        return false;
      }

      const importData = JSON.parse(fs.readFileSync(filePath, "utf8"));

      // Validate import data structure
      if (
        !importData.version ||
        !importData.blocks ||
        !Array.isArray(importData.blocks)
      ) {
        console.error("❌ Invalid import file format");
        return false;
      }

      console.log(`📥 Importing blockchain from ${filePath}...`);

      // Clear existing data
      this.clearAllData();

      const transaction = this.db.transaction(() => {
        // Import blocks and transactions
        for (const blockData of importData.blocks) {
          // Reconstruct transactions
          const transactions = blockData.transactions.map(
            (txData: any) =>
              new Transaction(txData.inputs, txData.outputs, txData.timestamp)
          );

          // Create block
          const block = new Block(
            blockData.index,
            transactions,
            blockData.previousHash,
            blockData.nonce,
            blockData.difficulty,
            blockData.timestamp
          );

          // Verify hash integrity
          if (block.hash !== blockData.hash) {
            throw new Error(
              `Block ${blockData.index} hash mismatch during import`
            );
          }

          // Save block (this will also save transactions and UTXOs)
          if (!this.saveBlock(block)) {
            throw new Error(
              `Failed to save block ${blockData.index} during import`
            );
          }
        }

        // Import chain state
        if (importData.chainState) {
          for (const [key, value] of Object.entries(importData.chainState)) {
            this.saveChainState(key, value as string);
          }
        }
      });

      transaction();
      console.log(
        `✅ Successfully imported ${importData.blocks.length} blocks`
      );
      return true;
    } catch (error) {
      console.error(`❌ Failed to import blockchain from ${filePath}:`, error);
      return false;
    }
  }

  /**
   * Clears all blockchain data from the database.
   * WARNING: This will permanently delete all data!
   */
  public clearAllData(): void {
    try {
      const transaction = this.db.transaction(() => {
        this.db.exec(`DELETE FROM transaction_outputs`);
        this.db.exec(`DELETE FROM transactions`);
        this.db.exec(`DELETE FROM blocks`);
        this.db.exec(`DELETE FROM chain_state`);
        this.db.exec(`DELETE FROM mempool_transactions`);
      });

      transaction();
      console.log("🧹 All blockchain data cleared from database");
    } catch (error) {
      console.error("❌ Failed to clear database:", error);
      throw error;
    }
  }

  /**
   * Gets statistics about the database.
   * @returns Database statistics
   */
  public getDatabaseStats(): {
    blockCount: number;
    transactionCount: number;
    utxoCount: number;
    spentUtxoCount: number;
    chainStateCount: number;
  } {
    try {
      const blockCount = this.db
        .prepare(`SELECT COUNT(*) as count FROM blocks`)
        .get() as any;
      const transactionCount = this.db
        .prepare(`SELECT COUNT(*) as count FROM transactions`)
        .get() as any;
      const utxoCount = this.db
        .prepare(
          `SELECT COUNT(*) as count FROM transaction_outputs WHERE spent = 0`
        )
        .get() as any;
      const spentUtxoCount = this.db
        .prepare(
          `SELECT COUNT(*) as count FROM transaction_outputs WHERE spent = 1`
        )
        .get() as any;
      const chainStateCount = this.db
        .prepare(`SELECT COUNT(*) as count FROM chain_state`)
        .get() as any;

      return {
        blockCount: blockCount.count,
        transactionCount: transactionCount.count,
        utxoCount: utxoCount.count,
        spentUtxoCount: spentUtxoCount.count,
        chainStateCount: chainStateCount.count,
      };
    } catch (error) {
      console.error("❌ Failed to get database stats:", error);
      return {
        blockCount: 0,
        transactionCount: 0,
        utxoCount: 0,
        spentUtxoCount: 0,
        chainStateCount: 0,
      };
    }
  }

  /**
   * Checks if the database is empty (no blocks exist).
   * @returns True if database is empty, false otherwise
   */
  public isDatabaseEmpty(): boolean {
    try {
      const stats = this.getDatabaseStats();
      return stats.blockCount === 0;
    } catch (error) {
      console.error("❌ Failed to check if database is empty:", error);
      return false;
    }
  }
}
