const {
  makeSTXTokenTransfer,
  makeContractCall,
  broadcastTransaction,
  AnchorMode,
  PostConditionMode,
  uintCV,
  stringAsciiCV,
  stringUtf8CV,
  principalCV,
  boolCV,
} = require("@stacks/transactions");
const { STACKS_MAINNET } = require("@stacks/network");

const PRIVATE_KEY = "***REMOVED***";
const ADDRESS = "SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB";
const BURN_ADDRESS = "SP000000000000000000002Q6VF78";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fillMissingNonces() {
  console.log("Filling missing nonces...\n");
  const missingNonces = [710, 711, 714, 715, 716, 717, 718];
  
  for (const nonce of missingNonces) {
    console.log(`Filling nonce ${nonce}...`);
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
      console.log(`  TX: ${result.txid}`);
      await sleep(1000);
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
  }
}

async function runInteractions(startNonce) {
  console.log("\n\nRunning DeFi Sentinel interactions...\n");
  let nonce = startNonce;
  
  const ops = [
    // Price Feed - More token prices
    { contract: "sentinel-price-feed-v1", fn: "update-price", args: [stringAsciiCV("USDA"), uintCV(1000000)] },
    { contract: "sentinel-price-feed-v1", fn: "update-price", args: [stringAsciiCV("WELSH"), uintCV(850)] },
    { contract: "sentinel-price-feed-v1", fn: "update-price", args: [stringAsciiCV("VELAR"), uintCV(45000)] },
    { contract: "sentinel-price-feed-v1", fn: "update-price", args: [stringAsciiCV("NOT"), uintCV(12500)] },
    { contract: "sentinel-price-feed-v1", fn: "update-price", args: [stringAsciiCV("RUNES"), uintCV(320000)] },
    
    // Whale Tracker - More whale transactions
    { contract: "sentinel-whale-tracker-v1", fn: "record-whale-tx", args: [principalCV("SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9"), uintCV(250000000000), stringAsciiCV("STX")] },
    { contract: "sentinel-whale-tracker-v1", fn: "record-whale-tx", args: [principalCV("SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1"), uintCV(100000000), stringAsciiCV("sBTC")] },
    { contract: "sentinel-whale-tracker-v1", fn: "record-whale-tx", args: [principalCV("SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR"), uintCV(5000000000000), stringAsciiCV("ALEX")] },
    
    // Liquidity Monitor - More pools
    { contract: "sentinel-liquidity-monitor-v1", fn: "update-pool", args: [stringAsciiCV("ALEX-USDA"), uintCV(18000000000000), uintCV(9000000000000), uintCV(9000000000000)] },
    { contract: "sentinel-liquidity-monitor-v1", fn: "update-pool", args: [stringAsciiCV("Velar-STX-USDA"), uintCV(12000000000000), uintCV(7000000000000), uintCV(5000000000000)] },
    { contract: "sentinel-liquidity-monitor-v1", fn: "update-pool", args: [stringAsciiCV("STX-WELSH"), uintCV(3500000000000), uintCV(2000000000000), uintCV(1500000000000)] },
    
    // Yield Tracker - More yield farms
    { contract: "sentinel-yield-tracker-v1", fn: "update-yield", args: [stringAsciiCV("Velar-STX-sBTC"), uintCV(1850), uintCV(25000000000000), stringAsciiCV("Velar")] },
    { contract: "sentinel-yield-tracker-v1", fn: "update-yield", args: [stringAsciiCV("ALEX-autoALEX"), uintCV(2200), uintCV(8000000000000), stringAsciiCV("ALEX")] },
    { contract: "sentinel-yield-tracker-v1", fn: "update-yield", args: [stringAsciiCV("StackingDAO-stSTX"), uintCV(550), uintCV(150000000000000), stringAsciiCV("StackingDAO")] },
    
    // Risk Scores - More protocols
    { contract: "sentinel-risk-score-v1", fn: "set-risk-score", args: [principalCV("SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR"), uintCV(20), stringUtf8CV("Very low risk: Battle-tested, audited multiple times")] },
    { contract: "sentinel-risk-score-v1", fn: "set-risk-score", args: [principalCV("SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9"), uintCV(35), stringUtf8CV("Low-medium risk: New protocol, single audit")] },
    { contract: "sentinel-risk-score-v1", fn: "set-risk-score", args: [principalCV("SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1"), uintCV(15), stringUtf8CV("Very low risk: Core Stacks infrastructure")] },
    
    // Alert Hub - More alerts
    { contract: "sentinel-alert-hub-v1", fn: "create-alert", args: [stringAsciiCV("liquidity-drop"), uintCV(2), stringAsciiCV("STX-USDA pool liquidity dropped 15% in 1 hour")] },
    { contract: "sentinel-alert-hub-v1", fn: "create-alert", args: [stringAsciiCV("new-listing"), uintCV(1), stringAsciiCV("New token RUNES listed on ALEX DEX")] },
    { contract: "sentinel-alert-hub-v1", fn: "create-alert", args: [stringAsciiCV("yield-change"), uintCV(1), stringAsciiCV("autoALEX APY increased to 22%")] },
    { contract: "sentinel-alert-hub-v1", fn: "resolve-alert", args: [uintCV(0)] },
    
    // DEX Volume - More DEX data
    { contract: "sentinel-dex-volume-v1", fn: "update-dex-volume", args: [stringAsciiCV("Arkadiko"), uintCV(5500000000000), uintCV(3200), uintCV(16500000000)] },
    { contract: "sentinel-dex-volume-v1", fn: "update-dex-volume", args: [stringAsciiCV("StackSwap"), uintCV(2200000000000), uintCV(1850), uintCV(6600000000)] },
    
    // Staking Monitor - More staking pools
    { contract: "sentinel-staking-monitor-v1", fn: "update-staking-pool", args: [stringAsciiCV("Arkadiko-DIKO"), uintCV(45000000000000), uintCV(800), uintCV(2016)] },
    { contract: "sentinel-staking-monitor-v1", fn: "update-staking-pool", args: [stringAsciiCV("Velar-VELAR"), uintCV(25000000000000), uintCV(1500), uintCV(1008)] },
    
    // Bridge Health - More bridge updates
    { contract: "sentinel-bridge-health-v1", fn: "update-bridge-status", args: [stringAsciiCV("Allbridge"), boolCV(true), uintCV(500000000000), uintCV(5)] },
    { contract: "sentinel-bridge-health-v1", fn: "update-bridge-status", args: [stringAsciiCV("XLink"), boolCV(true), uintCV(800000000000), uintCV(8)] },
    
    // Token Metrics - More tokens
    { contract: "token-metrics-v1", fn: "update-token", args: [stringAsciiCV("WELSH"), uintCV(850), uintCV(85000000000), uintCV(2500000000), uintCV(100000000000000)] },
    { contract: "token-metrics-v1", fn: "update-token", args: [stringAsciiCV("VELAR"), uintCV(45000), uintCV(90000000000000), uintCV(5000000000000), uintCV(2000000000000000)] },
    { contract: "token-metrics-v1", fn: "update-token", args: [stringAsciiCV("sBTC"), uintCV(97500000000), uintCV(500000000000000), uintCV(25000000000000), uintCV(5000000000)] },
    
    // Lending Monitor - More pools
    { contract: "lending-monitor-v1", fn: "update-pool", args: [stringAsciiCV("Zest-STX"), uintCV(80000000000000), uintCV(55000000000000), uintCV(380), uintCV(720)] },
    { contract: "lending-monitor-v1", fn: "update-pool", args: [stringAsciiCV("Arkadiko-STX"), uintCV(120000000000000), uintCV(85000000000000), uintCV(320), uintCV(650)] },
    
    // NFT Floor Tracker - More collections
    { contract: "nft-floor-tracker-v1", fn: "update-floor", args: [stringAsciiCV("Stacks Parrots"), uintCV(150000000), uintCV(800000000), uintCV(8), uintCV(85)] },
    { contract: "nft-floor-tracker-v1", fn: "update-floor", args: [stringAsciiCV("Megapont Apes"), uintCV(2500000000), uintCV(15000000000), uintCV(12), uintCV(45)] },
    { contract: "nft-floor-tracker-v1", fn: "update-floor", args: [stringAsciiCV("Crash Punks"), uintCV(350000000), uintCV(1200000000), uintCV(5), uintCV(200)] },
    
    // Gas Tracker - More gas data
    { contract: "gas-tracker-v1", fn: "record-gas", args: [uintCV(4800), uintCV(1500), uintCV(12000), uintCV(980)] },
    { contract: "gas-tracker-v1", fn: "record-gas", args: [uintCV(6200), uintCV(2500), uintCV(18000), uintCV(1450)] },
    
    // Protocol Registry - More protocols
    { contract: "protocol-registry-v1", fn: "register-protocol", args: [stringAsciiCV("Velar"), stringAsciiCV("DEX"), uintCV(45000000000000), uintCV(18000), boolCV(true)] },
    { contract: "protocol-registry-v1", fn: "register-protocol", args: [stringAsciiCV("StackingDAO"), stringAsciiCV("Staking"), uintCV(200000000000000), uintCV(8500), boolCV(true)] },
    { contract: "protocol-registry-v1", fn: "register-protocol", args: [stringAsciiCV("Zest"), stringAsciiCV("Lending"), uintCV(95000000000000), uintCV(5200), boolCV(true)] },
    
    // DAO Voting - More proposals
    { contract: "dao-voting-v1", fn: "create-proposal", args: [stringAsciiCV("Add new yield farming pool for WELSH-STX"), uintCV(2016)] },
    { contract: "dao-voting-v1", fn: "create-proposal", args: [stringAsciiCV("Reduce platform fees from 0.3% to 0.25%"), uintCV(1008)] },
    { contract: "dao-voting-v1", fn: "vote", args: [uintCV(1), boolCV(true)] },
    
    // Bridge Analytics - More data
    { contract: "bridge-analytics-v1", fn: "record-daily", args: [uintCV(185), uintCV(142), uintCV(7500000000), uintCV(22500000)] },
    { contract: "bridge-analytics-v1", fn: "record-daily", args: [uintCV(210), uintCV(168), uintCV(9200000000), uintCV(27600000)] },
    
    // Swap Router - More routes
    { contract: "swap-router-v1", fn: "add-route", args: [stringAsciiCV("ALEX"), stringAsciiCV("USDA"), stringAsciiCV("ALEX-ALEX-USDA"), uintCV(30)] },
    { contract: "swap-router-v1", fn: "add-route", args: [stringAsciiCV("WELSH"), stringAsciiCV("STX"), stringAsciiCV("ALEX-WELSH-STX"), uintCV(50)] },
    { contract: "swap-router-v1", fn: "add-route", args: [stringAsciiCV("sBTC"), stringAsciiCV("USDA"), stringAsciiCV("Velar-sBTC-USDA"), uintCV(25)] },
    
    // Portfolio updates
    { contract: "defi-portfolio-v1", fn: "add-position", args: [uintCV(1), stringAsciiCV("Velar-STX-sBTC"), uintCV(5000000000), uintCV(8000000000)] },
    { contract: "defi-portfolio-v1", fn: "add-position", args: [uintCV(2), stringAsciiCV("StackingDAO-stSTX"), uintCV(20000000000), uintCV(22000000000)] },
    { contract: "defi-portfolio-v1", fn: "update-portfolio", args: [uintCV(45000000000), uintCV(8)] },
  ];

  for (const op of ops) {
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
        fee: 3500,
        nonce: nonce,
      });
      const result = await broadcastTransaction({ transaction: tx, network: STACKS_MAINNET });
      console.log(`  TX: ${result.txid}`);
      nonce++;
      await sleep(1000);
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
  }
  
  console.log(`\nFinal nonce: ${nonce}`);
  console.log(`Total interactions: ${ops.length}`);
}

async function main() {
  await fillMissingNonces();
  await sleep(2000);
  
  const response = await fetch(`https://api.mainnet.hiro.so/extended/v1/address/${ADDRESS}/nonces`);
  const data = await response.json();
  console.log(`\nCurrent nonce: ${data.possible_next_nonce}`);
  
  await runInteractions(data.possible_next_nonce);
  
  const balRes = await fetch(`https://api.mainnet.hiro.so/extended/v1/address/${ADDRESS}/balances`);
  const balData = await balRes.json();
  console.log(`\nFinal STX balance: ${(parseInt(balData.stx.balance) / 1000000).toFixed(4)} STX`);
}

main().catch(console.error);
