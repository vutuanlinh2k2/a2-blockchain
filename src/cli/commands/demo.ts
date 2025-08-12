import { Command } from "commander";
import chalk from "chalk";
import { handleError, initBlockchain } from "../utils";
import { Block } from "../../core/Block";
import { Transaction } from "../../core/Transaction";
import { ProofOfWork } from "../../core/ProofOfWork";

/**
 * Creates a command to demonstrate the immutability of the blockchain.
 * This demo seeds a temporary blockchain, tampers with a block, and then
 * shows how the chain's integrity validation fails, proving immutability.
 */
export function createDemoImmutabilityCommand(): Command {
  return new Command("demo-immutability")
    .description(
      "Demonstrates blockchain immutability by tampering with a block"
    )
    .action(async () => {
      try {
        console.log(
          chalk.magenta(
            "⛓️  Demonstrating Blockchain Immutability (Tampering Detection) ⛓️"
          )
        );
        console.log(
          chalk.yellow(`\nℹ️  Using an in-memory blockchain for this demo.`)
        );

        // 1. Seed the blockchain
        console.log(chalk.blue("\n🌱 Seeding blockchain with sample data..."));
        const bc = initBlockchain();

        const miner = "miner-address";
        const alice = "alice-address";
        const bob = "bob-address";
        const carol = "carol-address";

        // Mine a few blocks to create a chain
        const b1 = await bc.mineBlock(miner); // Block 1
        if (!b1) throw new Error("Failed to mine block 1 during seeding");
        const tx1 = bc.createTransaction(miner, alice, 20);
        if (tx1) bc.addTransaction(tx1);
        const b2 = await bc.mineBlock(miner); // Block 2
        if (!b2) throw new Error("Failed to mine block 2 during seeding");

        const tx2 = bc.createTransaction(alice, bob, 5);
        if (tx2) bc.addTransaction(tx2);
        const b3 = await bc.mineBlock(miner); // Block 3
        if (!b3) throw new Error("Failed to mine block 3 during seeding");

        const tx3 = bc.createTransaction(bob, carol, 2);
        if (tx3) bc.addTransaction(tx3);
        const b4 = await bc.mineBlock(miner); // Block 4
        if (!b4) throw new Error("Failed to mine block 4 during seeding");

        console.log(chalk.green("✅ Blockchain seeded with 5 blocks."));

        // 2. Show original valid state
        const originalChain = bc.getChain();
        console.log(chalk.blue("\n🔗 Original Blockchain State:"));
        originalChain.forEach((block: Block) => {
          console.log(
            `   Block #${block.index} | Hash: ${block.hash.substring(
              0,
              12
            )}... | Valid: ${chalk.green("✅")}`
          );
        });

        // 3. Tamper with a block
        console.log(
          chalk.yellow("\n⚠️  Step 1: Attacker tampers with a past block...")
        );
        const blockToTamperIndex = 2;

        console.log(
          `   Attempting to tamper with a transaction in Block #${blockToTamperIndex}.`
        );

        // The demonstration will tamper a transaction and validate the chain's response.
        const tampered = bc.tamperBlockData(blockToTamperIndex);

        if (!tampered) {
          console.log(chalk.red("❌ Tampering simulation failed."));
          return;
        }

        // 4. Show the consequences
        console.log(chalk.blue("\n🔍 Step 2: System validates the chain..."));
        const isValidChain = bc.validateChain();

        if (isValidChain) {
          console.log(
            chalk.red(
              "❌ DEMO FAILED: Chain is valid after tampering. Immutability broken."
            )
          );
          return;
        }

        console.log(
          chalk.green(
            "✅ Chain is now INVALID. Immutability has been demonstrated."
          )
        );
        console.log(chalk.blue("\n🔎 Analysis of the broken chain:"));

        const currentChain = bc.getChain();
        for (let i = 1; i < currentChain.length; i++) {
          const blockData = currentChain[i];
          const prevBlockData = currentChain[i - 1];

          const block = new Block(
            blockData.index,
            blockData.transactions.map((tx: any) =>
              tx instanceof Transaction
                ? tx
                : new Transaction(tx.inputs, tx.outputs, tx.timestamp)
            ),
            blockData.previousHash,
            blockData.nonce,
            blockData.difficulty,
            blockData.timestamp
          );
          const prevBlock = new Block(
            prevBlockData.index,
            prevBlockData.transactions.map((tx: any) =>
              tx instanceof Transaction
                ? tx
                : new Transaction(tx.inputs, tx.outputs, tx.timestamp)
            ),
            prevBlockData.previousHash,
            prevBlockData.nonce,
            prevBlockData.difficulty,
            prevBlockData.timestamp
          );

          const newHash = block.calculateHash();
          const isHashValid = newHash === block.hash;
          const isLinkValid = block.previousHash === prevBlock.hash;

          if (i === blockToTamperIndex) {
            console.log(
              chalk.red(`   - Block #${block.index} (TAMPERED): INVALID HASH`)
            );
            console.log(`     Stored Hash:     ${block.hash}`);
            console.log(`     Recalculated Hash: ${newHash}`);
            console.log(
              "     Reason: Data was changed, so the new hash doesn't match the stored one."
            );
          } else if (i > blockToTamperIndex) {
            console.log(chalk.red(`   - Block #${block.index}: INVALID LINK`));
            console.log(`     Previous Hash Pointer: ${block.previousHash}`);
            console.log(
              `     Actual Hash of Block #${prevBlock.index}:   ${prevBlock.hash}`
            );
            console.log(
              "     Reason: The hash of the preceding block changed, breaking the cryptographic link."
            );
          } else {
            console.log(
              chalk.green(`   - Block #${block.index}: Still valid.`)
            );
          }
        }
        console.log(
          chalk.magenta(
            "\n🎉 Conclusion: Any change to a block invalidates the entire chain from that point forward, ensuring immutability."
          )
        );
      } catch (error) {
        handleError("Demo", error);
      }
    });
}

