import { ProofOfWork } from "../../src/core/ProofOfWork";
import { Block } from "../../src/core/Block";
import { Transaction } from "../../src/core/Transaction";

describe("ProofOfWork difficulty adjustment at interval", () => {
  test("adjusts difficulty when index hits adjustment interval boundary", () => {
    const pow = new ProofOfWork({
      adjustmentInterval: 5,
      targetBlockTime: 10000,
    });
    const tx = Transaction.createCoinbase("m", 1);

    // Build 5 blocks (indexes 0..4) so that the latest index (4) is a multiple boundary? We need the latest index % interval === 0
    // The algorithm checks latestBlock.index % interval === 0. We'll create blocks up to index 5 (0..5) so 5 % 5 === 0.
    const blocks: Block[] = [];
    let prevHash = "0".repeat(64);
    let timestamp = Date.now();

    // Create index 0..5, with fast timestamps (1s apart) to trigger increase
    for (let i = 0; i <= 5; i++) {
      const b = new Block(i, [tx], prevHash, 0, 2, timestamp);
      blocks.push(b);
      prevHash = b.hash;
      timestamp += 1000; // 1s between blocks to simulate fast mining
    }

    const currentDifficulty = 2;
    const next = pow.calculateNextDifficulty(blocks, currentDifficulty);
    expect(next).toBeGreaterThanOrEqual(3); // should increase at least by 1
  });
});
