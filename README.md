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

# Run the CLI
npm run cli
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
│   │   ├── core.ts           # Core commands (mine, tx, balance, etc.)
│   │   ├── demo.ts           # Demonstration commands
│   │   └── maintenance.ts    # Maintenance commands (clear, seed)
│   ├── index.ts              # CLI entry point and command registration
│   ├── types.ts              # CLI-related types and options
│   └── utils.ts              # CLI utilities
└── main.ts         # Application entry point
```

## 🛠️ CLI Commands

### Core Operations

```bash
# Mine a new block
blockchain mine --address <address>

# Create transaction
blockchain tx --from <address> --to <address> --amount <number>

# Check balance
blockchain balance --address <address>

# Display blockchain
blockchain display-chain [--limit <number>]

# Show pending transactions
blockchain display-mempool
```

### Maintenance

```bash
# Clear all blockchain data
blockchain clear-chain

# Seed with sample data
blockchain seed-chain
```

### Demonstrations

```bash
# Show immutability (tamper detection)
blockchain demo-immutability

# Demonstrate double-spend prevention
blockchain demo-double-spend

# Show difficulty adjustment
blockchain demo-difficulty-adjustment
```

## 🔍 Example Workflow

The blockchain automatically initializes with a genesis block when you first run any command. Here's the typical workflow:

### 1. Mine Blocks

```bash
blockchain mine --address "alice-miner"
```

Mines a new block with pending transactions, adjusting difficulty automatically.

### 2. Create Transactions

```bash
blockchain tx --from "alice-miner" --to "bob-user" --amount 25
```

Creates a transaction from Alice to Bob for 25 coins.

### 3. View Chain State

```bash
blockchain display-chain --limit 20
```

Displays the complete blockchain with transaction details and hash linkages.

### 4. Check Balances

```bash
blockchain balance --address "bob-user"
```

Shows Bob's current balance and available UTXOs.

### 5. View Pending Transactions

```bash
blockchain display-mempool
```

Shows all pending transactions in the mempool waiting to be mined.

## 🧪 Demonstrations

### **Immutability Demo**

```bash
blockchain demo-immutability
```

Shows how tampering with historical data invalidates the entire chain.

### **Double-Spend Prevention**

```bash
blockchain demo-double-spend
```

Demonstrates how the system prevents spending the same coins twice.

### **Difficulty Adjustment**

```bash
blockchain demo-difficulty
```

Illustrates automatic mining difficulty adjustment based on block times.

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