/**
 * Creates a command to demonstrate Double-Spend Prevention.
 * This demo seeds a temporary blockchain, creates a valid transaction,
 * then attempts to create a conflicting transaction spending the same UTXOs,
 * showing how the validator rejects the double-spend.
 */
export function createDemoDoubleSpendPreventionCommand(): Command {
  return new Command("demo-double-spend")
    .description(
      "Demonstrates double-spend prevention using UTXO and mempool checks"
    )
    .action(async () => {
      try {
        console.log(
          chalk.magenta("🔐 Demonstrating Double-Spend Prevention (UTXO Model)")
        );
        console.log(
          chalk.yellow("\nℹ️  Using an in-memory blockchain for this demo.")
        );

        // 1) Seed a small chain so at least one address has spendable UTXOs
        console.log(
          chalk.blue("\n🌱 Seeding blockchain with coinbase rewards...")
        );
        const bc = initBlockchain();

        const miner = "demo-miner";
        const b1 = await bc.mineBlock(miner);
        if (!b1) throw new Error("Failed to mine initial block");
        const b2 = await bc.mineBlock(miner);
        if (!b2) throw new Error("Failed to mine second block");

        console.log(
          chalk.green(
            "✅ Blockchain seeded. Proceeding to create transactions..."
          )
        );

        // 2) Run the built-in demonstration which constructs two conflicting txs
        console.log(
          chalk.red(
            "\n🔍 Creating 2 transactions, one is a valid transaction and the other is a conflicting double-spend..."
          )
        );
        const result = bc.demonstrateDoubleSpendPrevention({ quiet: true });

        // 3) Present results
        if (!result.success) {
          console.log(
            chalk.red("❌ Double-spend prevention demo did not succeed.")
          );
          console.log(`   Reason: ${result.scenario}`);
          return;
        }

        console.log(
          chalk.magenta(
            "\n🎉 Conclusion: Once a UTXO is referenced by a pending transaction, any other transaction attempting to spend the same UTXO is rejected."
          )
        );
      } catch (error) {
        handleError("Demo", error);
      }
    });
}

/**
 * Creates a command to demonstrate dynamic difficulty adjustment.
 * This demo mines enough blocks to trigger the first difficulty adjustment
 * and shows how the system responds to block mining times.
 */
