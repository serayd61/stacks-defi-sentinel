const {
  makeContractDeploy,
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
const fs = require("fs");

const PRIVATE_KEY = "***REMOVED***";
const ADDRESS = "SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// DeFi Sentinel specific contracts - simplified versions to fit budget
const sentinelContracts = [
  {
    name: "sentinel-price-feed-v1",
    code: `(define-map price-feeds (string-ascii 10) {price: uint, updated-at: uint, source: principal})
(define-data-var feed-count uint u0)
(define-read-only (get-price (token (string-ascii 10))) (map-get? price-feeds token))
(define-public (update-price (token (string-ascii 10)) (price uint))
  (begin
    (map-set price-feeds token {price: price, updated-at: block-height, source: tx-sender})
    (var-set feed-count (+ (var-get feed-count) u1))
    (ok {token: token, price: price})))`
  },
  {
    name: "sentinel-whale-tracker-v1",
    code: `(define-map whale-txs uint {wallet: principal, amount: uint, token: (string-ascii 10), block: uint})
(define-data-var tx-count uint u0)
(define-data-var whale-threshold uint u100000000000)
(define-read-only (get-whale-tx (id uint)) (map-get? whale-txs id))
(define-read-only (get-threshold) (var-get whale-threshold))
(define-public (record-whale-tx (wallet principal) (amount uint) (token (string-ascii 10)))
  (let ((id (var-get tx-count)))
    (map-set whale-txs id {wallet: wallet, amount: amount, token: token, block: block-height})
    (var-set tx-count (+ id u1))
    (ok id)))
(define-public (set-threshold (threshold uint))
  (begin (var-set whale-threshold threshold) (ok true)))`
  },
  {
    name: "sentinel-liquidity-monitor-v1",
    code: `(define-map pool-liquidity (string-ascii 30) {tvl: uint, token0-reserve: uint, token1-reserve: uint, updated: uint})
(define-data-var total-tvl uint u0)
(define-read-only (get-pool (pool-id (string-ascii 30))) (map-get? pool-liquidity pool-id))
(define-read-only (get-total-tvl) (var-get total-tvl))
(define-public (update-pool (pool-id (string-ascii 30)) (tvl uint) (reserve0 uint) (reserve1 uint))
  (begin
    (map-set pool-liquidity pool-id {tvl: tvl, token0-reserve: reserve0, token1-reserve: reserve1, updated: block-height})
    (var-set total-tvl (+ (var-get total-tvl) tvl))
    (ok {pool: pool-id, tvl: tvl})))`
  },
  {
    name: "sentinel-yield-tracker-v1",
    code: `(define-map yield-rates (string-ascii 30) {apy: uint, tvl: uint, protocol: (string-ascii 20), updated: uint})
(define-data-var best-yield-pool (string-ascii 30) "")
(define-data-var best-yield-apy uint u0)
(define-read-only (get-yield (pool (string-ascii 30))) (map-get? yield-rates pool))
(define-read-only (get-best-yield) {pool: (var-get best-yield-pool), apy: (var-get best-yield-apy)})
(define-public (update-yield (pool (string-ascii 30)) (apy uint) (tvl uint) (protocol (string-ascii 20)))
  (begin
    (map-set yield-rates pool {apy: apy, tvl: tvl, protocol: protocol, updated: block-height})
    (if (> apy (var-get best-yield-apy))
      (begin (var-set best-yield-pool pool) (var-set best-yield-apy apy))
      true)
    (ok {pool: pool, apy: apy})))`
  },
  {
    name: "sentinel-risk-score-v1",
    code: `(define-map protocol-risk-scores principal {score: uint, factors: (string-utf8 200), assessed-at: uint})
(define-data-var assessor principal tx-sender)
(define-read-only (get-risk-score (protocol principal)) (map-get? protocol-risk-scores protocol))
(define-public (set-risk-score (protocol principal) (score uint) (factors (string-utf8 200)))
  (begin
    (asserts! (<= score u100) (err u1))
    (map-set protocol-risk-scores protocol {score: score, factors: factors, assessed-at: block-height})
    (ok {protocol: protocol, score: score})))`
  },
  {
    name: "sentinel-tvl-aggregator-v1",
    code: `(define-map protocol-tvl (string-ascii 30) {tvl: uint, change-24h: int, rank: uint, updated: uint})
(define-data-var total-defi-tvl uint u0)
(define-data-var protocol-count uint u0)
(define-read-only (get-protocol-tvl (protocol (string-ascii 30))) (map-get? protocol-tvl protocol))
(define-read-only (get-total-tvl) (var-get total-defi-tvl))
(define-public (update-protocol-tvl (protocol (string-ascii 30)) (tvl uint) (change int) (rank uint))
  (begin
    (map-set protocol-tvl protocol {tvl: tvl, change-24h: change, rank: rank, updated: block-height})
    (var-set total-defi-tvl (+ (var-get total-defi-tvl) tvl))
    (var-set protocol-count (+ (var-get protocol-count) u1))
    (ok {protocol: protocol, tvl: tvl})))`
  },
  {
    name: "sentinel-alert-hub-v1",
    code: `(define-map alerts uint {alert-type: (string-ascii 20), severity: uint, message: (string-ascii 100), created: uint, resolved: bool})
(define-data-var alert-count uint u0)
(define-read-only (get-alert (id uint)) (map-get? alerts id))
(define-read-only (get-alert-count) (var-get alert-count))
(define-public (create-alert (alert-type (string-ascii 20)) (severity uint) (message (string-ascii 100)))
  (let ((id (var-get alert-count)))
    (map-set alerts id {alert-type: alert-type, severity: severity, message: message, created: block-height, resolved: false})
    (var-set alert-count (+ id u1))
    (ok id)))
(define-public (resolve-alert (id uint))
  (match (map-get? alerts id)
    alert (begin (map-set alerts id (merge alert {resolved: true})) (ok true))
    (err u1)))`
  },
  {
    name: "sentinel-dex-volume-v1",
    code: `(define-map dex-volumes (string-ascii 20) {volume-24h: uint, trades-24h: uint, fees-24h: uint, updated: uint})
(define-data-var total-volume uint u0)
(define-read-only (get-dex-volume (dex (string-ascii 20))) (map-get? dex-volumes dex))
(define-read-only (get-total-volume) (var-get total-volume))
(define-public (update-dex-volume (dex (string-ascii 20)) (volume uint) (trades uint) (fees uint))
  (begin
    (map-set dex-volumes dex {volume-24h: volume, trades-24h: trades, fees-24h: fees, updated: block-height})
    (var-set total-volume (+ (var-get total-volume) volume))
    (ok {dex: dex, volume: volume})))`
  },
  {
    name: "sentinel-staking-monitor-v1",
    code: `(define-map staking-pools (string-ascii 30) {total-staked: uint, reward-rate: uint, lock-period: uint, updated: uint})
(define-data-var total-staked-all uint u0)
(define-read-only (get-staking-pool (pool (string-ascii 30))) (map-get? staking-pools pool))
(define-read-only (get-total-staked) (var-get total-staked-all))
(define-public (update-staking-pool (pool (string-ascii 30)) (staked uint) (rate uint) (lock uint))
  (begin
    (map-set staking-pools pool {total-staked: staked, reward-rate: rate, lock-period: lock, updated: block-height})
    (var-set total-staked-all (+ (var-get total-staked-all) staked))
    (ok {pool: pool, staked: staked})))`
  },
  {
    name: "sentinel-bridge-health-v1",
    code: `(define-map bridge-status (string-ascii 20) {healthy: bool, reserves: uint, pending-txs: uint, last-check: uint})
(define-data-var bridge-count uint u0)
(define-read-only (get-bridge-status (bridge (string-ascii 20))) (map-get? bridge-status bridge))
(define-public (update-bridge-status (bridge (string-ascii 20)) (healthy bool) (reserves uint) (pending uint))
  (begin
    (map-set bridge-status bridge {healthy: healthy, reserves: reserves, pending-txs: pending, last-check: block-height})
    (var-set bridge-count (+ (var-get bridge-count) u1))
    (ok {bridge: bridge, healthy: healthy})))`
  }
];

async function deployContracts() {
  console.log("Deploying DeFi Sentinel contracts...\n");
  
  const response = await fetch(`https://api.mainnet.hiro.so/extended/v1/address/${ADDRESS}/nonces`);
  const data = await response.json();
  let nonce = data.possible_next_nonce;
  console.log(`Starting nonce: ${nonce}\n`);
  
  const deployed = [];
  
  for (const contract of sentinelContracts) {
    console.log(`Deploying ${contract.name}...`);
    try {
      const tx = await makeContractDeploy({
        contractName: contract.name,
        codeBody: contract.code,
        senderKey: PRIVATE_KEY,
        network: STACKS_MAINNET,
        anchorMode: AnchorMode.Any,
        fee: 10000,
        nonce: nonce,
      });
      const result = await broadcastTransaction({ transaction: tx, network: STACKS_MAINNET });
      console.log(`  TX: ${result.txid}`);
      deployed.push({ name: contract.name, txid: result.txid, nonce });
      nonce++;
      await sleep(1500);
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
  }
  
  console.log(`\n=== Deployed ${deployed.length} contracts ===`);
  return nonce;
}

async function interactWithContracts(startNonce) {
  console.log("\n\nRunning contract interactions...\n");
  let nonce = startNonce;
  
  const ops = [
    // Price Feed updates
    { contract: "sentinel-price-feed-v1", fn: "update-price", args: [stringAsciiCV("STX"), uintCV(1500000)] },
    { contract: "sentinel-price-feed-v1", fn: "update-price", args: [stringAsciiCV("sBTC"), uintCV(97000000000)] },
    { contract: "sentinel-price-feed-v1", fn: "update-price", args: [stringAsciiCV("ALEX"), uintCV(150000)] },
    
    // Whale tracking
    { contract: "sentinel-whale-tracker-v1", fn: "record-whale-tx", args: [principalCV("SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7"), uintCV(500000000000), stringAsciiCV("STX")] },
    { contract: "sentinel-whale-tracker-v1", fn: "set-threshold", args: [uintCV(50000000000)] },
    
    // Liquidity monitoring
    { contract: "sentinel-liquidity-monitor-v1", fn: "update-pool", args: [stringAsciiCV("STX-USDA"), uintCV(25000000000000), uintCV(15000000000000), uintCV(10000000000000)] },
    { contract: "sentinel-liquidity-monitor-v1", fn: "update-pool", args: [stringAsciiCV("STX-sBTC"), uintCV(50000000000000), uintCV(30000000000000), uintCV(20000000000000)] },
    
    // Yield tracking
    { contract: "sentinel-yield-tracker-v1", fn: "update-yield", args: [stringAsciiCV("ALEX-STX-LP"), uintCV(1250), uintCV(10000000000000), stringAsciiCV("ALEX")] },
    { contract: "sentinel-yield-tracker-v1", fn: "update-yield", args: [stringAsciiCV("Arkadiko-USDA"), uintCV(850), uintCV(5000000000000), stringAsciiCV("Arkadiko")] },
    
    // Risk scores
    { contract: "sentinel-risk-score-v1", fn: "set-risk-score", args: [principalCV("SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1"), uintCV(25), stringAsciiCV("Low risk: Audited, high TVL, long history")] },
    
    // TVL aggregation
    { contract: "sentinel-tvl-aggregator-v1", fn: "update-protocol-tvl", args: [stringAsciiCV("ALEX"), uintCV(150000000000000), 500, uintCV(1)] },
    { contract: "sentinel-tvl-aggregator-v1", fn: "update-protocol-tvl", args: [stringAsciiCV("Arkadiko"), uintCV(80000000000000), -200, uintCV(2)] },
    { contract: "sentinel-tvl-aggregator-v1", fn: "update-protocol-tvl", args: [stringAsciiCV("Velar"), uintCV(45000000000000), 1200, uintCV(3)] },
    
    // Alerts
    { contract: "sentinel-alert-hub-v1", fn: "create-alert", args: [stringAsciiCV("whale-movement"), uintCV(2), stringAsciiCV("Large STX transfer detected: 500k STX moved")] },
    { contract: "sentinel-alert-hub-v1", fn: "create-alert", args: [stringAsciiCV("price-spike"), uintCV(1), stringAsciiCV("ALEX price increased 15% in 1 hour")] },
    
    // DEX volumes
    { contract: "sentinel-dex-volume-v1", fn: "update-dex-volume", args: [stringAsciiCV("ALEX"), uintCV(25000000000000), uintCV(15420), uintCV(75000000000)] },
    { contract: "sentinel-dex-volume-v1", fn: "update-dex-volume", args: [stringAsciiCV("Velar"), uintCV(8000000000000), uintCV(5230), uintCV(24000000000)] },
    
    // Staking pools
    { contract: "sentinel-staking-monitor-v1", fn: "update-staking-pool", args: [stringAsciiCV("STX-stSTX"), uintCV(500000000000000), uintCV(550), uintCV(0)] },
    { contract: "sentinel-staking-monitor-v1", fn: "update-staking-pool", args: [stringAsciiCV("ALEX-autoALEX"), uintCV(200000000000000), uintCV(1200), uintCV(144)] },
    
    // Bridge health
    { contract: "sentinel-bridge-health-v1", fn: "update-bridge-status", args: [stringAsciiCV("sBTC"), boolCV(true), uintCV(1500000000000), uintCV(12)] },
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
        fee: 4000,
        nonce: nonce,
      });
      const result = await broadcastTransaction({ transaction: tx, network: STACKS_MAINNET });
      console.log(`  TX: ${result.txid}`);
      nonce++;
      await sleep(1200);
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
  }
  
  console.log(`\nFinal nonce: ${nonce}`);
}

async function main() {
  const nextNonce = await deployContracts();
  await sleep(3000);
  await interactWithContracts(nextNonce);
  
  // Check final balance
  const balRes = await fetch(`https://api.mainnet.hiro.so/extended/v1/address/${ADDRESS}/balances`);
  const balData = await balRes.json();
  console.log(`\nFinal STX balance: ${(parseInt(balData.stx.balance) / 1000000).toFixed(2)} STX`);
}

main().catch(console.error);
