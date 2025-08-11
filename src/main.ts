/**
 * Main entry point for the Blockchain CLI
 * This file provides a minimal entry point that delegates to the CLI module
 */

import { runCLI } from "./cli";

// Run the CLI if this file is executed directly
if (require.main === module) {
  runCLI().catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  });
}

export { runCLI as main };
