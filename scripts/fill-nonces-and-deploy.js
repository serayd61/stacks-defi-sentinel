const {
  makeSTXTokenTransfer,
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
const BURN_ADDRESS = "SP000000000000000000002Q6VF78";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const contracts = [
  // NFT MARKETPLACE (5)
  {
    name: "nft-marketplace-listings-v1",
    code: `(define-map listings uint {seller: principal, nft-contract: principal, token-id: uint, price: uint, active: bool})
(define-data-var listing-count uint u0)
(define-read-only (get-listing (id uint)) (map-get? listings id))
(define-public (create-listing (nft-contract principal) (token-id uint) (price uint))
  (let ((id (var-get listing-count)))
    (map-set listings id {seller: tx-sender, nft-contract: nft-contract, token-id: token-id, price: price, active: true})
    (var-set listing-count (+ id u1))
    (ok id)))`
  },
  {
    name: "nft-marketplace-offers-v1",
    code: `(define-map offers uint {buyer: principal, listing-id: uint, amount: uint, expires: uint, status: (string-ascii 20)})
(define-data-var offer-count uint u0)
(define-read-only (get-offer (id uint)) (map-get? offers id))
(define-public (make-offer (listing-id uint) (amount uint) (duration uint))
  (let ((id (var-get offer-count)))
    (map-set offers id {buyer: tx-sender, listing-id: listing-id, amount: amount, expires: (+ block-height duration), status: "pending"})
    (var-set offer-count (+ id u1))
    (ok id)))`
  },
  {
    name: "nft-marketplace-royalties-v1",
    code: `(define-map royalties principal {rate: uint, recipient: principal})
(define-read-only (get-royalty (collection principal)) (map-get? royalties collection))
(define-public (set-royalty (rate uint) (recipient principal))
  (begin (map-set royalties tx-sender {rate: rate, recipient: recipient}) (ok true)))`
  },
  {
    name: "nft-marketplace-auctions-v1",
    code: `(define-map auctions uint {seller: principal, nft-contract: principal, token-id: uint, min-bid: uint, highest-bid: uint, highest-bidder: (optional principal), end-block: uint})
(define-data-var auction-count uint u0)
(define-read-only (get-auction (id uint)) (map-get? auctions id))
(define-public (create-auction (nft-contract principal) (token-id uint) (min-bid uint) (duration uint))
  (let ((id (var-get auction-count)))
    (map-set auctions id {seller: tx-sender, nft-contract: nft-contract, token-id: token-id, min-bid: min-bid, highest-bid: u0, highest-bidder: none, end-block: (+ block-height duration)})
    (var-set auction-count (+ id u1))
    (ok id)))`
  },
  {
    name: "nft-marketplace-stats-v1",
    code: `(define-map collection-stats principal {floor: uint, volume: uint, sales: uint, listed: uint})
(define-read-only (get-stats (collection principal)) (map-get? collection-stats collection))
(define-public (update-stats (collection principal) (floor uint) (volume uint) (sales uint) (listed uint))
  (begin (map-set collection-stats collection {floor: floor, volume: volume, sales: sales, listed: listed}) (ok true)))`
  },

  // ORACLE (3)
  {
    name: "oracle-price-feed-v1",
    code: `(define-map prices (string-ascii 10) {price: uint, decimals: uint, updated: uint, source: principal})
(define-read-only (get-price (pair (string-ascii 10))) (map-get? prices pair))
(define-public (set-price (pair (string-ascii 10)) (price uint) (decimals uint))
  (begin (map-set prices pair {price: price, decimals: decimals, updated: block-height, source: tx-sender}) (ok price)))`
  },
  {
    name: "oracle-data-feed-v1",
    code: `(define-map data-feeds (string-ascii 30) {value: uint, timestamp: uint, reporter: principal})
(define-read-only (get-feed (key (string-ascii 30))) (map-get? data-feeds key))
(define-public (report (key (string-ascii 30)) (value uint))
  (begin (map-set data-feeds key {value: value, timestamp: block-height, reporter: tx-sender}) (ok value)))`
  },
  {
    name: "oracle-aggregator-v1",
    code: `(define-map aggregated (string-ascii 10) {avg-price: uint, min-price: uint, max-price: uint, sources: uint})
(define-read-only (get-aggregated (pair (string-ascii 10))) (map-get? aggregated pair))
(define-public (update-aggregated (pair (string-ascii 10)) (avg uint) (min uint) (max uint) (sources uint))
  (begin (map-set aggregated pair {avg-price: avg, min-price: min, max-price: max, sources: sources}) (ok true)))`
  },

  // PREDICTION HUB (4)
  {
    name: "prediction-markets-v1",
    code: `(define-map markets uint {creator: principal, question: (string-ascii 200), end-block: uint, resolved: bool, outcome: (optional bool)})
(define-data-var market-count uint u0)
(define-read-only (get-market (id uint)) (map-get? markets id))
(define-public (create-market (question (string-ascii 200)) (duration uint))
  (let ((id (var-get market-count)))
    (map-set markets id {creator: tx-sender, question: question, end-block: (+ block-height duration), resolved: false, outcome: none})
    (var-set market-count (+ id u1))
    (ok id)))`
  },
  {
    name: "prediction-bets-v1",
    code: `(define-map bets {market: uint, user: principal} {amount: uint, prediction: bool, claimed: bool})
(define-map market-totals uint {yes-amount: uint, no-amount: uint})
(define-read-only (get-bet (market uint) (user principal)) (map-get? bets {market: market, user: user}))
(define-public (place-bet (market uint) (prediction bool) (amount uint))
  (begin (map-set bets {market: market, user: tx-sender} {amount: amount, prediction: prediction, claimed: false}) (ok true)))`
  },
  {
    name: "prediction-resolver-v1",
    code: `(define-map resolvers principal bool)
(define-map resolutions uint {resolver: principal, outcome: bool, block: uint})
(define-read-only (is-resolver (addr principal)) (default-to false (map-get? resolvers addr)))
(define-public (add-resolver (addr principal)) (begin (map-set resolvers addr true) (ok true)))
(define-public (resolve (market uint) (outcome bool))
  (begin (map-set resolutions market {resolver: tx-sender, outcome: outcome, block: block-height}) (ok true)))`
  },
  {
    name: "prediction-leaderboard-v1",
    code: `(define-map leaderboard principal {wins: uint, losses: uint, total-wagered: uint, total-won: uint})
(define-read-only (get-stats (user principal)) (map-get? leaderboard user))
(define-public (record-win (user principal) (amount uint))
  (match (map-get? leaderboard user)
    s (begin (map-set leaderboard user (merge s {wins: (+ (get wins s) u1), total-won: (+ (get total-won s) amount)})) (ok true))
    (begin (map-set leaderboard user {wins: u1, losses: u0, total-wagered: u0, total-won: amount}) (ok true))))`
  },

  // SBTC TOOLS (4)
  {
    name: "sbtc-vault-v1",
    code: `(define-map vaults principal {deposited: uint, borrowed: uint, collateral-ratio: uint, last-update: uint})
(define-read-only (get-vault (owner principal)) (map-get? vaults owner))
(define-public (create-vault (deposit uint))
  (begin (map-set vaults tx-sender {deposited: deposit, borrowed: u0, collateral-ratio: u0, last-update: block-height}) (ok true)))`
  },
  {
    name: "sbtc-yield-v1",
    code: `(define-map yield-positions principal {staked: uint, rewards: uint, start-block: uint})
(define-data-var total-staked uint u0)
(define-read-only (get-position (user principal)) (map-get? yield-positions user))
(define-public (stake (amount uint))
  (begin
    (map-set yield-positions tx-sender {staked: amount, rewards: u0, start-block: block-height})
    (var-set total-staked (+ (var-get total-staked) amount))
    (ok amount)))`
  },
  {
    name: "sbtc-liquidation-v1",
    code: `(define-map liquidations uint {vault-owner: principal, liquidator: principal, amount: uint, block: uint})
(define-data-var liquidation-count uint u0)
(define-read-only (get-liquidation (id uint)) (map-get? liquidations id))
(define-public (record-liquidation (vault-owner principal) (amount uint))
  (let ((id (var-get liquidation-count)))
    (map-set liquidations id {vault-owner: vault-owner, liquidator: tx-sender, amount: amount, block: block-height})
    (var-set liquidation-count (+ id u1))
    (ok id)))`
  },
  {
    name: "sbtc-price-oracle-v1",
    code: `(define-data-var btc-price uint u0)
(define-data-var last-update uint u0)
(define-read-only (get-btc-price) {price: (var-get btc-price), updated: (var-get last-update)})
(define-public (update-btc-price (price uint))
  (begin (var-set btc-price price) (var-set last-update block-height) (ok price)))`
  },

  // SOCIAL PROTOCOL (3)
  {
    name: "social-profiles-v1",
    code: `(define-map profiles principal {username: (string-ascii 30), bio: (string-ascii 200), avatar: (string-ascii 100), created: uint})
(define-read-only (get-profile (user principal)) (map-get? profiles user))
(define-public (create-profile (username (string-ascii 30)) (bio (string-ascii 200)))
  (begin (map-set profiles tx-sender {username: username, bio: bio, avatar: "", created: block-height}) (ok true)))`
  },
  {
    name: "social-follows-v1",
    code: `(define-map follows {follower: principal, following: principal} bool)
(define-map follower-count principal uint)
(define-read-only (is-following (follower principal) (following principal)) (default-to false (map-get? follows {follower: follower, following: following})))
(define-public (follow (user principal))
  (begin (map-set follows {follower: tx-sender, following: user} true) (ok true)))
(define-public (unfollow (user principal))
  (begin (map-set follows {follower: tx-sender, following: user} false) (ok true)))`
  },
  {
    name: "social-posts-v1",
    code: `(define-map posts uint {author: principal, content: (string-ascii 280), likes: uint, created: uint})
(define-data-var post-count uint u0)
(define-read-only (get-post (id uint)) (map-get? posts id))
(define-public (create-post (content (string-ascii 280)))
  (let ((id (var-get post-count)))
    (map-set posts id {author: tx-sender, content: content, likes: u0, created: block-height})
    (var-set post-count (+ id u1))
    (ok id)))`
  },

  // SUBSCRIPTION (3)
  {
    name: "subscription-plans-v1",
    code: `(define-map plans uint {creator: principal, name: (string-ascii 50), price: uint, duration: uint, active: bool})
(define-data-var plan-count uint u0)
(define-read-only (get-plan (id uint)) (map-get? plans id))
(define-public (create-plan (name (string-ascii 50)) (price uint) (duration uint))
  (let ((id (var-get plan-count)))
    (map-set plans id {creator: tx-sender, name: name, price: price, duration: duration, active: true})
    (var-set plan-count (+ id u1))
    (ok id)))`
  },
  {
    name: "subscription-members-v1",
    code: `(define-map subscriptions {plan: uint, user: principal} {start: uint, end: uint, active: bool})
(define-read-only (get-subscription (plan uint) (user principal)) (map-get? subscriptions {plan: plan, user: user}))
(define-read-only (is-active (plan uint) (user principal))
  (match (map-get? subscriptions {plan: plan, user: user})
    s (and (get active s) (< block-height (get end s)))
    false))
(define-public (subscribe (plan uint) (duration uint))
  (begin (map-set subscriptions {plan: plan, user: tx-sender} {start: block-height, end: (+ block-height duration), active: true}) (ok true)))`
  },
  {
    name: "subscription-revenue-v1",
    code: `(define-map revenue principal {total: uint, withdrawn: uint})
(define-read-only (get-revenue (creator principal)) (map-get? revenue creator))
(define-public (record-payment (creator principal) (amount uint))
  (match (map-get? revenue creator)
    r (begin (map-set revenue creator {total: (+ (get total r) amount), withdrawn: (get withdrawn r)}) (ok true))
    (begin (map-set revenue creator {total: amount, withdrawn: u0}) (ok true))))`
  },

  // TIMELOCK (2)
  {
    name: "timelock-vesting-v1",
    code: `(define-map vesting-schedules uint {beneficiary: principal, total: uint, released: uint, start: uint, cliff: uint, duration: uint})
(define-data-var schedule-count uint u0)
(define-read-only (get-schedule (id uint)) (map-get? vesting-schedules id))
(define-public (create-schedule (beneficiary principal) (total uint) (cliff uint) (duration uint))
  (let ((id (var-get schedule-count)))
    (map-set vesting-schedules id {beneficiary: beneficiary, total: total, released: u0, start: block-height, cliff: cliff, duration: duration})
    (var-set schedule-count (+ id u1))
    (ok id)))`
  },
  {
    name: "timelock-governance-v1",
    code: `(define-map timelocked-actions uint {proposer: principal, action: (string-ascii 100), execute-after: uint, executed: bool})
(define-data-var action-count uint u0)
(define-read-only (get-action (id uint)) (map-get? timelocked-actions id))
(define-public (propose-action (action (string-ascii 100)) (delay uint))
  (let ((id (var-get action-count)))
    (map-set timelocked-actions id {proposer: tx-sender, action: action, execute-after: (+ block-height delay), executed: false})
    (var-set action-count (+ id u1))
    (ok id)))`
  },

  // TOKEN FACTORY (3)
  {
    name: "token-factory-registry-v1",
    code: `(define-map tokens uint {creator: principal, name: (string-ascii 50), symbol: (string-ascii 10), supply: uint, contract: principal})
(define-data-var token-count uint u0)
(define-read-only (get-token (id uint)) (map-get? tokens id))
(define-public (register-token (name (string-ascii 50)) (symbol (string-ascii 10)) (supply uint) (contract principal))
  (let ((id (var-get token-count)))
    (map-set tokens id {creator: tx-sender, name: name, symbol: symbol, supply: supply, contract: contract})
    (var-set token-count (+ id u1))
    (ok id)))`
  },
  {
    name: "token-factory-launchpad-v1",
    code: `(define-map launches uint {token-id: uint, price: uint, cap: uint, raised: uint, start: uint, end: uint})
(define-data-var launch-count uint u0)
(define-read-only (get-launch (id uint)) (map-get? launches id))
(define-public (create-launch (token-id uint) (price uint) (cap uint) (duration uint))
  (let ((id (var-get launch-count)))
    (map-set launches id {token-id: token-id, price: price, cap: cap, raised: u0, start: block-height, end: (+ block-height duration)})
    (var-set launch-count (+ id u1))
    (ok id)))`
  },
  {
    name: "token-factory-vesting-v1",
    code: `(define-map token-vesting {token: uint, holder: principal} {total: uint, claimed: uint, start: uint, end: uint})
(define-read-only (get-vesting (token uint) (holder principal)) (map-get? token-vesting {token: token, holder: holder}))
(define-public (create-vesting (token uint) (holder principal) (total uint) (duration uint))
  (begin (map-set token-vesting {token: token, holder: holder} {total: total, claimed: u0, start: block-height, end: (+ block-height duration)}) (ok true)))`
  },

  // VOTING (3)
  {
    name: "voting-proposals-v1",
    code: `(define-map proposals uint {creator: principal, title: (string-ascii 100), yes-votes: uint, no-votes: uint, end-block: uint, executed: bool})
(define-data-var proposal-count uint u0)
(define-read-only (get-proposal (id uint)) (map-get? proposals id))
(define-public (create-proposal (title (string-ascii 100)) (duration uint))
  (let ((id (var-get proposal-count)))
    (map-set proposals id {creator: tx-sender, title: title, yes-votes: u0, no-votes: u0, end-block: (+ block-height duration), executed: false})
    (var-set proposal-count (+ id u1))
    (ok id)))`
  },
  {
    name: "voting-ballots-v1",
    code: `(define-map votes {proposal: uint, voter: principal} {vote: bool, weight: uint, block: uint})
(define-read-only (get-vote (proposal uint) (voter principal)) (map-get? votes {proposal: proposal, voter: voter}))
(define-public (cast-vote (proposal uint) (vote bool) (weight uint))
  (begin (map-set votes {proposal: proposal, voter: tx-sender} {vote: vote, weight: weight, block: block-height}) (ok true)))`
  },
  {
    name: "voting-delegation-v1",
    code: `(define-map delegations principal {delegate: principal, weight: uint})
(define-read-only (get-delegation (delegator principal)) (map-get? delegations delegator))
(define-public (delegate (to principal) (weight uint))
  (begin (map-set delegations tx-sender {delegate: to, weight: weight}) (ok true)))
(define-public (revoke-delegation)
  (begin (map-delete delegations tx-sender) (ok true)))`
  },
];

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║  FILL NONCES & DEPLOY CONTRACTS                            ║");
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
          console.log(`  Error: ${result.reason || result.error}`);
        } else {
          console.log(`  TX: ${result.txid}`);
        }
        await sleep(300);
      } catch (e) {
        console.log(`  Error: ${e.message}`);
      }
    }
    
    console.log("\nWaiting for nonces to propagate...");
    await sleep(5000);
  }

  // Get updated nonce
  const newNonceRes = await fetch(`https://api.mainnet.hiro.so/extended/v1/address/${ADDRESS}/nonces`);
  const newNonceData = await newNonceRes.json();
  let nonce = newNonceData.possible_next_nonce;
  
  const balRes = await fetch(`https://api.mainnet.hiro.so/extended/v1/address/${ADDRESS}/balances`);
  const balData = await balRes.json();
  const initialBalance = parseInt(balData.stx.balance) / 1000000;
  
  console.log(`\nStarting nonce for deploys: ${nonce}`);
  console.log(`Current balance: ${initialBalance.toFixed(4)} STX\n`);

  // Deploy contracts
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  DEPLOYING CONTRACTS");
  console.log("═══════════════════════════════════════════════════════════\n");

  let deployed = 0;
  
  for (const contract of contracts) {
    console.log(`[${deployed + 1}/${contracts.length}] Deploying ${contract.name}...`);
    try {
      const tx = await makeContractDeploy({
        contractName: contract.name,
        codeBody: contract.code,
        senderKey: PRIVATE_KEY,
        network: STACKS_MAINNET,
        anchorMode: AnchorMode.Any,
        fee: 12000,
        nonce: nonce,
      });
      const result = await broadcastTransaction({ transaction: tx, network: STACKS_MAINNET });
      if (result.error) {
        console.log(`  Error: ${result.reason || result.error}`);
        if (result.reason === "TooMuchChaining") {
          console.log("  Waiting for chain to clear...");
          await sleep(10000);
        }
      } else {
        console.log(`  TX: ${result.txid}`);
        deployed++;
      }
      nonce++;
      await sleep(800);
    } catch (e) {
      console.log(`  Error: ${e.message}`);
      nonce++;
    }
  }

  // Final stats
  const finalBalRes = await fetch(`https://api.mainnet.hiro.so/extended/v1/address/${ADDRESS}/balances`);
  const finalBalData = await finalBalRes.json();
  const finalBalance = parseInt(finalBalData.stx.balance) / 1000000;

  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║                      SUMMARY                               ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");
  console.log(`Contracts deployed: ${deployed}/${contracts.length}`);
  console.log(`\nInitial balance: ${initialBalance.toFixed(4)} STX`);
  console.log(`Final balance: ${finalBalance.toFixed(4)} STX`);
  console.log(`Total spent: ${(initialBalance - finalBalance).toFixed(4)} STX`);
}

main().catch(console.error);
