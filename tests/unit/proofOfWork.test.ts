import { ProofOfWork } from "../../src/core/ProofOfWork";
import { Block } from "../../src/core/Block";
import { Transaction } from "../../src/core/Transaction";

describe("ProofOfWork", () => {
  test("validateProofOfWork passes for block with matching hash and difficulty", () => {
    const tx = Transaction.createCoinbase("m", 1);
    const b = new Block(1, [tx], "0".repeat(64), 0, 1, Date.now());
    const pow = new ProofOfWork();
    // mine minimally by incrementing until valid
    let candidate = b;
    for (let i = 0; i < 100000; i++) {
      if (candidate.hasValidProofOfWork()) break;
      candidate = candidate.incrementNonce();
    }
    expect(pow.validateProofOfWork(candidate)).toBe(true);
  });

  test("calculateNextDifficulty keeps difficulty when not at interval", () => {
    const pow = new ProofOfWork({ adjustmentInterval: 5 });
    const blocks: Block[] = [];
    const tx = Transaction.createCoinbase("m", 1);
    let prevHash = "0".repeat(64);
    for (let i = 0; i < 3; i++) {
      const b = new Block(i, [tx], prevHash, 0, 2, Date.now() + i);
      blocks.push(b);
      prevHash = b.hash;
    }
    expect(pow.calculateNextDifficulty(blocks, 2)).toBe(2);
  });
});
