import { Block } from '../../src/core/Block';
import { Transaction } from '../../src/core/Transaction';

describe('Block', () => {
  test('creates genesis block with expected defaults', () => {
    const genesis = Block.createGenesis('hello');
    expect(genesis.index).toBe(0);
    expect(genesis.previousHash).toMatch(/^0{64}$/);
    expect(genesis.difficulty).toBeGreaterThanOrEqual(1);
    expect(typeof genesis.hash).toBe('string');
    expect(genesis.merkleRoot).toHaveLength(64);
  });

  test('hash depends on critical data and changes on nonce increment', () => {
    const tx = Transaction.createCoinbase('miner', 50);
    const b1 = new Block(1, [tx], 'a'.repeat(64), 0, 2, Date.now());
    const b2 = b1.incrementNonce();
    expect(b2.nonce).toBe(b1.nonce + 1);
    expect(b2.hash).not.toBe(b1.hash);
    // merkleRoot must be consistent with transactions
    expect(b1.merkleRoot).toHaveLength(64);
  });

  test('isValidSuccessor enforces index, previousHash and timestamp ordering', () => {
    const tx = Transaction.createCoinbase('miner', 10);
    const b1 = new Block(1, [tx], '0'.repeat(64), 0, 1, Date.now());
    const b2 = new Block(2, [tx], b1.hash, 0, 1, b1.timestamp + 1);
    expect(b2.isValidSuccessor(b1)).toBe(true);

    const badPrev = new Block(2, [tx], 'x'.repeat(64), 0, 1, b1.timestamp + 1);
    expect(badPrev.isValidSuccessor(b1)).toBe(false);

    const badIdx = new Block(3, [tx], b1.hash, 0, 1, b1.timestamp + 1);
    expect(badIdx.isValidSuccessor(b2)).toBe(false);

    const badTime = new Block(2, [tx], b1.hash, 0, 1, b1.timestamp);
    expect(badTime.isValidSuccessor(b1)).toBe(false);
  });
});


