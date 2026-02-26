;; Gas Optimizer v1 Contract
;; Transaction gas optimization through batching, gas price tracking,
;; optimal execution timing, and transaction queue management
;; Part of the Stacks DeFi Sentinel suite

(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u1100))
(define-constant err-not-authorized (err u1101))
(define-constant err-not-found (err u1102))
(define-constant err-invalid-amount (err u1103))
(define-constant err-queue-full (err u1104))
(define-constant err-already-executed (err u1105))
(define-constant err-batch-closed (err u1106))

;; Configuration constants
(define-constant MAX-BATCH-SIZE u50)
(define-constant MAX-QUEUE-ENTRIES u200)
(define-constant GAS-SAMPLE-INTERVAL u10) ;; Sample every 10 blocks

;; --- Data Variables ---
(define-data-var batch-count uint u0)
(define-data-var queue-size uint u0)
(define-data-var gas-sample-count uint u0)
(define-data-var current-avg-gas uint u200) ;; Default avg gas in microSTX
(define-data-var total-gas-saved uint u0)
(define-data-var total-txns-optimized uint u0)

(define-map authorized-executors principal bool)

;; --- Gas Price Samples ---
(define-map gas-samples uint
  {
    gas-price: uint,
    block-height: uint,
    mempool-size: uint,
    recorder: principal
  }
)

;; --- Transaction Queue ---
(define-map tx-queue uint
  {
    submitter: principal,
    tx-type: (string-ascii 30),
    target-contract: principal,
    estimated-gas: uint,
    max-gas-price: uint,
    priority: uint,
    submitted-block: uint,
    deadline-block: uint,
    executed: bool,
    batch-id: (optional uint)
  }
)

(define-data-var next-queue-id uint u0)

;; --- Transaction Batches ---
(define-map tx-batches uint
  {
    batch-size: uint,
    total-gas-estimate: uint,
    actual-gas-used: uint,
    gas-saved: uint,
    created-block: uint,
    executed-block: uint,
    executor: principal,
    status: (string-ascii 15)
  }
)

;; --- User Queue Stats ---
(define-map user-queue-stats principal
  {
    total-submitted: uint,
    total-executed: uint,
    total-gas-saved: uint
  }
)

;; --- Gas Price Moving Average ---
(define-map block-gas-averages uint uint)

;; --- Read-only Functions ---

(define-read-only (get-gas-sample (sample-id uint))
  (map-get? gas-samples sample-id)
)

(define-read-only (get-queue-entry (queue-id uint))
  (map-get? tx-queue queue-id)
)

(define-read-only (get-batch (batch-id uint))
  (map-get? tx-batches batch-id)
)

(define-read-only (get-user-stats (user principal))
  (map-get? user-queue-stats user)
)

(define-read-only (get-current-gas-price)
  (var-get current-avg-gas)
)

(define-read-only (get-optimizer-stats)
  {
    total-batches: (var-get batch-count),
    queue-size: (var-get queue-size),
    gas-samples: (var-get gas-sample-count),
    current-avg-gas: (var-get current-avg-gas),
    total-gas-saved: (var-get total-gas-saved),
    total-txns-optimized: (var-get total-txns-optimized)
  }
)

(define-read-only (is-executor (addr principal))
  (default-to false (map-get? authorized-executors addr))
)

(define-read-only (is-optimal-timing (max-gas uint))
  ;; Recommend execution if current gas is below user's max
  (<= (var-get current-avg-gas) max-gas)
)

(define-read-only (estimate-batch-savings (num-txns uint) (avg-gas uint))
  ;; Batching saves roughly 30% per additional transaction
  (if (> num-txns u1)
    (/ (* (* (- num-txns u1) avg-gas) u3000) u10000)
    u0
  )
)

;; --- Public Functions ---

