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

describe("CLI E2E", () => {
  beforeAll(() => {
    if (!fs.existsSync(path.dirname(DB)))
      fs.mkdirSync(path.dirname(DB), { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(DB)) fs.rmSync(DB, { force: true });
  });

  test("init, mine, balance flow", () => {
    // build first to have dist/main.js
    const build = spawnSync(NODE, [path.join(ROOT, "node_modules/.bin/tsc")], {
      encoding: "utf8",
    });
    expect(build.status).toBe(0);

    const init = run([
      "init",
      "--genesis-message",
      "E2E",
      "--initial-difficulty",
      "1",
      "--block-reward",
      "10",
    ]);
    expect(init.status).toBe(0);
    const mine = run(["mine", "--address", "miner-e2e"]);
    expect(mine.status).toBe(0);
    const bal = run(["balance", "--address", "miner-e2e"]);
    expect(bal.status).toBe(0);
    expect(bal.stdout).toMatch(/Total: \d+/);
  });
});
