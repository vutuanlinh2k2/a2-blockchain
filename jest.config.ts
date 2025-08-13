import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  testMatch: ["**/?(*.)+(spec|test).ts"],
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
  verbose: false,
  testTimeout: 60000,
  maxWorkers: 1,
  moduleNameMapper: {
    "^@core/(.*)$": "<rootDir>/src/core/$1",
    "^@crypto/(.*)$": "<rootDir>/src/crypto/$1",
    "^@storage/(.*)$": "<rootDir>/src/storage/$1",
    "^@cli/(.*)$": "<rootDir>/src/cli/$1",
    "^@utils/(.*)$": "<rootDir>/src/utils/$1",
  },
  transform: {
    "^.+\\.(t|j)s$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.json" }],
  },
  collectCoverageFrom: ["src/**/*.ts", "!src/main.ts", "!src/cli/**"],
};

export default config;
