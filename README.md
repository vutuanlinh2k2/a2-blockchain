# 🔗 A2-Blockchain

A **TypeScript blockchain implementation** with Proof-of-Work consensus, UTXO model, and professional CLI interface. This project demonstrates core blockchain concepts through a fully functional implementation.

## 🚀 Quick Start

### Prerequisites

- Node.js 16+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd a2-blockchain

# Install dependencies
npm install

# Build the project
npm run build
```

### Usage

```bash
# See all available commands
npm start -- --help

# 1. Initialize the blockchain (required first step)
npm start -- init --block-reward 50

# 2. Mine a block to get some coins
npm start -- mine --address my-miner-address

# 3. Send coins to a friend
npm start -- tx --from my-miner-address --to my-friend --amount 10
```

## 🏗️ Architecture Overview

This blockchain implementation follows a modular architecture with clear separation of concerns:

```
src/
├── core/           # Core blockchain logic
│   ├── Block.ts              # Block structure and validation
│   ├── Blockchain.ts         # Main chain management
│   ├── Transaction.ts        # UTXO model implementation
│   ├── ProofOfWork.ts        # Mining consensus
│   ├── MerkleTree.ts         # Transaction verification
│   └── TransactionValidator.ts # Transaction validation
├── storage/        # Data persistence
│   ├── Database.ts           # SQLite database layer
│   └── BlockchainStorage.ts  # Blockchain state management
├── cli/            # Command-line interface
│   ├── commands/             # CLI command implementations
│   │   ├── core.ts           # Core commands (init, mine, tx, balance, etc.)
│   │   ├── demo.ts           # Demonstration commands
│   │   └── maintenance.ts    # Maintenance commands (seed)
│   ├── index.ts              # CLI entry point and command registration
│   ├── types.ts              # CLI-related types and options
│   └── utils.ts              # CLI utilities
└── main.ts         # Application entry point
```

## 🛠️ CLI Commands

All commands are run using `npm start -- <command>`.

### Initialization

```bash
# Initialize a new blockchain (clears any existing data)
npm start -- init [options]
```

_Options:_

- `-m, --genesis-message <message>`: Genesis block message (default: "Genesis Block")
- `-d, --initial-difficulty <number>`: Initial mining difficulty (default: "2")
- `-r, --block-reward <number>`: Block reward for mining (default: "50")

### Core Operations

```bash
# Mine a new block
npm start -- mine --address <address>

# Create transaction
npm start -- tx --from <address> --to <address> --amount <number>

# Check balance
npm start -- balance --address <address>

# Display blockchain
npm start -- display-chain

# Show pending transactions
npm start -- display-mempool
```

### Maintenance

```bash
# Seed with sample data (works on a fresh or existing chain)
npm start -- seed-chain
```

### Demonstrations

```bash
# Show immutability (tamper detection)
npm start -- demo-immutability

# Demonstrate double-spend prevention
npm start -- demo-double-spend

# Show difficulty adjustment
npm start -- demo-difficulty-adjustment
```

## 🔍 Example Workflow

Before you can interact with the blockchain, you must first initialize it. This command creates the database and the genesis block.

### 1. Initialize the Blockchain

```bash
# Create a new blockchain with a custom block reward of 25 and difficulty of 3
npm start -- init --block-reward 25 --initial-difficulty 3
```

This creates a new, clean database for your blockchain.

### 2. Mine Blocks

To get coins, you need to mine a block. The reward will be sent to the address you specify.

```bash
npm start -- mine --address "alice-miner"
```

Alice now has 25 coins (the block reward we set in step 1).

### 3. Create Transactions

Let's have Alice send some coins to Bob.

```bash
npm start -- tx --from "alice-miner" --to "bob-user" --amount 10
```

This creates a transaction from Alice to Bob for 10 coins. The transaction is now in the mempool, waiting to be included in a block.

### 4. Mine the Transaction

To confirm the transaction, someone needs to mine a new block.

```bash
npm start -- mine --address "charlie-miner"
```

Mining a new block will include the transaction from step 3. Charlie gets the mining reward, and Alice's transaction to Bob is now permanent.

### 5. View Chain State

```bash
npm start -- display-chain
```

Displays the complete blockchain, including the new blocks and transactions.

### 6. Check Balances

```bash
# Check Bob's balance
npm start -- balance --address "bob-user"

