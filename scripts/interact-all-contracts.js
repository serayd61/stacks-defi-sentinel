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

// Budget: 0.18 STX remaining
// Each interaction: ~0.0025 STX
// Target: ~60 interactions = ~0.15 STX

const interactions = [
  // NFT MARKETPLACE (10)
  { contract: "nft-marketplace-listings-v1", fn: "create-listing", args: [principalCV("SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.megapont-ape-club-nft"), uintCV(101), uintCV(350000000)] },
  { contract: "nft-marketplace-listings-v1", fn: "create-listing", args: [principalCV("SP2X0TZ59D5SZ8ACQ6YMCHHNR2ZN51Z32E2CJ173.the-explorer-guild"), uintCV(55), uintCV(125000000)] },
  { contract: "nft-marketplace-offers-v1", fn: "make-offer", args: [uintCV(0), uintCV(280000000), uintCV(288)] },
  { contract: "nft-marketplace-offers-v1", fn: "make-offer", args: [uintCV(1), uintCV(100000000), uintCV(144)] },
  { contract: "nft-marketplace-royalties-v1", fn: "set-royalty", args: [uintCV(750), principalCV(ADDRESS)] },
  { contract: "nft-marketplace-auctions-v1", fn: "create-auction", args: [principalCV("SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.megapont-ape-club-nft"), uintCV(202), uintCV(200000000), uintCV(2016)] },
  { contract: "nft-marketplace-auctions-v1", fn: "create-auction", args: [principalCV("SP2X0TZ59D5SZ8ACQ6YMCHHNR2ZN51Z32E2CJ173.the-explorer-guild"), uintCV(88), uintCV(75000000), uintCV(1008)] },
  { contract: "nft-marketplace-stats-v1", fn: "update-stats", args: [principalCV("SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.megapont-ape-club-nft"), uintCV(3200000000), uintCV(25000000000), uintCV(680), uintCV(125)] },
  { contract: "nft-marketplace-stats-v1", fn: "update-stats", args: [principalCV("SP2X0TZ59D5SZ8ACQ6YMCHHNR2ZN51Z32E2CJ173.the-explorer-guild"), uintCV(850000000), uintCV(8500000000), uintCV(320), uintCV(45)] },
  { contract: "nft-marketplace-listings-v1", fn: "create-listing", args: [principalCV("SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.megapont-ape-club-nft"), uintCV(303), uintCV(500000000)] },

  // ORACLE (8)
  { contract: "oracle-price-feed-v1", fn: "set-price", args: [stringAsciiCV("STX/USD"), uintCV(1920000), uintCV(6)] },
  { contract: "oracle-price-feed-v1", fn: "set-price", args: [stringAsciiCV("BTC/USD"), uintCV(97850000000), uintCV(6)] },
  { contract: "oracle-price-feed-v1", fn: "set-price", args: [stringAsciiCV("ETH/USD"), uintCV(3450000000), uintCV(6)] },
  { contract: "oracle-data-feed-v1", fn: "report", args: [stringAsciiCV("stacks-block-time"), uintCV(585)] },
  { contract: "oracle-data-feed-v1", fn: "report", args: [stringAsciiCV("stacks-tx-count-24h"), uintCV(45230)] },
  { contract: "oracle-data-feed-v1", fn: "report", args: [stringAsciiCV("stacks-tvl-usd"), uintCV(185000000)] },
  { contract: "oracle-aggregator-v1", fn: "update-aggregated", args: [stringAsciiCV("STX/USD"), uintCV(1915000), uintCV(1890000), uintCV(1950000), uintCV(5)] },
  { contract: "oracle-aggregator-v1", fn: "update-aggregated", args: [stringAsciiCV("BTC/USD"), uintCV(97500000000), uintCV(96800000000), uintCV(98200000000), uintCV(4)] },

  // PREDICTION HUB (10)
  { contract: "prediction-markets-v1", fn: "create-market", args: [stringAsciiCV("Will sBTC TVL exceed 1000 BTC by Q2 2026?"), uintCV(21600)] },
  { contract: "prediction-markets-v1", fn: "create-market", args: [stringAsciiCV("Will Stacks reach top 20 by market cap in 2026?"), uintCV(43200)] },
  { contract: "prediction-markets-v1", fn: "create-market", args: [stringAsciiCV("Will Bitcoin ETF AUM exceed $100B by end of 2026?"), uintCV(30240)] },
  { contract: "prediction-bets-v1", fn: "place-bet", args: [uintCV(0), boolCV(true), uintCV(25000000)] },
  { contract: "prediction-bets-v1", fn: "place-bet", args: [uintCV(1), boolCV(true), uintCV(15000000)] },
  { contract: "prediction-bets-v1", fn: "place-bet", args: [uintCV(2), boolCV(false), uintCV(10000000)] },
  { contract: "prediction-resolver-v1", fn: "add-resolver", args: [principalCV("SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9")] },
  { contract: "prediction-leaderboard-v1", fn: "record-win", args: [principalCV(ADDRESS), uintCV(50000000)] },
  { contract: "prediction-leaderboard-v1", fn: "record-win", args: [principalCV("SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9"), uintCV(35000000)] },
  { contract: "prediction-markets-v1", fn: "create-market", args: [stringAsciiCV("Will ALEX DEX daily volume exceed $50M in March 2026?"), uintCV(8640)] },

  // SBTC TOOLS (8)
  { contract: "sbtc-vault-v1", fn: "create-vault", args: [uintCV(250000000)] },
  { contract: "sbtc-vault-v1", fn: "create-vault", args: [uintCV(150000000)] },
  { contract: "sbtc-yield-v1", fn: "stake", args: [uintCV(100000000)] },
  { contract: "sbtc-yield-v1", fn: "stake", args: [uintCV(75000000)] },
  { contract: "sbtc-liquidation-v1", fn: "record-liquidation", args: [principalCV("SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9"), uintCV(85000000)] },
  { contract: "sbtc-liquidation-v1", fn: "record-liquidation", args: [principalCV("SP1G48FZ4Y7JY8G2Z0N51QTCYGBQ6F4J43J77BQC0"), uintCV(120000000)] },
  { contract: "sbtc-price-oracle-v1", fn: "update-btc-price", args: [uintCV(97650000000)] },
  { contract: "sbtc-price-oracle-v1", fn: "update-btc-price", args: [uintCV(97800000000)] },

  // SOCIAL PROTOCOL (8)
  { contract: "social-profiles-v1", fn: "create-profile", args: [stringAsciiCV("stacks_builder"), stringAsciiCV("Building the future of Bitcoin DeFi")] },
  { contract: "social-profiles-v1", fn: "create-profile", args: [stringAsciiCV("btc_maxi"), stringAsciiCV("Bitcoin is the future of money")] },
  { contract: "social-follows-v1", fn: "follow", args: [principalCV("SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9")] },
  { contract: "social-follows-v1", fn: "follow", args: [principalCV("SP1G48FZ4Y7JY8G2Z0N51QTCYGBQ6F4J43J77BQC0")] },
  { contract: "social-posts-v1", fn: "create-post", args: [stringAsciiCV("Just deployed 30 new contracts on Stacks mainnet!")] },
  { contract: "social-posts-v1", fn: "create-post", args: [stringAsciiCV("sBTC is going to change everything for Bitcoin DeFi")] },
  { contract: "social-posts-v1", fn: "create-post", args: [stringAsciiCV("Building prediction markets on Stacks - exciting times!")] },
  { contract: "social-follows-v1", fn: "follow", args: [principalCV("SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7")] },

  // SUBSCRIPTION (6)
  { contract: "subscription-plans-v1", fn: "create-plan", args: [stringAsciiCV("Basic Plan"), uintCV(5000000), uintCV(4320)] },
  { contract: "subscription-plans-v1", fn: "create-plan", args: [stringAsciiCV("Premium Plan"), uintCV(15000000), uintCV(4320)] },
  { contract: "subscription-plans-v1", fn: "create-plan", args: [stringAsciiCV("Enterprise Plan"), uintCV(50000000), uintCV(4320)] },
  { contract: "subscription-members-v1", fn: "subscribe", args: [uintCV(0), uintCV(4320)] },
  { contract: "subscription-members-v1", fn: "subscribe", args: [uintCV(1), uintCV(8640)] },
  { contract: "subscription-revenue-v1", fn: "record-payment", args: [principalCV(ADDRESS), uintCV(25000000)] },

  // TIMELOCK (4)
  { contract: "timelock-vesting-v1", fn: "create-schedule", args: [principalCV(ADDRESS), uintCV(500000000), uintCV(2016), uintCV(21600)] },
  { contract: "timelock-vesting-v1", fn: "create-schedule", args: [principalCV("SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9"), uintCV(250000000), uintCV(1008), uintCV(10800)] },
  { contract: "timelock-governance-v1", fn: "propose-action", args: [stringAsciiCV("Increase staking rewards to 8%"), uintCV(2016)] },
  { contract: "timelock-governance-v1", fn: "propose-action", args: [stringAsciiCV("Add new yield strategy"), uintCV(1008)] },

  // TOKEN FACTORY (6)
  { contract: "token-factory-registry-v1", fn: "register-token", args: [stringAsciiCV("Sentinel Token"), stringAsciiCV("SNTL"), uintCV(1000000000000000), principalCV(ADDRESS)] },
  { contract: "token-factory-registry-v1", fn: "register-token", args: [stringAsciiCV("Prediction Token"), stringAsciiCV("PRED"), uintCV(500000000000000), principalCV(ADDRESS)] },
  { contract: "token-factory-launchpad-v1", fn: "create-launch", args: [uintCV(0), uintCV(50000), uintCV(50000000000), uintCV(4320)] },
  { contract: "token-factory-launchpad-v1", fn: "create-launch", args: [uintCV(1), uintCV(100000), uintCV(25000000000), uintCV(2016)] },
  { contract: "token-factory-vesting-v1", fn: "create-vesting", args: [uintCV(0), principalCV(ADDRESS), uintCV(100000000000), uintCV(21600)] },
  { contract: "token-factory-vesting-v1", fn: "create-vesting", args: [uintCV(1), principalCV("SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9"), uintCV(50000000000), uintCV(10800)] },

  // VOTING (6)
  { contract: "voting-proposals-v1", fn: "create-proposal", args: [stringAsciiCV("Increase protocol fee to 0.5%"), uintCV(4320)] },
  { contract: "voting-proposals-v1", fn: "create-proposal", args: [stringAsciiCV("Add new collateral type"), uintCV(2016)] },
  { contract: "voting-ballots-v1", fn: "cast-vote", args: [uintCV(0), boolCV(true), uintCV(5000000)] },
  { contract: "voting-ballots-v1", fn: "cast-vote", args: [uintCV(1), boolCV(false), uintCV(3000000)] },
  { contract: "voting-delegation-v1", fn: "delegate", args: [principalCV("SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9"), uintCV(2500000)] },
  { contract: "voting-delegation-v1", fn: "delegate", args: [principalCV("SP1G48FZ4Y7JY8G2Z0N51QTCYGBQ6F4J43J77BQC0"), uintCV(1500000)] },
];

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║  INTERACTING WITH DEPLOYED CONTRACTS                       ║");
  console.log("║  Budget: ~0.18 STX                                         ║");
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
          console.log("  Waiting for chain to clear...");
          await sleep(8000);
        }
      } else {
        console.log(`  ✅ ${result.txid.slice(0, 16)}...`);
        success++;
      }
      nonce++;
      await sleep(500);
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
  console.log(`Successful: ${success}/${interactions.length}`);
  console.log(`Failed: ${failed}/${interactions.length}`);
  console.log(`\nInitial balance: ${initialBalance.toFixed(4)} STX`);
  console.log(`Final balance: ${finalBalance.toFixed(4)} STX`);
  console.log(`Total spent: ${(initialBalance - finalBalance).toFixed(4)} STX`);
}

main().catch(console.error);
