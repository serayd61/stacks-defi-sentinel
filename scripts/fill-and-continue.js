const {
  makeSTXTokenTransfer,
  makeContractCall,
  broadcastTransaction,
  AnchorMode,
  PostConditionMode,
  uintCV,
  stringAsciiCV,
  principalCV,
  boolCV,
} = require("@stacks/transactions");
const { STACKS_MAINNET } = require("@stacks/network");

const PRIVATE_KEY = "***REMOVED***";
const ADDRESS = "SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB";
const BURN_ADDRESS = "SP000000000000000000002Q6VF78";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const remainingInteractions = [
  // SBTC TOOLS
  { contract: "sbtc-vault-v1", fn: "create-vault", args: [uintCV(180000000)] },
  { contract: "sbtc-yield-v1", fn: "stake", args: [uintCV(80000000)] },
  { contract: "sbtc-price-oracle-v1", fn: "update-btc-price", args: [uintCV(97900000000)] },
  
  // SOCIAL PROTOCOL
  { contract: "social-profiles-v1", fn: "create-profile", args: [stringAsciiCV("crypto_dev"), stringAsciiCV("Full stack blockchain developer")] },
  { contract: "social-posts-v1", fn: "create-post", args: [stringAsciiCV("Building amazing DeFi tools on Stacks!")] },
  { contract: "social-follows-v1", fn: "follow", args: [principalCV("SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7")] },
  
  // SUBSCRIPTION
  { contract: "subscription-plans-v1", fn: "create-plan", args: [stringAsciiCV("Pro Plan"), uintCV(20000000), uintCV(8640)] },
  { contract: "subscription-members-v1", fn: "subscribe", args: [uintCV(0), uintCV(4320)] },
  { contract: "subscription-revenue-v1", fn: "record-payment", args: [principalCV(ADDRESS), uintCV(30000000)] },
  
  // TIMELOCK
  { contract: "timelock-vesting-v1", fn: "create-schedule", args: [principalCV(ADDRESS), uintCV(300000000), uintCV(1440), uintCV(14400)] },
  { contract: "timelock-governance-v1", fn: "propose-action", args: [stringAsciiCV("Enable new feature flag"), uintCV(720)] },
  
  // TOKEN FACTORY
  { contract: "token-factory-registry-v1", fn: "register-token", args: [stringAsciiCV("DeFi Token"), stringAsciiCV("DEFI"), uintCV(750000000000000), principalCV(ADDRESS)] },
  { contract: "token-factory-launchpad-v1", fn: "create-launch", args: [uintCV(0), uintCV(75000), uintCV(30000000000), uintCV(3024)] },
  { contract: "token-factory-vesting-v1", fn: "create-vesting", args: [uintCV(0), principalCV(ADDRESS), uintCV(80000000000), uintCV(14400)] },
  
  // VOTING
  { contract: "voting-proposals-v1", fn: "create-proposal", args: [stringAsciiCV("Reduce minimum stake requirement"), uintCV(2880)] },
  { contract: "voting-ballots-v1", fn: "cast-vote", args: [uintCV(0), boolCV(true), uintCV(4000000)] },
  { contract: "voting-delegation-v1", fn: "delegate", args: [principalCV("SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7"), uintCV(2000000)] },
];

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║  FILL NONCES & CONTINUE INTERACTIONS                       ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  // Get nonce status
  const nonceRes = await fetch(`https://api.mainnet.hiro.so/extended/v1/address/${ADDRESS}/nonces`);
  const nonceData = await nonceRes.json();
  
  console.log("Current nonce status:");
  console.log(`  Last executed: ${nonceData.last_executed_tx_nonce}`);
  console.log(`  Last mempool: ${nonceData.last_mempool_tx_nonce}`);
  console.log(`  Missing nonces: ${nonceData.detected_missing_nonces.length}`);
  console.log(`  Mempool nonces: ${nonceData.detected_mempool_nonces.length}\n`);

  const missingNonces = nonceData.detected_missing_nonces.sort((a, b) => a - b);
  
  if (missingNonces.length > 0) {
    console.log("═══════════════════════════════════════════════════════════");
    console.log("  FILLING MISSING NONCES");
    console.log("═══════════════════════════════════════════════════════════\n");
    
    for (const nonce of missingNonces) {
      console.log(`Filling nonce ${nonce}...`);
      try {
        const tx = await makeSTXTokenTransfer({
          recipient: BURN_ADDRESS,
          amount: 1,
          senderKey: PRIVATE_KEY,
          network: STACKS_MAINNET,
          anchorMode: AnchorMode.Any,
          fee: 2000,
          nonce: nonce,
        });
        const result = await broadcastTransaction({ transaction: tx, network: STACKS_MAINNET });
        if (result.error) {
          console.log(`  ❌ ${result.reason || result.error}`);
        } else {
          console.log(`  ✅ ${result.txid.slice(0, 16)}...`);
        }
        await sleep(300);
      } catch (e) {
        console.log(`  ❌ ${e.message}`);
      }
    }
    
    console.log("\nWaiting for propagation...");
    await sleep(5000);
  }

  // Get updated nonce
  const newNonceRes = await fetch(`https://api.mainnet.hiro.so/extended/v1/address/${ADDRESS}/nonces`);
  const newNonceData = await newNonceRes.json();
  let nonce = newNonceData.possible_next_nonce;

  const balRes = await fetch(`https://api.mainnet.hiro.so/extended/v1/address/${ADDRESS}/balances`);
  const balData = await balRes.json();
  const initialBalance = parseInt(balData.stx.balance) / 1000000;

  console.log(`\nStarting nonce: ${nonce}`);
  console.log(`Current balance: ${initialBalance.toFixed(4)} STX\n`);

  // Run remaining interactions
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  RUNNING REMAINING INTERACTIONS");
  console.log("═══════════════════════════════════════════════════════════\n");

  let success = 0;
  let failed = 0;

  for (let i = 0; i < remainingInteractions.length; i++) {
    const op = remainingInteractions[i];
    console.log(`[${i + 1}/${remainingInteractions.length}] ${op.contract}.${op.fn}...`);
    
    try {
      const tx = await makeContractCall({
        contractAddress: ADDRESS,
        contractName: op.contract,
        functionName: op.fn,
        functionArgs: op.args,
        senderKey: PRIVATE_KEY,
        network: STACKS_MAINNET,
        anchorMode: AnchorMode.Any,
        postConditionMode: PostConditionMode.Allow,
        fee: 2500,
        nonce: nonce,
      });
      
      const result = await broadcastTransaction({ transaction: tx, network: STACKS_MAINNET });
      
      if (result.error) {
        console.log(`  ❌ ${result.reason || result.error}`);
        failed++;
      } else {
        console.log(`  ✅ ${result.txid.slice(0, 16)}...`);
        success++;
      }
      nonce++;
      await sleep(600);
    } catch (e) {
      console.log(`  ❌ ${e.message}`);
      failed++;
      nonce++;
    }
  }

  // Final stats
  await sleep(2000);
  const finalBalRes = await fetch(`https://api.mainnet.hiro.so/extended/v1/address/${ADDRESS}/balances`);
  const finalBalData = await finalBalRes.json();
  const finalBalance = parseInt(finalBalData.stx.balance) / 1000000;

  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║                      SUMMARY                               ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");
  console.log(`Successful: ${success}/${remainingInteractions.length}`);
  console.log(`Failed: ${failed}/${remainingInteractions.length}`);
  console.log(`\nInitial balance: ${initialBalance.toFixed(4)} STX`);
  console.log(`Final balance: ${finalBalance.toFixed(4)} STX`);
  console.log(`Total spent: ${(initialBalance - finalBalance).toFixed(4)} STX`);
}

main().catch(console.error);
