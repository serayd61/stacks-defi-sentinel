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

// ═══════════════════════════════════════════════════════════════════════════
// STX-ESCROW CONTRACTS (10)
// ═══════════════════════════════════════════════════════════════════════════
const escrowContracts = [
  {
    name: "escrow-milestone-v1",
    code: `(define-map milestones uint {escrow-id: uint, amount: uint, completed: bool, approved: bool})
(define-data-var milestone-count uint u0)
(define-read-only (get-milestone (id uint)) (map-get? milestones id))
(define-public (create-milestone (escrow-id uint) (amount uint))
  (let ((id (var-get milestone-count)))
    (map-set milestones id {escrow-id: escrow-id, amount: amount, completed: false, approved: false})
    (var-set milestone-count (+ id u1))
    (ok id)))
(define-public (complete-milestone (id uint))
  (match (map-get? milestones id)
    m (begin (map-set milestones id (merge m {completed: true})) (ok true))
    (err u404)))`
  },
  {
    name: "escrow-dispute-v1",
    code: `(define-map disputes uint {escrow-id: uint, reason: (string-ascii 100), status: (string-ascii 20), created-at: uint})
(define-data-var dispute-count uint u0)
(define-read-only (get-dispute (id uint)) (map-get? disputes id))
(define-public (open-dispute (escrow-id uint) (reason (string-ascii 100)))
  (let ((id (var-get dispute-count)))
    (map-set disputes id {escrow-id: escrow-id, reason: reason, status: "open", created-at: block-height})
    (var-set dispute-count (+ id u1))
    (ok id)))
(define-public (resolve-dispute (id uint) (resolution (string-ascii 20)))
  (match (map-get? disputes id)
    d (begin (map-set disputes id (merge d {status: resolution})) (ok true))
    (err u404)))`
  },
  {
    name: "escrow-fee-v1",
    code: `(define-data-var platform-fee uint u250)
(define-data-var fee-recipient principal tx-sender)
(define-map fee-history uint {fee: uint, block: uint})
(define-data-var history-count uint u0)
(define-read-only (get-fee) (var-get platform-fee))
(define-read-only (calculate-fee (amount uint)) (/ (* amount (var-get platform-fee)) u10000))
(define-public (set-fee (new-fee uint))
  (begin
    (var-set platform-fee new-fee)
    (map-set fee-history (var-get history-count) {fee: new-fee, block: block-height})
    (var-set history-count (+ (var-get history-count) u1))
    (ok new-fee)))`
  },
  {
    name: "escrow-timelock-v1",
    code: `(define-map timelocks uint {escrow-id: uint, unlock-height: uint, amount: uint, released: bool})
(define-data-var lock-count uint u0)
(define-read-only (get-timelock (id uint)) (map-get? timelocks id))
(define-read-only (is-unlocked (id uint))
  (match (map-get? timelocks id)
    t (>= block-height (get unlock-height t))
    false))
(define-public (create-timelock (escrow-id uint) (duration uint) (amount uint))
  (let ((id (var-get lock-count)))
    (map-set timelocks id {escrow-id: escrow-id, unlock-height: (+ block-height duration), amount: amount, released: false})
    (var-set lock-count (+ id u1))
    (ok id)))`
  },
  {
    name: "escrow-multisig-v1",
    code: `(define-map signers {escrow-id: uint, signer: principal} bool)
(define-map signatures {escrow-id: uint, signer: principal} bool)
(define-map escrow-config uint {required: uint, total: uint})
(define-read-only (is-signer (escrow-id uint) (addr principal)) (default-to false (map-get? signers {escrow-id: escrow-id, signer: addr})))
(define-public (add-signer (escrow-id uint) (signer principal))
  (begin (map-set signers {escrow-id: escrow-id, signer: signer} true) (ok true)))
(define-public (sign-release (escrow-id uint))
  (begin (map-set signatures {escrow-id: escrow-id, signer: tx-sender} true) (ok true)))`
  },
  {
    name: "escrow-rating-v1",
    code: `(define-map ratings {escrow-id: uint, rater: principal} {score: uint, comment: (string-ascii 100)})
(define-map user-ratings principal {total-score: uint, count: uint})
(define-read-only (get-rating (escrow-id uint) (rater principal)) (map-get? ratings {escrow-id: escrow-id, rater: rater}))
(define-read-only (get-user-avg (user principal))
  (match (map-get? user-ratings user)
    r (/ (get total-score r) (get count r))
    u0))
(define-public (rate-user (escrow-id uint) (user principal) (score uint) (comment (string-ascii 100)))
  (begin
    (map-set ratings {escrow-id: escrow-id, rater: tx-sender} {score: score, comment: comment})
    (match (map-get? user-ratings user)
      existing (map-set user-ratings user {total-score: (+ (get total-score existing) score), count: (+ (get count existing) u1)})
      (map-set user-ratings user {total-score: score, count: u1}))
    (ok true)))`
  },
  {
    name: "escrow-template-v1",
    code: `(define-map templates uint {name: (string-ascii 50), fee-rate: uint, duration: uint, creator: principal})
(define-data-var template-count uint u0)
(define-read-only (get-template (id uint)) (map-get? templates id))
(define-public (create-template (name (string-ascii 50)) (fee-rate uint) (duration uint))
  (let ((id (var-get template-count)))
    (map-set templates id {name: name, fee-rate: fee-rate, duration: duration, creator: tx-sender})
    (var-set template-count (+ id u1))
    (ok id)))`
  },
  {
    name: "escrow-refund-v1",
    code: `(define-map refund-requests uint {escrow-id: uint, requester: principal, amount: uint, reason: (string-ascii 100), status: (string-ascii 20)})
(define-data-var request-count uint u0)
(define-read-only (get-request (id uint)) (map-get? refund-requests id))
(define-public (request-refund (escrow-id uint) (amount uint) (reason (string-ascii 100)))
  (let ((id (var-get request-count)))
    (map-set refund-requests id {escrow-id: escrow-id, requester: tx-sender, amount: amount, reason: reason, status: "pending"})
    (var-set request-count (+ id u1))
    (ok id)))
(define-public (approve-refund (id uint))
  (match (map-get? refund-requests id)
    r (begin (map-set refund-requests id (merge r {status: "approved"})) (ok true))
    (err u404)))`
  },
  {
    name: "escrow-batch-v1",
    code: `(define-map batches uint {creator: principal, escrow-count: uint, total-amount: uint, status: (string-ascii 20)})
(define-map batch-escrows {batch-id: uint, index: uint} uint)
(define-data-var batch-count uint u0)
(define-read-only (get-batch (id uint)) (map-get? batches id))
(define-public (create-batch (total-amount uint))
  (let ((id (var-get batch-count)))
    (map-set batches id {creator: tx-sender, escrow-count: u0, total-amount: total-amount, status: "active"})
    (var-set batch-count (+ id u1))
    (ok id)))
(define-public (add-to-batch (batch-id uint) (escrow-id uint))
  (match (map-get? batches batch-id)
    b (begin
        (map-set batch-escrows {batch-id: batch-id, index: (get escrow-count b)} escrow-id)
        (map-set batches batch-id (merge b {escrow-count: (+ (get escrow-count b) u1)}))
        (ok true))
    (err u404)))`
  },
  {
    name: "escrow-analytics-v1",
    code: `(define-data-var total-escrows uint u0)
(define-data-var total-volume uint u0)
(define-data-var completed-count uint u0)
(define-data-var disputed-count uint u0)
(define-map daily-stats uint {escrows: uint, volume: uint, date: uint})
(define-read-only (get-stats) {total: (var-get total-escrows), volume: (var-get total-volume), completed: (var-get completed-count), disputed: (var-get disputed-count)})
(define-public (record-escrow (amount uint))
  (begin
    (var-set total-escrows (+ (var-get total-escrows) u1))
    (var-set total-volume (+ (var-get total-volume) amount))
    (ok true)))
(define-public (record-completion) (begin (var-set completed-count (+ (var-get completed-count) u1)) (ok true)))
(define-public (record-dispute) (begin (var-set disputed-count (+ (var-get disputed-count) u1)) (ok true)))`
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// STACKS-UTILS CONTRACTS (10)
// ═══════════════════════════════════════════════════════════════════════════
const utilsContracts = [
  {
    name: "utils-address-v1",
    code: `(define-map address-labels principal (string-ascii 50))
(define-map address-tags {addr: principal, tag: (string-ascii 20)} bool)
(define-read-only (get-label (addr principal)) (map-get? address-labels addr))
(define-public (set-label (label (string-ascii 50)))
  (begin (map-set address-labels tx-sender label) (ok true)))
(define-public (add-tag (tag (string-ascii 20)))
  (begin (map-set address-tags {addr: tx-sender, tag: tag} true) (ok true)))`
  },
  {
    name: "utils-memo-v1",
    code: `(define-map memos uint {sender: principal, recipient: principal, memo: (string-ascii 200), block: uint})
(define-data-var memo-count uint u0)
(define-read-only (get-memo (id uint)) (map-get? memos id))
(define-public (send-memo (recipient principal) (memo (string-ascii 200)))
  (let ((id (var-get memo-count)))
    (map-set memos id {sender: tx-sender, recipient: recipient, memo: memo, block: block-height})
    (var-set memo-count (+ id u1))
    (ok id)))`
  },
  {
    name: "utils-registry-v1",
    code: `(define-map registry (string-ascii 50) {owner: principal, value: (string-ascii 200), updated: uint})
(define-read-only (lookup (key (string-ascii 50))) (map-get? registry key))
(define-public (register (key (string-ascii 50)) (value (string-ascii 200)))
  (begin (map-set registry key {owner: tx-sender, value: value, updated: block-height}) (ok true)))
(define-public (update-value (key (string-ascii 50)) (value (string-ascii 200)))
  (match (map-get? registry key)
    r (if (is-eq (get owner r) tx-sender)
        (begin (map-set registry key (merge r {value: value, updated: block-height})) (ok true))
        (err u403))
    (err u404)))`
  },
  {
    name: "utils-timestamp-v1",
    code: `(define-map timestamps (string-ascii 50) {block: uint, tx-sender: principal})
(define-data-var stamp-count uint u0)
(define-read-only (get-timestamp (key (string-ascii 50))) (map-get? timestamps key))
(define-read-only (get-block-time) block-height)
(define-public (stamp (key (string-ascii 50)))
  (begin
    (map-set timestamps key {block: block-height, tx-sender: tx-sender})
    (var-set stamp-count (+ (var-get stamp-count) u1))
    (ok block-height)))`
  },
  {
    name: "utils-hash-v1",
    code: `(define-map hash-records (buff 32) {creator: principal, block: uint, verified: bool})
(define-data-var record-count uint u0)
(define-read-only (get-record (hash (buff 32))) (map-get? hash-records hash))
(define-read-only (exists (hash (buff 32))) (is-some (map-get? hash-records hash)))
(define-public (record-hash (hash (buff 32)))
  (begin
    (map-set hash-records hash {creator: tx-sender, block: block-height, verified: false})
    (var-set record-count (+ (var-get record-count) u1))
    (ok true)))
(define-public (verify-hash (hash (buff 32)))
  (match (map-get? hash-records hash)
    r (begin (map-set hash-records hash (merge r {verified: true})) (ok true))
    (err u404)))`
  },
  {
    name: "utils-counter-v1",
    code: `(define-map counters (string-ascii 30) uint)
(define-read-only (get-counter (name (string-ascii 30))) (default-to u0 (map-get? counters name)))
(define-public (increment (name (string-ascii 30)))
  (let ((current (get-counter name)))
    (map-set counters name (+ current u1))
    (ok (+ current u1))))
(define-public (decrement (name (string-ascii 30)))
  (let ((current (get-counter name)))
    (if (> current u0)
      (begin (map-set counters name (- current u1)) (ok (- current u1)))
      (err u0))))
(define-public (reset (name (string-ascii 30)))
  (begin (map-set counters name u0) (ok u0)))`
  },
  {
    name: "utils-whitelist-v1",
    code: `(define-map whitelists (string-ascii 30) {owner: principal, active: bool})
(define-map whitelist-members {list: (string-ascii 30), member: principal} bool)
(define-read-only (is-member (list (string-ascii 30)) (addr principal)) (default-to false (map-get? whitelist-members {list: list, member: addr})))
(define-public (create-list (name (string-ascii 30)))
  (begin (map-set whitelists name {owner: tx-sender, active: true}) (ok true)))
(define-public (add-member (list (string-ascii 30)) (member principal))
  (begin (map-set whitelist-members {list: list, member: member} true) (ok true)))
(define-public (remove-member (list (string-ascii 30)) (member principal))
  (begin (map-set whitelist-members {list: list, member: member} false) (ok true)))`
  },
  {
    name: "utils-config-v1",
    code: `(define-map configs (string-ascii 30) {value: uint, updated: uint, updater: principal})
(define-read-only (get-config (key (string-ascii 30))) (map-get? configs key))
(define-read-only (get-value (key (string-ascii 30))) (default-to u0 (get value (map-get? configs key))))
(define-public (set-config (key (string-ascii 30)) (value uint))
  (begin (map-set configs key {value: value, updated: block-height, updater: tx-sender}) (ok value)))`
  },
  {
    name: "utils-batch-v1",
    code: `(define-map batch-jobs uint {creator: principal, status: (string-ascii 20), items: uint, processed: uint})
(define-data-var job-count uint u0)
(define-read-only (get-job (id uint)) (map-get? batch-jobs id))
(define-public (create-job (items uint))
  (let ((id (var-get job-count)))
    (map-set batch-jobs id {creator: tx-sender, status: "pending", items: items, processed: u0})
    (var-set job-count (+ id u1))
    (ok id)))
(define-public (process-item (job-id uint))
  (match (map-get? batch-jobs job-id)
    j (begin (map-set batch-jobs job-id (merge j {processed: (+ (get processed j) u1)})) (ok true))
    (err u404)))`
  },
  {
    name: "utils-events-v1",
    code: `(define-map events uint {emitter: principal, event-type: (string-ascii 30), data: (string-ascii 100), block: uint})
(define-data-var event-count uint u0)
(define-read-only (get-event (id uint)) (map-get? events id))
(define-read-only (get-event-count) (var-get event-count))
(define-public (emit (event-type (string-ascii 30)) (data (string-ascii 100)))
  (let ((id (var-get event-count)))
    (map-set events id {emitter: tx-sender, event-type: event-type, data: data, block: block-height})
    (var-set event-count (+ id u1))
    (ok id)))`
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// STACKS-ANALYTICS CONTRACTS (10)
// ═══════════════════════════════════════════════════════════════════════════
const analyticsContracts = [
  {
    name: "analytics-tvl-v1",
    code: `(define-map protocol-tvl (string-ascii 30) {tvl: uint, updated: uint})
(define-data-var total-tvl uint u0)
(define-read-only (get-protocol-tvl (protocol (string-ascii 30))) (map-get? protocol-tvl protocol))
(define-read-only (get-total-tvl) (var-get total-tvl))
(define-public (update-tvl (protocol (string-ascii 30)) (tvl uint))
  (begin
    (map-set protocol-tvl protocol {tvl: tvl, updated: block-height})
    (ok tvl)))`
  },
  {
    name: "analytics-volume-v1",
    code: `(define-map daily-volume uint {volume: uint, tx-count: uint})
(define-map token-volume (string-ascii 10) uint)
(define-read-only (get-daily (day uint)) (map-get? daily-volume day))
(define-read-only (get-token-volume (token (string-ascii 10))) (default-to u0 (map-get? token-volume token)))
(define-public (record-volume (day uint) (amount uint))
  (match (map-get? daily-volume day)
    d (begin (map-set daily-volume day {volume: (+ (get volume d) amount), tx-count: (+ (get tx-count d) u1)}) (ok true))
    (begin (map-set daily-volume day {volume: amount, tx-count: u1}) (ok true))))
(define-public (record-token-volume (token (string-ascii 10)) (amount uint))
  (begin (map-set token-volume token (+ (get-token-volume token) amount)) (ok true)))`
  },
  {
    name: "analytics-users-v1",
    code: `(define-map user-activity principal {first-seen: uint, last-seen: uint, tx-count: uint})
(define-data-var unique-users uint u0)
(define-read-only (get-user (addr principal)) (map-get? user-activity addr))
(define-read-only (get-unique-users) (var-get unique-users))
(define-public (record-activity (user principal))
  (match (map-get? user-activity user)
    u (begin (map-set user-activity user (merge u {last-seen: block-height, tx-count: (+ (get tx-count u) u1)})) (ok true))
    (begin
      (map-set user-activity user {first-seen: block-height, last-seen: block-height, tx-count: u1})
      (var-set unique-users (+ (var-get unique-users) u1))
      (ok true))))`
  },
  {
    name: "analytics-fees-v1",
    code: `(define-map fee-data uint {total-fees: uint, avg-fee: uint, tx-count: uint})
(define-data-var current-day uint u0)
(define-read-only (get-fee-data (day uint)) (map-get? fee-data day))
(define-public (record-fee (day uint) (fee uint))
  (match (map-get? fee-data day)
    d (let ((new-count (+ (get tx-count d) u1)))
        (map-set fee-data day {total-fees: (+ (get total-fees d) fee), avg-fee: (/ (+ (get total-fees d) fee) new-count), tx-count: new-count})
        (ok true))
    (begin (map-set fee-data day {total-fees: fee, avg-fee: fee, tx-count: u1}) (ok true))))`
  },
  {
    name: "analytics-pools-v1",
    code: `(define-map pool-stats (string-ascii 30) {liquidity: uint, volume-24h: uint, fee-24h: uint, updated: uint})
(define-data-var pool-count uint u0)
(define-read-only (get-pool (name (string-ascii 30))) (map-get? pool-stats name))
(define-public (update-pool (name (string-ascii 30)) (liquidity uint) (volume uint) (fees uint))
  (begin
    (if (is-none (map-get? pool-stats name))
      (var-set pool-count (+ (var-get pool-count) u1))
      true)
    (map-set pool-stats name {liquidity: liquidity, volume-24h: volume, fee-24h: fees, updated: block-height})
    (ok true)))`
  },
  {
    name: "analytics-tokens-v1",
    code: `(define-map token-stats (string-ascii 10) {price: uint, market-cap: uint, holders: uint, updated: uint})
(define-read-only (get-token (symbol (string-ascii 10))) (map-get? token-stats symbol))
(define-public (update-token (symbol (string-ascii 10)) (price uint) (mcap uint) (holders uint))
  (begin (map-set token-stats symbol {price: price, market-cap: mcap, holders: holders, updated: block-height}) (ok true)))`
  },
  {
    name: "analytics-dex-v1",
    code: `(define-map dex-stats (string-ascii 20) {tvl: uint, volume-24h: uint, trades-24h: uint, pairs: uint})
(define-read-only (get-dex (name (string-ascii 20))) (map-get? dex-stats name))
(define-public (update-dex (name (string-ascii 20)) (tvl uint) (volume uint) (trades uint) (pairs uint))
  (begin (map-set dex-stats name {tvl: tvl, volume-24h: volume, trades-24h: trades, pairs: pairs}) (ok true)))`
  },
  {
    name: "analytics-stacking-v1",
    code: `(define-map cycle-stats uint {total-stacked: uint, participants: uint, rewards: uint})
(define-data-var current-cycle uint u0)
(define-read-only (get-cycle (cycle uint)) (map-get? cycle-stats cycle))
(define-public (record-cycle (cycle uint) (stacked uint) (participants uint) (rewards uint))
  (begin
    (map-set cycle-stats cycle {total-stacked: stacked, participants: participants, rewards: rewards})
    (var-set current-cycle cycle)
    (ok true)))`
  },
  {
    name: "analytics-nft-v1",
    code: `(define-map collection-stats (string-ascii 50) {floor: uint, volume: uint, sales: uint, owners: uint})
(define-data-var collection-count uint u0)
(define-read-only (get-collection (name (string-ascii 50))) (map-get? collection-stats name))
(define-public (update-collection (name (string-ascii 50)) (floor uint) (volume uint) (sales uint) (owners uint))
  (begin
    (if (is-none (map-get? collection-stats name))
      (var-set collection-count (+ (var-get collection-count) u1))
      true)
    (map-set collection-stats name {floor: floor, volume: volume, sales: sales, owners: owners})
    (ok true)))`
  },
  {
    name: "analytics-bridge-v1",
    code: `(define-map bridge-stats (string-ascii 20) {inflow: uint, outflow: uint, tx-count: uint, updated: uint})
(define-read-only (get-bridge (name (string-ascii 20))) (map-get? bridge-stats name))
(define-public (record-inflow (bridge (string-ascii 20)) (amount uint))
  (match (map-get? bridge-stats bridge)
    b (begin (map-set bridge-stats bridge (merge b {inflow: (+ (get inflow b) amount), tx-count: (+ (get tx-count b) u1), updated: block-height})) (ok true))
    (begin (map-set bridge-stats bridge {inflow: amount, outflow: u0, tx-count: u1, updated: block-height}) (ok true))))
(define-public (record-outflow (bridge (string-ascii 20)) (amount uint))
  (match (map-get? bridge-stats bridge)
    b (begin (map-set bridge-stats bridge (merge b {outflow: (+ (get outflow b) amount), tx-count: (+ (get tx-count b) u1), updated: block-height})) (ok true))
    (begin (map-set bridge-stats bridge {inflow: u0, outflow: amount, tx-count: u1, updated: block-height}) (ok true))))`
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// INTERACTIONS
// ═══════════════════════════════════════════════════════════════════════════
const escrowInteractions = [
  { contract: "escrow-milestone-v1", fn: "create-milestone", args: [uintCV(1), uintCV(100000000)] },
  { contract: "escrow-milestone-v1", fn: "complete-milestone", args: [uintCV(0)] },
  { contract: "escrow-dispute-v1", fn: "open-dispute", args: [uintCV(1), stringAsciiCV("Delivery delayed")] },
  { contract: "escrow-fee-v1", fn: "set-fee", args: [uintCV(300)] },
  { contract: "escrow-timelock-v1", fn: "create-timelock", args: [uintCV(1), uintCV(144), uintCV(50000000)] },
  { contract: "escrow-multisig-v1", fn: "add-signer", args: [uintCV(1), principalCV("SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9")] },
  { contract: "escrow-rating-v1", fn: "rate-user", args: [uintCV(1), principalCV("SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9"), uintCV(5), stringAsciiCV("Great seller")] },
  { contract: "escrow-template-v1", fn: "create-template", args: [stringAsciiCV("Standard Escrow"), uintCV(250), uintCV(2016)] },
  { contract: "escrow-refund-v1", fn: "request-refund", args: [uintCV(1), uintCV(25000000), stringAsciiCV("Item not as described")] },
  { contract: "escrow-batch-v1", fn: "create-batch", args: [uintCV(500000000)] },
  { contract: "escrow-analytics-v1", fn: "record-escrow", args: [uintCV(100000000)] },
  { contract: "escrow-analytics-v1", fn: "record-completion", args: [] },
];

const utilsInteractions = [
  { contract: "utils-address-v1", fn: "set-label", args: [stringAsciiCV("DeFi Sentinel Deployer")] },
  { contract: "utils-address-v1", fn: "add-tag", args: [stringAsciiCV("developer")] },
  { contract: "utils-memo-v1", fn: "send-memo", args: [principalCV("SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9"), stringAsciiCV("Hello from Stacks Utils!")] },
  { contract: "utils-registry-v1", fn: "register", args: [stringAsciiCV("defi-sentinel"), stringAsciiCV("https://defi-sentinel.vercel.app")] },
  { contract: "utils-timestamp-v1", fn: "stamp", args: [stringAsciiCV("deployment-complete")] },
  { contract: "utils-counter-v1", fn: "increment", args: [stringAsciiCV("deployments")] },
  { contract: "utils-counter-v1", fn: "increment", args: [stringAsciiCV("deployments")] },
  { contract: "utils-whitelist-v1", fn: "create-list", args: [stringAsciiCV("trusted-contracts")] },
  { contract: "utils-whitelist-v1", fn: "add-member", args: [stringAsciiCV("trusted-contracts"), principalCV("SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9")] },
  { contract: "utils-config-v1", fn: "set-config", args: [stringAsciiCV("max-batch-size"), uintCV(100)] },
  { contract: "utils-batch-v1", fn: "create-job", args: [uintCV(50)] },
  { contract: "utils-events-v1", fn: "emit", args: [stringAsciiCV("contract-deployed"), stringAsciiCV("All utils contracts deployed successfully")] },
];

const analyticsInteractions = [
  { contract: "analytics-tvl-v1", fn: "update-tvl", args: [stringAsciiCV("ALEX"), uintCV(85000000000000)] },
  { contract: "analytics-tvl-v1", fn: "update-tvl", args: [stringAsciiCV("Velar"), uintCV(45000000000000)] },
  { contract: "analytics-volume-v1", fn: "record-volume", args: [uintCV(1), uintCV(12500000000)] },
  { contract: "analytics-volume-v1", fn: "record-token-volume", args: [stringAsciiCV("STX"), uintCV(8500000000)] },
  { contract: "analytics-users-v1", fn: "record-activity", args: [principalCV("SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB")] },
  { contract: "analytics-fees-v1", fn: "record-fee", args: [uintCV(1), uintCV(5000)] },
  { contract: "analytics-pools-v1", fn: "update-pool", args: [stringAsciiCV("STX-USDA"), uintCV(25000000000000), uintCV(5000000000), uintCV(15000000)] },
  { contract: "analytics-tokens-v1", fn: "update-token", args: [stringAsciiCV("STX"), uintCV(1850000), uintCV(2500000000000000), uintCV(125000)] },
  { contract: "analytics-dex-v1", fn: "update-dex", args: [stringAsciiCV("ALEX"), uintCV(85000000000000), uintCV(12000000000), uintCV(8500), uintCV(45)] },
  { contract: "analytics-stacking-v1", fn: "record-cycle", args: [uintCV(95), uintCV(450000000000000), uintCV(2500), uintCV(12500000000)] },
  { contract: "analytics-nft-v1", fn: "update-collection", args: [stringAsciiCV("Megapont Apes"), uintCV(2500000000), uintCV(15000000000), uintCV(450), uintCV(1200)] },
  { contract: "analytics-bridge-v1", fn: "record-inflow", args: [stringAsciiCV("sBTC-Bridge"), uintCV(500000000)] },
];

async function deployContracts(contracts, prefix, startNonce) {
  let nonce = startNonce;
  const deployed = [];
  
  console.log(`\n${"═".repeat(60)}`);
  console.log(`Deploying ${prefix} contracts...`);
  console.log(`${"═".repeat(60)}\n`);
  
  for (const contract of contracts) {
    const fullName = `${prefix}-${contract.name}`;
    console.log(`Deploying ${fullName}...`);
    
    try {
      const tx = await makeContractDeploy({
        contractName: fullName,
        codeBody: contract.code,
        senderKey: PRIVATE_KEY,
        network: STACKS_MAINNET,
        anchorMode: AnchorMode.Any,
        fee: 15000, // 0.015 STX per contract
        nonce: nonce,
      });
      
      const result = await broadcastTransaction({ transaction: tx, network: STACKS_MAINNET });
      
      if (result.error) {
        console.log(`  Error: ${result.reason || result.error}`);
      } else {
        console.log(`  TX: ${result.txid}`);
        deployed.push({ name: fullName, txid: result.txid });
      }
      
      nonce++;
      await sleep(800);
    } catch (e) {
      console.log(`  Error: ${e.message}`);
      nonce++;
    }
  }
  
  return { deployed, nextNonce: nonce };
}

async function runInteractions(interactions, prefix, startNonce) {
  let nonce = startNonce;
  let success = 0;
  
  console.log(`\n${"─".repeat(60)}`);
  console.log(`Running ${prefix} interactions...`);
  console.log(`${"─".repeat(60)}\n`);
  
  for (const op of interactions) {
    const fullContract = `${prefix}-${op.contract}`;
    console.log(`Calling ${fullContract}.${op.fn}...`);
    
    try {
      const tx = await makeContractCall({
        contractAddress: ADDRESS,
        contractName: fullContract,
        functionName: op.fn,
        functionArgs: op.args,
        senderKey: PRIVATE_KEY,
        network: STACKS_MAINNET,
        anchorMode: AnchorMode.Any,
        postConditionMode: PostConditionMode.Allow,
        fee: 3000, // 0.003 STX per call
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
      await sleep(600);
    } catch (e) {
      console.log(`  Error: ${e.message}`);
      nonce++;
    }
  }
  
  return { success, nextNonce: nonce };
}

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║     DEPLOYING 30 CONTRACTS + INTERACTIONS                  ║");
  console.log("║     Budget: 2 STX                                          ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");
  
  // Get starting nonce
  const nonceRes = await fetch(`https://api.mainnet.hiro.so/extended/v1/address/${ADDRESS}/nonces`);
  const nonceData = await nonceRes.json();
  let nonce = nonceData.possible_next_nonce;
  
  console.log(`Starting nonce: ${nonce}`);
  
  // Get initial balance
  const balRes = await fetch(`https://api.mainnet.hiro.so/extended/v1/address/${ADDRESS}/balances`);
  const balData = await balRes.json();
  const initialBalance = parseInt(balData.stx.balance) / 1000000;
  console.log(`Initial balance: ${initialBalance.toFixed(4)} STX\n`);
  
  // Deploy STX-ESCROW contracts
  const escrowResult = await deployContracts(escrowContracts, "stx-escrow", nonce);
  nonce = escrowResult.nextNonce;
  
  // Deploy STACKS-UTILS contracts
  const utilsResult = await deployContracts(utilsContracts, "stacks-utils", nonce);
  nonce = utilsResult.nextNonce;
  
  // Deploy STACKS-ANALYTICS contracts
  const analyticsResult = await deployContracts(analyticsContracts, "stacks-analytics", nonce);
  nonce = analyticsResult.nextNonce;
  
  // Wait a bit for contracts to be in mempool
  console.log("\nWaiting for contracts to propagate...");
  await sleep(3000);
  
  // Run interactions
  const escrowInterResult = await runInteractions(escrowInteractions, "stx-escrow", nonce);
  nonce = escrowInterResult.nextNonce;
  
  const utilsInterResult = await runInteractions(utilsInteractions, "stacks-utils", nonce);
  nonce = utilsInterResult.nextNonce;
  
  const analyticsInterResult = await runInteractions(analyticsInteractions, "stacks-analytics", nonce);
  nonce = analyticsInterResult.nextNonce;
  
  // Final balance
  const finalBalRes = await fetch(`https://api.mainnet.hiro.so/extended/v1/address/${ADDRESS}/balances`);
  const finalBalData = await finalBalRes.json();
  const finalBalance = parseInt(finalBalData.stx.balance) / 1000000;
  
  console.log("\n╔════════════════════════════════════════════════════════════╗");
  console.log("║                      SUMMARY                               ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");
  
  console.log(`STX-ESCROW:`);
  console.log(`  Contracts deployed: ${escrowResult.deployed.length}/10`);
  console.log(`  Interactions: ${escrowInterResult.success}/${escrowInteractions.length}`);
  
  console.log(`\nSTACKS-UTILS:`);
  console.log(`  Contracts deployed: ${utilsResult.deployed.length}/10`);
  console.log(`  Interactions: ${utilsInterResult.success}/${utilsInteractions.length}`);
  
  console.log(`\nSTACKS-ANALYTICS:`);
  console.log(`  Contracts deployed: ${analyticsResult.deployed.length}/10`);
  console.log(`  Interactions: ${analyticsInterResult.success}/${analyticsInteractions.length}`);
  
  console.log(`\n${"─".repeat(60)}`);
  console.log(`Total contracts: ${escrowResult.deployed.length + utilsResult.deployed.length + analyticsResult.deployed.length}/30`);
  console.log(`Total interactions: ${escrowInterResult.success + utilsInterResult.success + analyticsInterResult.success}/${escrowInteractions.length + utilsInteractions.length + analyticsInteractions.length}`);
  console.log(`\nInitial balance: ${initialBalance.toFixed(4)} STX`);
  console.log(`Final balance: ${finalBalance.toFixed(4)} STX`);
  console.log(`Total spent: ${(initialBalance - finalBalance).toFixed(4)} STX`);
}

main().catch(console.error);
