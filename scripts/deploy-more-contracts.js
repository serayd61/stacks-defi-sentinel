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

const PRIVATE_KEY = "***REMOVED***";
const ADDRESS = "SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// More DeFi and DAO contracts
const moreContracts = [
  {
    name: "dao-voting-v1",
    code: `(define-map proposals uint {title: (string-ascii 100), creator: principal, yes-votes: uint, no-votes: uint, end-block: uint, executed: bool})
(define-map votes {proposal: uint, voter: principal} bool)
(define-data-var proposal-count uint u0)
(define-read-only (get-proposal (id uint)) (map-get? proposals id))
(define-public (create-proposal (title (string-ascii 100)) (duration uint))
  (let ((id (var-get proposal-count)))
    (map-set proposals id {title: title, creator: tx-sender, yes-votes: u0, no-votes: u0, end-block: (+ block-height duration), executed: false})
    (var-set proposal-count (+ id u1))
    (ok id)))
(define-public (vote (proposal-id uint) (support bool))
  (let ((prop (unwrap! (get-proposal proposal-id) (err u1))))
    (asserts! (< block-height (get end-block prop)) (err u2))
    (asserts! (is-none (map-get? votes {proposal: proposal-id, voter: tx-sender})) (err u3))
    (map-set votes {proposal: proposal-id, voter: tx-sender} support)
    (if support
      (map-set proposals proposal-id (merge prop {yes-votes: (+ (get yes-votes prop) u1)}))
      (map-set proposals proposal-id (merge prop {no-votes: (+ (get no-votes prop) u1)})))
    (ok true)))`
  },
  {
    name: "dao-treasury-v1",
    code: `(define-data-var treasury-balance uint u0)
(define-map spending-requests uint {requester: principal, amount: uint, reason: (string-ascii 100), approved: bool})
(define-data-var request-count uint u0)
(define-read-only (get-balance) (var-get treasury-balance))
(define-read-only (get-request (id uint)) (map-get? spending-requests id))
(define-public (deposit (amount uint))
  (begin (var-set treasury-balance (+ (var-get treasury-balance) amount)) (ok amount)))
(define-public (request-spending (amount uint) (reason (string-ascii 100)))
  (let ((id (var-get request-count)))
    (map-set spending-requests id {requester: tx-sender, amount: amount, reason: reason, approved: false})
    (var-set request-count (+ id u1))
    (ok id)))`
  },
  {
    name: "bridge-analytics-v1",
    code: `(define-map daily-stats uint {pegin-count: uint, pegout-count: uint, volume: uint, fees: uint, block: uint})
(define-data-var day-count uint u0)
(define-data-var total-volume uint u0)
(define-data-var total-txs uint u0)
(define-read-only (get-daily-stats (day uint)) (map-get? daily-stats day))
(define-read-only (get-totals) {volume: (var-get total-volume), txs: (var-get total-txs)})
(define-public (record-daily (pegin uint) (pegout uint) (volume uint) (fees uint))
  (let ((day (var-get day-count)))
    (map-set daily-stats day {pegin-count: pegin, pegout-count: pegout, volume: volume, fees: fees, block: block-height})
    (var-set total-volume (+ (var-get total-volume) volume))
    (var-set total-txs (+ (var-get total-txs) pegin pegout))
    (var-set day-count (+ day u1))
    (ok day)))`
  },
  {
    name: "defi-portfolio-v1",
    code: `(define-map user-portfolios principal {total-value: uint, positions: uint, last-update: uint})
(define-map positions {user: principal, index: uint} {protocol: (string-ascii 30), amount: uint, value: uint})
(define-read-only (get-portfolio (user principal)) (map-get? user-portfolios user))
(define-read-only (get-position (user principal) (index uint)) (map-get? positions {user: user, index: index}))
(define-public (update-portfolio (total uint) (pos-count uint))
  (begin
    (map-set user-portfolios tx-sender {total-value: total, positions: pos-count, last-update: block-height})
    (ok true)))
(define-public (add-position (index uint) (protocol (string-ascii 30)) (amount uint) (value uint))
  (begin
    (map-set positions {user: tx-sender, index: index} {protocol: protocol, amount: amount, value: value})
    (ok true)))`
  },
  {
    name: "token-metrics-v1",
    code: `(define-map token-data (string-ascii 10) {price: uint, market-cap: uint, volume-24h: uint, supply: uint, updated: uint})
(define-data-var tracked-tokens uint u0)
(define-read-only (get-token-data (token (string-ascii 10))) (map-get? token-data token))
(define-read-only (get-tracked-count) (var-get tracked-tokens))
(define-public (update-token (token (string-ascii 10)) (price uint) (mcap uint) (vol uint) (supply uint))
  (begin
    (if (is-none (map-get? token-data token))
      (var-set tracked-tokens (+ (var-get tracked-tokens) u1))
      true)
    (map-set token-data token {price: price, market-cap: mcap, volume-24h: vol, supply: supply, updated: block-height})
    (ok {token: token, price: price})))`
  },
  {
    name: "swap-router-v1",
    code: `(define-map swap-routes {from: (string-ascii 10), to: (string-ascii 10)} {pool: (string-ascii 30), fee-bps: uint, active: bool})
(define-data-var route-count uint u0)
(define-read-only (get-route (from (string-ascii 10)) (to (string-ascii 10))) (map-get? swap-routes {from: from, to: to}))
(define-public (add-route (from (string-ascii 10)) (to (string-ascii 10)) (pool (string-ascii 30)) (fee uint))
  (begin
    (map-set swap-routes {from: from, to: to} {pool: pool, fee-bps: fee, active: true})
    (var-set route-count (+ (var-get route-count) u1))
    (ok {from: from, to: to, pool: pool})))
(define-public (toggle-route (from (string-ascii 10)) (to (string-ascii 10)) (active bool))
  (match (map-get? swap-routes {from: from, to: to})
    route (begin (map-set swap-routes {from: from, to: to} (merge route {active: active})) (ok true))
    (err u1)))`
  },
  {
    name: "lending-monitor-v1",
    code: `(define-map lending-pools (string-ascii 30) {total-supplied: uint, total-borrowed: uint, utilization: uint, supply-apy: uint, borrow-apy: uint, updated: uint})
(define-data-var pool-count uint u0)
(define-read-only (get-pool (pool (string-ascii 30))) (map-get? lending-pools pool))
(define-public (update-pool (pool (string-ascii 30)) (supplied uint) (borrowed uint) (supply-apy uint) (borrow-apy uint))
  (let ((util (if (> supplied u0) (/ (* borrowed u10000) supplied) u0)))
    (if (is-none (map-get? lending-pools pool))
      (var-set pool-count (+ (var-get pool-count) u1))
      true)
    (map-set lending-pools pool {total-supplied: supplied, total-borrowed: borrowed, utilization: util, supply-apy: supply-apy, borrow-apy: borrow-apy, updated: block-height})
    (ok {pool: pool, utilization: util})))`
  },
  {
    name: "nft-floor-tracker-v1",
    code: `(define-map collection-floors (string-ascii 50) {floor-price: uint, volume-24h: uint, sales-24h: uint, listed: uint, updated: uint})
(define-data-var collection-count uint u0)
(define-read-only (get-floor (collection (string-ascii 50))) (map-get? collection-floors collection))
(define-public (update-floor (collection (string-ascii 50)) (floor uint) (volume uint) (sales uint) (listed uint))
  (begin
    (if (is-none (map-get? collection-floors collection))
      (var-set collection-count (+ (var-get collection-count) u1))
      true)
    (map-set collection-floors collection {floor-price: floor, volume-24h: volume, sales-24h: sales, listed: listed, updated: block-height})
    (ok {collection: collection, floor: floor})))`
  },
  {
    name: "gas-tracker-v1",
    code: `(define-map gas-history uint {avg-fee: uint, min-fee: uint, max-fee: uint, tx-count: uint, block: uint})
(define-data-var history-count uint u0)
(define-data-var current-avg-fee uint u5000)
(define-read-only (get-gas-history (id uint)) (map-get? gas-history id))
(define-read-only (get-current-fee) (var-get current-avg-fee))
(define-public (record-gas (avg uint) (min-fee uint) (max-fee uint) (tx-count uint))
  (let ((id (var-get history-count)))
    (map-set gas-history id {avg-fee: avg, min-fee: min-fee, max-fee: max-fee, tx-count: tx-count, block: block-height})
    (var-set current-avg-fee avg)
    (var-set history-count (+ id u1))
    (ok id)))`
  },
  {
    name: "protocol-registry-v1",
    code: `(define-map protocols (string-ascii 30) {category: (string-ascii 20), tvl: uint, users: uint, launched: uint, audited: bool, active: bool})
(define-data-var protocol-count uint u0)
(define-read-only (get-protocol (name (string-ascii 30))) (map-get? protocols name))
(define-read-only (get-count) (var-get protocol-count))
(define-public (register-protocol (name (string-ascii 30)) (category (string-ascii 20)) (tvl uint) (users uint) (audited bool))
  (begin
    (if (is-none (map-get? protocols name))
      (var-set protocol-count (+ (var-get protocol-count) u1))
      true)
    (map-set protocols name {category: category, tvl: tvl, users: users, launched: block-height, audited: audited, active: true})
    (ok {name: name, category: category})))`
  }
];

