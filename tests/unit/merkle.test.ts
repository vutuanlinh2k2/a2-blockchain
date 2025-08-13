import { MerkleTree } from "../../src/core/MerkleTree";

describe("MerkleTree", () => {
  test("root hash computed for even number of leaves", () => {
    const ids = Array.from({ length: 4 }).map((_, i) =>
      `${i}`.padStart(64, "0")
    );
    const tree = MerkleTree.fromTransactionIds(ids);
    const root = tree.getRootHash();
    expect(root).toBeTruthy();
    expect(root).toHaveLength(64);
  });

  test("root hash computed for odd number of leaves (duplicates last)", () => {
    const ids = Array.from({ length: 3 }).map((_, i) =>
      `${i}`.padStart(64, "0")
    );
    const tree = MerkleTree.fromTransactionIds(ids);
    const root = tree.getRootHash();
    expect(root).toBeTruthy();
    expect(root).toHaveLength(64);
  });

  test("empty input substitutes default leaf", () => {
    const tree = MerkleTree.fromTransactionIds([]);
    const root = tree.getRootHash();
    expect(root).toBeTruthy();
    expect(root).toHaveLength(64);
  });
});
