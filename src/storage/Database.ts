import Database from "better-sqlite3";

/**
 * Manages the SQLite database connection and schema initialization.
 * This class provides a centralized point of access to the database,
 * ensuring that the necessary tables are created and a connection is
 * available for other parts of the application.
 */
export class BlockchainDB {
  private readonly db: Database.Database;

  /**
   * Opens a connection to the SQLite database file and initializes the schema.
   * @param dbPath - The path to the SQLite database file. Defaults to 'data/blockchain.db'.
   */
  constructor(dbPath: string = "data/blockchain.db") {
    // Initialize the database connection.
    this.db = new Database(dbPath);

    // Ensure the database schema is created on initialization.
    this.initSchema();
  }

  /**
   * Executes the SQL commands to create the required tables if they don't already exist.
   * This method defines the entire database schema for the blockchain.
   */
  private initSchema(): void {
    this.db.exec(`
      -- The 'blocks' table stores all the blocks in the chain.
      CREATE TABLE IF NOT EXISTS blocks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        block_index INTEGER NOT NULL UNIQUE,
        timestamp INTEGER NOT NULL,
        previous_hash TEXT NOT NULL,
        hash TEXT NOT NULL UNIQUE,
        nonce INTEGER NOT NULL,
        difficulty INTEGER NOT NULL,
        merkle_root TEXT NOT NULL
      );

      -- Indexes for faster queries on block data.
      CREATE INDEX IF NOT EXISTS idx_blocks_hash ON blocks (hash);
      CREATE INDEX IF NOT EXISTS idx_blocks_index ON blocks (block_index);

      -- The 'transactions' table stores all transactions, linking them to a block.
      -- This table represents the 'ledger' of the blockchain.
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        block_id INTEGER,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (block_id) REFERENCES blocks(id)
      );

      -- The 'transaction_outputs' (UTXOs) table stores all unspent outputs.
      -- This is the core of the UTXO model for tracking balances.
      CREATE TABLE IF NOT EXISTS transaction_outputs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_id TEXT NOT NULL,
        output_index INTEGER NOT NULL,
        address TEXT NOT NULL,
        amount INTEGER NOT NULL,
        spent BOOLEAN NOT NULL DEFAULT 0,
        spent_in_tx TEXT, -- The ID of the transaction that spent this output
        UNIQUE(transaction_id, output_index),
        FOREIGN KEY (transaction_id) REFERENCES transactions(id)
      );
      
      -- Indexes for faster UTXO lookups.
      CREATE INDEX IF NOT EXISTS idx_utxo_address ON transaction_outputs (address);
      CREATE INDEX IF NOT EXISTS idx_utxo_spent ON transaction_outputs (spent);

      -- The 'chain_state' table stores key-value metadata about the blockchain,
      -- such as the current tip of the chain or the difficulty.
      CREATE TABLE IF NOT EXISTS chain_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  }

  /**
   * Returns the raw database instance for direct querying.
   * @returns The better-sqlite3 database instance.
   */
  public getInstance(): Database.Database {
    return this.db;
  }

  /**
   * Closes the database connection.
   */
  public close(): void {
    if (this.db) {
      this.db.close();
      console.log("Database connection closed.");
    }
  }
}
