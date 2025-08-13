import "jest-extended";
import * as fs from "fs";
import * as path from "path";

// Ensure a temp data directory for tests exists and is cleaned between tests
const TEST_DATA_DIR = path.resolve(__dirname, "..", "tmp");

beforeAll(() => {
  if (!fs.existsSync(TEST_DATA_DIR)) {
    fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
  }
});

afterEach(() => {
  // Clean tmp dir after each test to isolate DB state
  if (fs.existsSync(TEST_DATA_DIR)) {
    for (const entry of fs.readdirSync(TEST_DATA_DIR)) {
      const p = path.join(TEST_DATA_DIR, entry);
      try {
        fs.statSync(p).isDirectory()
          ? fs.rmSync(p, { recursive: true, force: true })
          : fs.unlinkSync(p);
      } catch {}
    }
  }
});

afterAll(() => {
  try {
    fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  } catch {}
});

export function getTempDbPath(name: string): string {
  return path.join(TEST_DATA_DIR, `${name}.db`);
}
