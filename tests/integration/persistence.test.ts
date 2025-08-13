import { Blockchain } from "../../src/core/Blockchain";
import { getTempDbPath } from "../setup";

describe("Persistence (SQLite)", () => {
  test("saves and reloads chain with same tip and balances", async () => {
    const dbPath = getTempDbPath("chain");
    const cfg = { genesisMessage: "G", initialDifficulty: 1, blockReward: 25 };

    const bc1 = new Blockchain(cfg, dbPath);
    await bc1.mineBlock("miner");
    await bc1.mineBlock("miner");
    const tip1 = bc1.getLatestBlock().hash;
    const bal1 = bc1.getBalance("miner");
    bc1.close();

    const bc2 = new Blockchain(cfg, dbPath);
    expect(bc2.getLatestBlock().hash).toBe(tip1);
    expect(bc2.getBalance("miner")).toBe(bal1);
    bc2.close();
  });
});
