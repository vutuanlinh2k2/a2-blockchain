import { Blockchain } from "../../src/core/Blockchain";
import { Transaction } from "../../src/core/Transaction";

describe("Double-spend prevention", () => {
  test("rejects conflicting transaction that spends same inputs", async () => {
    const bc = new Blockchain({
      genesisMessage: "G",
      initialDifficulty: 1,
      blockReward: 50,
    });
    const miner = "miner";
    // Mine to give miner spendable UTXOs
    await bc.mineBlock(miner);
    await bc.mineBlock(miner);

    // Create a valid transaction from miner to alice
    const tx1 = bc.createTransaction(miner, "alice", 20);
    expect(tx1).not.toBeNull();
    const add1 = bc.addTransaction(tx1!);
    expect(add1.isValid).toBe(true);

    // Create a conflicting tx that reuses the same inputs but different outputs
    const conflicting = new Transaction(tx1!.inputs, [
      { address: "attacker", amount: tx1!.getTotalOutputAmount() },
    ]);
    const add2 = bc.addTransaction(conflicting);
    expect(add2.isValid).toBe(false);
    expect(add2.errors.join(" ")).toMatch(/Double-spend|already spent/i);
  });
});
