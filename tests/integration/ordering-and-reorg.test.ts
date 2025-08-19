import { Blockchain } from "../../src/core/Blockchain";
import { Block } from "../../src/core/Block";
import { Transaction } from "../../src/core/Transaction";

describe("Global ordering and reorganization", () => {
  test("rejects block with non-increasing timestamp", async () => {
    const bc = new Blockchain({
      genesisMessage: "G",
      initialDifficulty: 1,
      blockReward: 1,
    });
    const miner = "m";
    const b1 = await bc.mineBlock(miner);
    expect(b1).not.toBeNull();
    const prev = bc.getLatestBlock();
    const tx = Transaction.createCoinbase("m", 1);
    const bad = new Block(
      prev.index + 1,
      [tx],
      prev.hash,
      0,
      prev.difficulty,
      prev.timestamp
    ); // same timestamp
    expect(bc.addBlock(bad)).toBe(false);
  });
});
