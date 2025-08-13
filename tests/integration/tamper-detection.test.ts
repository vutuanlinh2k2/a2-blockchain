import { Blockchain } from "../../src/core/Blockchain";

describe("Tamper detection (immutability)", () => {
  test("modifying historical block invalidates the chain", async () => {
    const bc = new Blockchain({
      genesisMessage: "G",
      initialDifficulty: 1,
      blockReward: 10,
    });

    // Mine several blocks so there is something to tamper with (non-genesis)
    const miner = "miner";
    const b1 = await bc.mineBlock(miner);
    expect(b1).not.toBeNull();
    const b2 = await bc.mineBlock(miner);
    expect(b2).not.toBeNull();

    // Sanity: chain valid before tamper
    expect(bc.validateChain()).toBe(true);

    // Tamper with block at index 1 (first non-genesis)
    const tampered = bc.tamperBlockData(1);
    expect(tampered).toBe(true);

    // Chain must now be invalid
    expect(bc.validateChain()).toBe(false);
  });
});
