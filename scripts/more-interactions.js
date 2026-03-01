const {
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Confirmed contracts only - more interactions
const interactions = [
  // NFT MARKETPLACE - confirmed
  { contract: "nft-marketplace-listings-v1", fn: "create-listing", args: [principalCV("SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.megapont-ape-club-nft"), uintCV(404), uintCV(420000000)] },
  { contract: "nft-marketplace-listings-v1", fn: "create-listing", args: [principalCV("SP2X0TZ59D5SZ8ACQ6YMCHHNR2ZN51Z32E2CJ173.the-explorer-guild"), uintCV(99), uintCV(180000000)] },
  { contract: "nft-marketplace-listings-v1", fn: "create-listing", args: [principalCV("SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.megapont-ape-club-nft"), uintCV(505), uintCV(550000000)] },
  { contract: "nft-marketplace-royalties-v1", fn: "set-royalty", args: [uintCV(1000), principalCV(ADDRESS)] },
  { contract: "nft-marketplace-stats-v1", fn: "update-stats", args: [principalCV("SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.megapont-ape-club-nft"), uintCV(3500000000), uintCV(28000000000), uintCV(720), uintCV(140)] },
  { contract: "nft-marketplace-stats-v1", fn: "update-stats", args: [principalCV("SP2X0TZ59D5SZ8ACQ6YMCHHNR2ZN51Z32E2CJ173.the-explorer-guild"), uintCV(920000000), uintCV(9500000000), uintCV(350), uintCV(52)] },
  
  // ORACLE AGGREGATOR - confirmed
  { contract: "oracle-aggregator-v1", fn: "update-aggregated", args: [stringAsciiCV("STX/USD"), uintCV(1925000), uintCV(1900000), uintCV(1960000), uintCV(6)] },
  { contract: "oracle-aggregator-v1", fn: "update-aggregated", args: [stringAsciiCV("BTC/USD"), uintCV(97600000000), uintCV(97100000000), uintCV(98100000000), uintCV(5)] },
  { contract: "oracle-aggregator-v1", fn: "update-aggregated", args: [stringAsciiCV("ETH/USD"), uintCV(3480000000), uintCV(3420000000), uintCV(3520000000), uintCV(4)] },
  
  // PREDICTION - confirmed
  { contract: "prediction-bets-v1", fn: "place-bet", args: [uintCV(0), boolCV(false), uintCV(20000000)] },
  { contract: "prediction-bets-v1", fn: "place-bet", args: [uintCV(1), boolCV(true), uintCV(30000000)] },
  { contract: "prediction-bets-v1", fn: "place-bet", args: [uintCV(2), boolCV(true), uintCV(18000000)] },
  { contract: "prediction-leaderboard-v1", fn: "record-win", args: [principalCV(ADDRESS), uintCV(75000000)] },
  { contract: "prediction-leaderboard-v1", fn: "record-win", args: [principalCV("SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9"), uintCV(45000000)] },
  { contract: "prediction-leaderboard-v1", fn: "record-win", args: [principalCV("SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7"), uintCV(28000000)] },
  
  // SOCIAL - confirmed
  { contract: "social-follows-v1", fn: "follow", args: [principalCV("SP1G48FZ4Y7JY8G2Z0N51QTCYGBQ6F4J43J77BQC0")] },
  { contract: "social-follows-v1", fn: "follow", args: [principalCV("SPNWZ5V2TPWGQGVDR6T7B6RQ4XMGZ4PXTEE0VQ0S")] },
  
  // SUBSCRIPTION - confirmed
  { contract: "subscription-plans-v1", fn: "create-plan", args: [stringAsciiCV("Starter Plan"), uintCV(3000000), uintCV(2160)] },
  { contract: "subscription-plans-v1", fn: "create-plan", args: [stringAsciiCV("Team Plan"), uintCV(35000000), uintCV(4320)] },
  { contract: "subscription-revenue-v1", fn: "record-payment", args: [principalCV(ADDRESS), uintCV(45000000)] },
  { contract: "subscription-revenue-v1", fn: "record-payment", args: [principalCV("SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9"), uintCV(20000000)] },
  
  // TOKEN FACTORY - confirmed
  { contract: "token-factory-registry-v1", fn: "register-token", args: [stringAsciiCV("Yield Token"), stringAsciiCV("YIELD"), uintCV(500000000000000), principalCV(ADDRESS)] },
  { contract: "token-factory-registry-v1", fn: "register-token", args: [stringAsciiCV("Governance Token"), stringAsciiCV("GOV"), uintCV(100000000000000), principalCV(ADDRESS)] },
  
  // VOTING - confirmed
  { contract: "voting-delegation-v1", fn: "delegate", args: [principalCV("SP1G48FZ4Y7JY8G2Z0N51QTCYGBQ6F4J43J77BQC0"), uintCV(3500000)] },
  
  // More NFT listings
  { contract: "nft-marketplace-listings-v1", fn: "create-listing", args: [principalCV("SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.megapont-ape-club-nft"), uintCV(606), uintCV(380000000)] },
  { contract: "nft-marketplace-listings-v1", fn: "create-listing", args: [principalCV("SP2X0TZ59D5SZ8ACQ6YMCHHNR2ZN51Z32E2CJ173.the-explorer-guild"), uintCV(111), uintCV(95000000)] },
  
  // More oracle updates
  { contract: "oracle-aggregator-v1", fn: "update-aggregated", args: [stringAsciiCV("ALEX/USD"), uintCV(125000), uintCV(120000), uintCV(130000), uintCV(3)] },
  { contract: "oracle-aggregator-v1", fn: "update-aggregated", args: [stringAsciiCV("USDA/USD"), uintCV(1000000), uintCV(998000), uintCV(1002000), uintCV(4)] },
  
  // More predictions
  { contract: "prediction-bets-v1", fn: "place-bet", args: [uintCV(0), boolCV(true), uintCV(35000000)] },
  { contract: "prediction-leaderboard-v1", fn: "record-win", args: [principalCV(ADDRESS), uintCV(100000000)] },
];

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║  MORE INTERACTIONS ON CONFIRMED CONTRACTS                  ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  const nonceRes = await fetch(`https://api.mainnet.hiro.so/extended/v1/address/${ADDRESS}/nonces`);
  const nonceData = await nonceRes.json();
  let nonce = nonceData.possible_next_nonce;

  const balRes = await fetch(`https://api.mainnet.hiro.so/extended/v1/address/${ADDRESS}/balances`);
  const balData = await balRes.json();
  const initialBalance = parseInt(balData.stx.balance) / 1000000;

  console.log(`Starting nonce: ${nonce}`);
  console.log(`Initial balance: ${initialBalance.toFixed(4)} STX`);
  console.log(`Total interactions: ${interactions.length}\n`);

  let success = 0;
  let failed = 0;

  for (let i = 0; i < interactions.length; i++) {
    const op = interactions[i];
    console.log(`[${i + 1}/${interactions.length}] ${op.contract}.${op.fn}...`);
    
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
        if (result.reason === "TooMuchChaining") {
          console.log("  Waiting...");
          await sleep(10000);
        }
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

  await sleep(2000);
  const finalBalRes = await fetch(`https://api.mainnet.hiro.so/extended/v1/address/${ADDRESS}/balances`);
  const finalBalData = await finalBalRes.json();
  const finalBalance = parseInt(finalBalData.stx.balance) / 1000000;

  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║                      SUMMARY                               ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");
  console.log(`Successful: ${success}/${interactions.length}`);
  console.log(`Failed: ${failed}/${interactions.length}`);
  console.log(`\nInitial balance: ${initialBalance.toFixed(4)} STX`);
  console.log(`Final balance: ${finalBalance.toFixed(4)} STX`);
  console.log(`Total spent: ${(initialBalance - finalBalance).toFixed(4)} STX`);
}

main().catch(console.error);
