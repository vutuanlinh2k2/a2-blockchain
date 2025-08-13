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

  test("considers and adopts longer valid alternative chain", async () => {
    const bc = new Blockchain({
      genesisMessage: "G",
      initialDifficulty: 1,
      blockReward: 5,
    });
    const miner = "m";
    const b1 = await bc.mineBlock(miner);
    expect(b1).not.toBeNull();
    const b2 = await bc.mineBlock(miner);
    expect(b2).not.toBeNull();

    // Build an alternative longer chain starting from genesis
    const original = bc.getChain();
    const alt: Block[] = [original[0]];
    let prev = alt[0];
    for (let i = 1; i <= 3; i++) {
      let candidate = new Block(
        prev.index + 1,
        [Transaction.createCoinbase(miner, 5)],
        prev.hash,
        0,
        1,
        prev.timestamp + 1
      );
      // brute force nonce to satisfy difficulty 1
      for (let n = 0; n < 100000; n++) {
        if (candidate.hasValidProofOfWork()) break;
        candidate = candidate.incrementNonce();
      }
      alt.push(candidate);
      prev = candidate;
    }

    const changed = bc.considerChainReorganization(alt);
    expect(changed).toBe(true);
    expect(bc.getChain().length).toBe(alt.length);
  });
});
