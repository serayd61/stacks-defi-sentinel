const {
  makeSTXTokenTransfer,
  makeContractCall,
  broadcastTransaction,
  AnchorMode,
  PostConditionMode,
  uintCV,
  stringAsciiCV,
  principalCV,
} = require("@stacks/transactions");
const { STACKS_MAINNET } = require("@stacks/network");

const PRIVATE_KEY = "***REMOVED***";
const ADDRESS = "SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB";
const BURN_ADDRESS = "SP000000000000000000002Q6VF78";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fillMissingNonces(missing) {
  console.log("Filling missing nonces:", missing);
  
  for (const nonce of missing) {
    console.log(`  Filling nonce ${nonce}...`);
    try {
      const tx = await makeSTXTokenTransfer({
        recipient: BURN_ADDRESS,
        amount: 1n,
        senderKey: PRIVATE_KEY,
        network: STACKS_MAINNET,
        anchorMode: AnchorMode.Any,
        fee: 2000,
        nonce: nonce,
      });
      const result = await broadcastTransaction({ transaction: tx, network: STACKS_MAINNET });
      console.log(`    TX: ${result.txid || result.error}`);
      await sleep(800);
    } catch (e) {
      console.log(`    Error: ${e.message}`);
    }
  }
}

async function runInteractions(startNonce) {
  let nonce = startNonce;
  let success = 0;
  
  const interactions = [
    // STX-ESCROW
    { contract: "stx-escrow-escrow-milestone-v1", fn: "create-milestone", args: [uintCV(2), uintCV(200000000)] },
    { contract: "stx-escrow-escrow-dispute-v1", fn: "open-dispute", args: [uintCV(2), stringAsciiCV("Quality issue")] },
    { contract: "stx-escrow-escrow-fee-v1", fn: "set-fee", args: [uintCV(350)] },
    { contract: "stx-escrow-escrow-timelock-v1", fn: "create-timelock", args: [uintCV(2), uintCV(288), uintCV(75000000)] },
    { contract: "stx-escrow-escrow-template-v1", fn: "create-template", args: [stringAsciiCV("Premium Escrow"), uintCV(200), uintCV(4032)] },
    { contract: "stx-escrow-escrow-refund-v1", fn: "request-refund", args: [uintCV(2), uintCV(50000000), stringAsciiCV("Wrong item")] },
    { contract: "stx-escrow-escrow-batch-v1", fn: "create-batch", args: [uintCV(1000000000)] },
    { contract: "stx-escrow-escrow-analytics-v1", fn: "record-escrow", args: [uintCV(250000000)] },
    { contract: "stx-escrow-escrow-analytics-v1", fn: "record-dispute", args: [] },
    
    // STACKS-UTILS
    { contract: "stacks-utils-utils-address-v1", fn: "set-label", args: [stringAsciiCV("Stacks Builder")] },
    { contract: "stacks-utils-utils-address-v1", fn: "add-tag", args: [stringAsciiCV("builder")] },
    { contract: "stacks-utils-utils-memo-v1", fn: "send-memo", args: [principalCV("SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9"), stringAsciiCV("Testing Stacks Utils!")] },
    { contract: "stacks-utils-utils-registry-v1", fn: "register", args: [stringAsciiCV("stx-escrow"), stringAsciiCV("https://stx-escrow.vercel.app")] },
    { contract: "stacks-utils-utils-timestamp-v1", fn: "stamp", args: [stringAsciiCV("contracts-deployed")] },
    { contract: "stacks-utils-utils-counter-v1", fn: "increment", args: [stringAsciiCV("total-deploys")] },
    { contract: "stacks-utils-utils-whitelist-v1", fn: "create-list", args: [stringAsciiCV("verified-users")] },
    { contract: "stacks-utils-utils-config-v1", fn: "set-config", args: [stringAsciiCV("fee-rate"), uintCV(250)] },
    { contract: "stacks-utils-utils-batch-v1", fn: "create-job", args: [uintCV(100)] },
    { contract: "stacks-utils-utils-events-v1", fn: "emit", args: [stringAsciiCV("system-ready"), stringAsciiCV("All contracts operational")] },
    
    // STACKS-ANALYTICS
    { contract: "stacks-analytics-analytics-tvl-v1", fn: "update-tvl", args: [stringAsciiCV("ALEX"), uintCV(90000000000000)] },
    { contract: "stacks-analytics-analytics-tvl-v1", fn: "update-tvl", args: [stringAsciiCV("Velar"), uintCV(50000000000000)] },
    { contract: "stacks-analytics-analytics-tvl-v1", fn: "update-tvl", args: [stringAsciiCV("Arkadiko"), uintCV(35000000000000)] },
    { contract: "stacks-analytics-analytics-volume-v1", fn: "record-volume", args: [uintCV(1), uintCV(15000000000)] },
    { contract: "stacks-analytics-analytics-volume-v1", fn: "record-token-volume", args: [stringAsciiCV("ALEX"), uintCV(5000000000)] },
    { contract: "stacks-analytics-analytics-users-v1", fn: "record-activity", args: [principalCV(ADDRESS)] },
    { contract: "stacks-analytics-analytics-fees-v1", fn: "record-fee", args: [uintCV(1), uintCV(4500)] },
    { contract: "stacks-analytics-analytics-pools-v1", fn: "update-pool", args: [stringAsciiCV("STX-sBTC"), uintCV(50000000000000), uintCV(8000000000), uintCV(24000000)] },
    { contract: "stacks-analytics-analytics-tokens-v1", fn: "update-token", args: [stringAsciiCV("ALEX"), uintCV(125000), uintCV(500000000000000), uintCV(85000)] },
    { contract: "stacks-analytics-analytics-dex-v1", fn: "update-dex", args: [stringAsciiCV("Velar"), uintCV(50000000000000), uintCV(8000000000), uintCV(6500), uintCV(35)] },
    { contract: "stacks-analytics-analytics-stacking-v1", fn: "record-cycle", args: [uintCV(96), uintCV(480000000000000), uintCV(2800), uintCV(15000000000)] },
    { contract: "stacks-analytics-analytics-nft-v1", fn: "update-collection", args: [stringAsciiCV("Crash Punks"), uintCV(350000000), uintCV(5000000000), uintCV(280), uintCV(850)] },
    { contract: "stacks-analytics-analytics-bridge-v1", fn: "record-inflow", args: [stringAsciiCV("sBTC-Bridge"), uintCV(750000000)] },
    { contract: "stacks-analytics-analytics-bridge-v1", fn: "record-outflow", args: [stringAsciiCV("sBTC-Bridge"), uintCV(250000000)] },
  ];
  
  console.log(`\nRunning ${interactions.length} interactions starting at nonce ${nonce}...\n`);
  
  for (const op of interactions) {
    console.log(`Calling ${op.contract}.${op.fn}...`);
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
        fee: 3000,
        nonce: nonce,
      });
      const result = await broadcastTransaction({ transaction: tx, network: STACKS_MAINNET });
      if (result.error) {
        console.log(`  Error: ${result.reason || result.error}`);
      } else {
        console.log(`  TX: ${result.txid}`);
        success++;
      }
      nonce++;
      await sleep(800);
    } catch (e) {
      console.log(`  Error: ${e.message}`);
      nonce++;
    }
  }
  
  return success;
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  FILLING NONCES AND RUNNING INTERACTIONS");
  console.log("═══════════════════════════════════════════════════════════\n");
  
  // Get current nonce status
  const nonceRes = await fetch(`https://api.mainnet.hiro.so/extended/v1/address/${ADDRESS}/nonces`);
  const nonceData = await nonceRes.json();
  
  console.log(`Current state:`);
  console.log(`  Last executed: ${nonceData.last_executed_tx_nonce}`);
  console.log(`  Possible next: ${nonceData.possible_next_nonce}`);
  console.log(`  Missing: ${nonceData.detected_missing_nonces?.join(', ') || 'none'}`);
  
  // Fill missing nonces if any
  if (nonceData.detected_missing_nonces?.length > 0) {
    await fillMissingNonces(nonceData.detected_missing_nonces);
    await sleep(3000);
  }
  
  // Get updated nonce
  const updatedRes = await fetch(`https://api.mainnet.hiro.so/extended/v1/address/${ADDRESS}/nonces`);
  const updatedData = await updatedRes.json();
  
  // Run interactions
  const success = await runInteractions(updatedData.possible_next_nonce);
  
  // Final stats
  const balRes = await fetch(`https://api.mainnet.hiro.so/extended/v1/address/${ADDRESS}/balances`);
  const balData = await balRes.json();
  
  console.log(`\n═══════════════════════════════════════════════════════════`);
  console.log(`  COMPLETE: ${success}/34 interactions successful`);
  console.log(`  Balance: ${(parseInt(balData.stx.balance) / 1000000).toFixed(4)} STX`);
  console.log(`═══════════════════════════════════════════════════════════`);
}

main().catch(console.error);
