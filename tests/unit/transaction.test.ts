import { Transaction, UTXO, UTXOSet } from "../../src/core/Transaction";

describe("Transaction", () => {
  test("coinbase transaction has no inputs and positive output", () => {
    const tx = Transaction.createCoinbase("miner", 50);
    expect(tx.inputs).toHaveLength(0);
    expect(tx.outputs).toHaveLength(1);
    expect(tx.outputs[0].amount).toBe(50);
    expect(tx.isCoinbase()).toBe(true);
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

describe("UTXOSet", () => {
  test("add, get, spend UTXO", () => {
    const set = new UTXOSet();
    const utxo = new UTXO("tx1", 0, "alice", 10, false);
    set.addUTXO(utxo);
    expect(set.hasUnspentUTXO("tx1", 0)).toBe(true);
    expect(set.getBalance("alice")).toBe(10);
    expect(set.spendUTXO("tx1", 0, "spendtx")).toBe(true);
    expect(set.hasUnspentUTXO("tx1", 0)).toBe(false);
  });
});