# Check Alice's balance
npm start -- balance --address "alice-miner"
```

This will show that Bob now has 10 coins, and Alice has her remaining balance.

### 7. View Pending Transactions

Let's create another transaction and see it in the mempool.

```bash
npm start -- tx --from "bob-user" --to "david-user" --amount 5

# View the mempool
npm start -- display-mempool
```

This shows the pending transaction from Bob to David in the mempool, waiting to be mined.

## 🧪 Demonstrations

### **Immutability Demo**

```bash
npm start -- demo-immutability
```

Shows how tampering with historical data invalidates the entire chain.

### **Double-Spend Prevention**

```bash
npm start -- demo-double-spend
```

Demonstrates how the system prevents spending the same coins twice.

### **Difficulty Adjustment**

```bash
npm start -- demo-difficulty-adjustment
```

Illustrates automatic mining difficulty adjustment based on block times.

## 🧪 Testing

This project includes comprehensive unit, integration, and end-to-end (CLI) tests using Jest.

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# Run a specific suite directory
npm test -- tests/unit
npm test -- tests/integration
npm test -- tests/e2e

# Filter by test name
npm test -- -t "Double-spend prevention"
```

Notes:

- CLI E2E tests compile the project before execution to run against `dist/main.js`.
- Tests use isolated temporary directories/databases and do not affect your real data.

## 🔑 Core Features

### 1. **Block Structure** ✅

- **Unique identifier**: Block index/height
- **Timestamp**: Creation/validation time
- **Data payload**: Transaction list with Merkle root
- **Previous block hash**: Chain linkage
- **Cryptographic hash**: SHA-256 of all critical data
- **Consensus fields**: Nonce and difficulty for PoW

### 2. **Cryptographic Hashing & Chain Integrity** ✅

- **SHA-256 hashing**: Industry-standard cryptographic hashing
- **Merkle trees**: Efficient transaction verification
- **Chain integrity**: Tamper detection and validation
- **Immutable ledger**: Historical data cannot be modified

### 3. **Transaction Handling** ✅

- **UTXO model**: Unspent Transaction Output system
- **Transaction pool**: Mempool for pending transactions
- **Input/Output validation**: Comprehensive transaction verification
- **Coinbase transactions**: Mining rewards and new coin creation

### 4. **Consensus Mechanism (Proof-of-Work)** ✅

- **Mining algorithm**: Find nonce meeting difficulty target
- **Difficulty adjustment**: Automatic adjustment every 5 blocks
- **Hash rate calculation**: Performance monitoring
- **Block validation**: Consensus rule enforcement

### 5. **Double-Spend Prevention** ✅

- **UTXO tracking**: Complete spending history
- **Conflict detection**: Reject conflicting transactions
- **Balance validation**: Sufficient funds verification
- **Transaction ordering**: Global transaction sequencing

### 6. **Global Ordering of Blocks** ✅

- **Chronological ordering**: Timestamp-based block sequencing
- **Chain structure**: Sequential block index enforcement
- **Consensus validation**: Ordering enforced by consensus mechanism

### 7. **Data Persistence** ✅

- **SQLite database**: Reliable local storage
- **State recovery**: Automatic blockchain restoration
- **Backup/restore**: Export/import functionality
- **Transaction history**: Complete audit trail

### 8. **Basic User Interface (CLI)** ✅

- **Command-line interface**: Professional CLI with comprehensive commands
- **Transaction creation**: Submit new transactions to the network
- **Block mining**: Initiate block creation and validation process
- **Chain viewing**: Display blockchain contents and statistics
- **Balance checking**: Query address balances and UTXO information
