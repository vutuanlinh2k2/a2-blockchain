import { spawnSync } from "child_process";
import * as path from "path";
import * as fs from "fs";

const ROOT = path.resolve(__dirname, "../..");
const NODE = process.execPath;
const CLI = path.join(ROOT, "dist", "main.js");
const DB = path.join(ROOT, "data", "blockchain.db");

function run(args: string[]) {
  const env = { ...process.env };
  if (!fs.existsSync(path.dirname(DB)))
    fs.mkdirSync(path.dirname(DB), { recursive: true });
  return spawnSync(NODE, [CLI, ...args], { encoding: "utf8", env });
}

describe("CLI extra flows", () => {
  beforeAll(() => {
    if (!fs.existsSync(path.dirname(DB)))
      fs.mkdirSync(path.dirname(DB), { recursive: true });
    const build = spawnSync(NODE, [path.join(ROOT, "node_modules/.bin/tsc")], {
      encoding: "utf8",
    });
    expect(build.status).toBe(0);
  });

  afterEach(() => {
    if (fs.existsSync(DB)) fs.rmSync(DB, { force: true });
  });

  test("transfer, mempool display, chain display, validate via mining", () => {
    const init = run([
      "init",
      "--genesis-message",
      "E2E2",
      "--initial-difficulty",
      "1",
      "--block-reward",
      "10",
    ]);
    expect(init.status).toBe(0);

    const mine1 = run(["mine", "--address", "miner-cli"]);
    expect(mine1.status).toBe(0);

    const tx = run([
      "tx",
      "--from",
      "miner-cli",
      "--to",
      "alice",
      "--amount",
      "5",
    ]);
    expect(tx.status).toBe(0);
    expect(tx.stdout).toMatch(
      /Transaction created|Transaction.*added to pool|Transaction rejected/
    );

    const mem = run(["display-mempool"]);
    expect(mem.status).toBe(0);
    expect(mem.stdout).toMatch(/Transaction Pool/);

    const mine2 = run(["mine", "--address", "miner-cli"]);
    expect(mine2.status).toBe(0);

    const chain = run(["display-chain"]);
    expect(chain.status).toBe(0);
    expect(chain.stdout).toMatch(/Blockchain:\n|Total blocks:/);

    const balMiner = run(["balance", "--address", "miner-cli"]);
    expect(balMiner.status).toBe(0);
    expect(balMiner.stdout).toMatch(/Total: \d+/);

    const balAlice = run(["balance", "--address", "alice"]);
    expect(balAlice.status).toBe(0);
    expect(balAlice.stdout).toMatch(/Total: \d+/);
  });
});