(define-public (add-executor (executor principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (map-set authorized-executors executor true)
    (ok executor)
  )
)

(define-public (record-gas-price (gas-price uint) (mempool-size uint))
  (let (
    (sid (var-get gas-sample-count))
    (old-avg (var-get current-avg-gas))
    ;; Exponential moving average: new_avg = (old * 7 + new * 3) / 10
    (new-avg (/ (+ (* old-avg u7) (* gas-price u3)) u10))
  )
    (asserts! (or (is-eq tx-sender contract-owner) (is-executor tx-sender)) err-not-authorized)
    (asserts! (> gas-price u0) err-invalid-amount)

    (map-set gas-samples sid {
      gas-price: gas-price,
      block-height: stacks-block-height,
      mempool-size: mempool-size,
      recorder: tx-sender
    })

    (map-set block-gas-averages stacks-block-height new-avg)
    (var-set current-avg-gas new-avg)
    (var-set gas-sample-count (+ sid u1))

    (ok { sample-id: sid, new-avg-gas: new-avg })
  )
)

(define-public (submit-to-queue
    (tx-type (string-ascii 30))
    (target-contract principal)
    (estimated-gas uint)
    (max-gas-price uint)
    (priority uint)
    (deadline-block uint))
  (let (
    (qid (var-get next-queue-id))
    (existing-stats (map-get? user-queue-stats tx-sender))
  )
    (asserts! (< (var-get queue-size) MAX-QUEUE-ENTRIES) err-queue-full)
    (asserts! (> estimated-gas u0) err-invalid-amount)
    (asserts! (> deadline-block stacks-block-height) err-invalid-amount)

    (map-set tx-queue qid {
      submitter: tx-sender,
      tx-type: tx-type,
      target-contract: target-contract,
      estimated-gas: estimated-gas,
      max-gas-price: max-gas-price,
      priority: priority,
      submitted-block: stacks-block-height,
      deadline-block: deadline-block,
      executed: false,
      batch-id: none
    })

    ;; Update user stats
    (match existing-stats
      stats
      (map-set user-queue-stats tx-sender
        (merge stats { total-submitted: (+ (get total-submitted stats) u1) }))
      (map-set user-queue-stats tx-sender {
        total-submitted: u1,
        total-executed: u0,
        total-gas-saved: u0
      })
    )

    (var-set next-queue-id (+ qid u1))
    (var-set queue-size (+ (var-get queue-size) u1))

    (ok { queue-id: qid, estimated-gas: estimated-gas })
  )
)

(define-public (create-batch (total-gas-estimate uint))
  (let (
    (bid (var-get batch-count))
  )
    (asserts! (or (is-eq tx-sender contract-owner) (is-executor tx-sender)) err-not-authorized)

    (map-set tx-batches bid {
      batch-size: u0,
      total-gas-estimate: total-gas-estimate,
      actual-gas-used: u0,
      gas-saved: u0,
      created-block: stacks-block-height,
      executed-block: u0,
      executor: tx-sender,
      status: "open"
    })

    (var-set batch-count (+ bid u1))
    (ok { batch-id: bid })
  )
)

(define-public (assign-to-batch (queue-id uint) (batch-id uint))
  (match (map-get? tx-queue queue-id)
    entry
    (match (map-get? tx-batches batch-id)
      batch
      (begin
        (asserts! (or (is-eq tx-sender contract-owner) (is-executor tx-sender)) err-not-authorized)
        (asserts! (is-eq (get status batch) "open") err-batch-closed)
        (asserts! (not (get executed entry)) err-already-executed)
        (asserts! (< (get batch-size batch) MAX-BATCH-SIZE) err-queue-full)

        (map-set tx-queue queue-id (merge entry { batch-id: (some batch-id) }))
        (map-set tx-batches batch-id (merge batch {
          batch-size: (+ (get batch-size batch) u1),
          total-gas-estimate: (+ (get total-gas-estimate batch) (get estimated-gas entry))
        }))

        (ok { queue-id: queue-id, batch-id: batch-id })
      )
      err-not-found
    )
    err-not-found
  )
)

(define-public (execute-batch (batch-id uint) (actual-gas-used uint))
  (match (map-get? tx-batches batch-id)
    batch
    (let (
      (gas-saved (if (> (get total-gas-estimate batch) actual-gas-used)
        (- (get total-gas-estimate batch) actual-gas-used)
        u0))
    )
      (asserts! (or (is-eq tx-sender contract-owner) (is-executor tx-sender)) err-not-authorized)
      (asserts! (is-eq (get status batch) "open") err-batch-closed)

      (map-set tx-batches batch-id (merge batch {
        actual-gas-used: actual-gas-used,
        gas-saved: gas-saved,
        executed-block: stacks-block-height,
        status: "executed"
      }))

      (var-set total-gas-saved (+ (var-get total-gas-saved) gas-saved))
      (var-set total-txns-optimized (+ (var-get total-txns-optimized) (get batch-size batch)))

      (ok { batch-id: batch-id, gas-saved: gas-saved, txns-executed: (get batch-size batch) })
    )
    err-not-found
  )
)

(define-public (mark-executed (queue-id uint))
  (match (map-get? tx-queue queue-id)
    entry
    (begin
      (asserts! (or (is-eq tx-sender contract-owner) (is-executor tx-sender)) err-not-authorized)
      (asserts! (not (get executed entry)) err-already-executed)

      (map-set tx-queue queue-id (merge entry { executed: true }))
      (var-set queue-size (if (> (var-get queue-size) u0) (- (var-get queue-size) u1) u0))

      ;; Update user stats
      (match (map-get? user-queue-stats (get submitter entry))
        stats
        (map-set user-queue-stats (get submitter entry)
          (merge stats { total-executed: (+ (get total-executed stats) u1) }))
        false
      )

      (ok queue-id)
    )
    err-not-found
  )
)

;; --- Admin ---

(define-public (remove-executor (executor principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (map-delete authorized-executors executor)
    (ok executor)
  )
)
