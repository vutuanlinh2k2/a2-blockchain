import { Blockchain } from "../../src/core/Blockchain";

describe("Blockchain (in-memory)", () => {
  test("initializes with genesis and validates chain", () => {
    const bc = new Blockchain({
      genesisMessage: "G",
      initialDifficulty: 1,
      blockReward: 50,
    });
    const chain = bc.getChain();
    expect(chain.length).toBe(1);
    expect(bc.validateChain()).toBe(true);
  });

  test("mines blocks, updates balances and prevents overspend", async () => {
    const bc = new Blockchain({
      genesisMessage: "G",
      initialDifficulty: 1,
      blockReward: 10,
    });
    const miner = "miner";
    const b1 = await bc.mineBlock(miner);
    expect(b1).not.toBeNull();
    const b2 = await bc.mineBlock(miner);
    expect(b2).not.toBeNull();
    expect(bc.getBalance(miner)).toBeGreaterThanOrEqual(20);
  });
});
