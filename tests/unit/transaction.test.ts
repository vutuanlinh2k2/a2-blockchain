import { Transaction, TransactionPool } from "../../src/core/Transaction";

describe("Transaction", () => {
  test("transaction with inputs and outputs is valid", () => {
    const inputs = [{ txId: "prevTx", outputIndex: 0 }];
    const outputs = [{ address: "alice", amount: 50 }];

    const tx = new Transaction(inputs, outputs);
    expect(tx.inputs).toHaveLength(1);
    expect(tx.outputs).toHaveLength(1);
    expect(tx.isCoinbase()).toBe(false);
    expect(tx.isValid()).toBe(true);
  });

  test("invalid when any output amount <= 0", () => {
    const tx = new Transaction(
      [{ txId: "a", outputIndex: 0 }],
      [{ address: "x", amount: 0 }]
    );
    expect(tx.isValid()).toBe(false);
  });
});

describe("TransactionPool", () => {
  let pool: TransactionPool;

  beforeEach(() => {
    pool = new TransactionPool();
  });

  test("adds valid transaction to pool", () => {
    const tx = new Transaction(
      [{ txId: "prevTx", outputIndex: 0 }],
      [{ address: "alice", amount: 50 }]
    );

    const result = pool.addTransaction(tx);
    expect(result).toBe(true);
    expect(pool.getAllTransactions()).toHaveLength(1);
  });

  test("selects transactions for block", () => {
    const tx = new Transaction(
      [{ txId: "prevTx", outputIndex: 0 }],
      [{ address: "alice", amount: 50 }]
    );

    pool.addTransaction(tx);
    const selected = pool.selectTransactionsForBlock(10);
    expect(selected).toHaveLength(1);
    expect(selected[0].id).toBe(tx.id);
  });

  test("removes transaction from pool", () => {
    const tx = new Transaction(
      [{ txId: "prevTx", outputIndex: 0 }],
      [{ address: "alice", amount: 50 }]
    );

    pool.addTransaction(tx);
    expect(pool.getAllTransactions()).toHaveLength(1);

    pool.removeTransaction(tx.id);
    expect(pool.getAllTransactions()).toHaveLength(0);
  });
});