async function deployContracts() {
  console.log("Deploying more DeFi contracts...\n");
  
  const response = await fetch(`https://api.mainnet.hiro.so/extended/v1/address/${ADDRESS}/nonces`);
  const data = await response.json();
  let nonce = data.possible_next_nonce;
  console.log(`Starting nonce: ${nonce}\n`);
  
  const deployed = [];
  
  for (const contract of moreContracts) {
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
      deployed.push({ name: contract.name, txid: result.txid });
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
    // DAO Voting
    { contract: "dao-voting-v1", fn: "create-proposal", args: [stringAsciiCV("Increase staking rewards by 10%"), uintCV(1008)] },
    { contract: "dao-voting-v1", fn: "vote", args: [uintCV(0), boolCV(true)] },
    
    // Treasury
    { contract: "dao-treasury-v1", fn: "deposit", args: [uintCV(1000000000)] },
    { contract: "dao-treasury-v1", fn: "request-spending", args: [uintCV(50000000), stringAsciiCV("Marketing campaign Q1")] },
    
    // Bridge Analytics
    { contract: "bridge-analytics-v1", fn: "record-daily", args: [uintCV(150), uintCV(120), uintCV(5000000000), uintCV(15000000)] },
    
    // Portfolio
    { contract: "defi-portfolio-v1", fn: "update-portfolio", args: [uintCV(25000000000), uintCV(5)] },
    { contract: "defi-portfolio-v1", fn: "add-position", args: [uintCV(0), stringAsciiCV("ALEX-STX-LP"), uintCV(10000000000), uintCV(15000000000)] },
    
    // Token Metrics
    { contract: "token-metrics-v1", fn: "update-token", args: [stringAsciiCV("STX"), uintCV(1500000), uintCV(2100000000000000), uintCV(50000000000000), uintCV(1400000000000000)] },
    { contract: "token-metrics-v1", fn: "update-token", args: [stringAsciiCV("ALEX"), uintCV(150000), uintCV(300000000000000), uintCV(8000000000000), uintCV(2000000000000000)] },
    
    // Swap Routes
    { contract: "swap-router-v1", fn: "add-route", args: [stringAsciiCV("STX"), stringAsciiCV("USDA"), stringAsciiCV("ALEX-STX-USDA"), uintCV(30)] },
    { contract: "swap-router-v1", fn: "add-route", args: [stringAsciiCV("STX"), stringAsciiCV("sBTC"), stringAsciiCV("Velar-STX-sBTC"), uintCV(25)] },
    
    // Lending Monitor
    { contract: "lending-monitor-v1", fn: "update-pool", args: [stringAsciiCV("Arkadiko-USDA"), uintCV(50000000000000), uintCV(35000000000000), uintCV(450), uintCV(850)] },
    
    // NFT Floor Tracker
    { contract: "nft-floor-tracker-v1", fn: "update-floor", args: [stringAsciiCV("Bitcoin Punks"), uintCV(500000000), uintCV(2500000000), uintCV(15), uintCV(120)] },
    
    // Gas Tracker
    { contract: "gas-tracker-v1", fn: "record-gas", args: [uintCV(5500), uintCV(2000), uintCV(15000), uintCV(1250)] },
    
    // Protocol Registry
    { contract: "protocol-registry-v1", fn: "register-protocol", args: [stringAsciiCV("ALEX"), stringAsciiCV("DEX"), uintCV(150000000000000), uintCV(45000), boolCV(true)] },
    { contract: "protocol-registry-v1", fn: "register-protocol", args: [stringAsciiCV("Arkadiko"), stringAsciiCV("Lending"), uintCV(80000000000000), uintCV(12000), boolCV(true)] },
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
  
  const balRes = await fetch(`https://api.mainnet.hiro.so/extended/v1/address/${ADDRESS}/balances`);
  const balData = await balRes.json();
  console.log(`\nFinal STX balance: ${(parseInt(balData.stx.balance) / 1000000).toFixed(2)} STX`);
}

main().catch(console.error);