export function createDemoDifficultyAdjustmentCommand(): Command {
  return new Command("demo-difficulty-adjustment")
    .description(
      "Demonstrates deterministic difficulty adjustment by simulating fast and slow block times"
    )
    .action(async () => {
      try {
        console.log(
          chalk.magenta(
            "📊 Demonstrating Deterministic Difficulty Adjustment 📊"
          )
        );
        console.log(
          chalk.yellow("\nℹ️  Using an in-memory blockchain for this demo.")
        );

        // --- Demo Setup ---
        const bc = initBlockchain();
        const pow = new ProofOfWork();
        const config = pow.getConfig();
        const miner = "demo-miner";
        const interval = config.adjustmentInterval;
        const initialDifficulty = bc.getChain()[0].difficulty;

        console.log(chalk.blue("\n⚙️  Initial Configuration:"));
        console.log(`   - Initial Difficulty for Block #1: 2`);
        console.log(
          `   - Target Block Time: ${config.targetBlockTime / 1000}s`
        );
        console.log(`   - Adjustment Interval: Every ${interval} blocks`);

        // --- Scenario 1: Simulate blocks being mined TOO FAST ---
        console.log(
          chalk.cyan(
            `\n\n--- SCENARIO 1: SIMULATING FAST MINING (Difficulty should increase) ---`
          )
        );
        console.log(
          `   Mining ${interval} blocks with an artificially short delay (1 second apart)...`
        );

        let lastTimestamp = bc.getLatestBlock().timestamp;
        for (let i = 1; i <= interval; i++) {
          lastTimestamp += 1000; // 1 second
          const block = await bc.mineBlock(miner, lastTimestamp);
          if (!block) throw new Error(`Scenario 1: Failed to mine block #${i}`);
        }

        // The last block of the interval (Block #10) is mined with the old difficulty.
        const lastFastBlock = bc.getLatestBlock();
        console.log(
          chalk.blue(
            `\n⛏️  Mining one more block (#${
              lastFastBlock.index + 1
            }) to see the adjusted difficulty...`
          )
        );
        const firstAdjustedUpBlock = await bc.mineBlock(miner);
        if (!firstAdjustedUpBlock)
          throw new Error("Failed to mine adjustment block");

        console.log(chalk.blue("\n📈 Analysis of Scenario 1:"));
        console.log(
          `   - Difficulty for blocks #1-${lastFastBlock.index} was: ${lastFastBlock.difficulty}`
        );
        console.log(
          chalk.magenta(
            `   - After fast mining, difficulty for block #${firstAdjustedUpBlock.index} adjusted to: ${firstAdjustedUpBlock.difficulty}`
          )
        );
        if (firstAdjustedUpBlock.difficulty > lastFastBlock.difficulty) {
          console.log(
            chalk.green("✅ SUCCESS: Difficulty correctly increased.")
          );
        } else {
          console.log(
            chalk.red("   ❌ FAILURE: Difficulty did not increase as expected.")
          );
        }

        // --- Scenario 2: Simulate blocks being mined TOO SLOW ---
        console.log(
          chalk.cyan(
            `\n\n--- SCENARIO 2: SIMULATING SLOW MINING (Difficulty should decrease) ---`
          )
        );
        console.log(
          `   Mining another ${interval - 1} blocks with a long delay (20 seconds apart)...`
        );

        lastTimestamp = bc.getLatestBlock().timestamp;
        // We've already mined one block of this interval (firstAdjustedUpBlock), so we need interval - 1 more.
        for (let i = 1; i < interval; i++) {
          lastTimestamp += 20000; // 20 seconds
          const block = await bc.mineBlock(miner, lastTimestamp);
          if (!block) throw new Error(`Scenario 2: Failed to mine block`);
        }

        const lastSlowBlock = bc.getLatestBlock();
        console.log(
          chalk.blue(
            `\n⛏️  Mining one more block (#${
              lastSlowBlock.index + 1
            }) to see the adjusted difficulty...`
          )
        );
        const firstAdjustedDownBlock = await bc.mineBlock(miner);
        if (!firstAdjustedDownBlock)
          throw new Error("Failed to mine 2nd adjustment block");

        console.log(chalk.blue("\n📉 Analysis of Scenario 2:"));
        console.log(
          `   - Difficulty for blocks up to #${lastSlowBlock.index} was: ${lastSlowBlock.difficulty}`
        );
        console.log(
          chalk.magenta(
            `   - After slow mining, difficulty for block #${firstAdjustedDownBlock.index} adjusted to: ${firstAdjustedDownBlock.difficulty}`
          )
        );

        if (firstAdjustedDownBlock.difficulty < lastSlowBlock.difficulty) {
          console.log(
            chalk.green("✅ SUCCESS: Difficulty correctly decreased.")
          );
        } else {
          console.log(
            chalk.red("   ❌ FAILURE: Difficulty did not decrease as expected.")
          );
        }

        console.log(
          chalk.magenta(
            "\n\n🎉 Conclusion: The demo successfully showed the difficulty adjustment mechanism responding to both fast and slow block mining simulations."
          )
        );
      } catch (error) {
        handleError("Difficulty Adjustment Demo", error);
      }
    });
}
