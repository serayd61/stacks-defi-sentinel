;; sBTC Bridge Monitor v2 Contract
;; Tracks sBTC peg-in/peg-out events, monitors bridge health,
;; detects reserve imbalances, and records historical volume
;; Part of the Stacks DeFi Sentinel suite

(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u700))
(define-constant err-not-authorized (err u701))
(define-constant err-not-found (err u702))
(define-constant err-invalid-amount (err u703))
(define-constant err-bridge-paused (err u704))

;; Alert thresholds (basis points)
(define-constant IMBALANCE-WARNING-BPS u500)   ;; 5% imbalance triggers warning
(define-constant IMBALANCE-CRITICAL-BPS u1500) ;; 15% imbalance triggers critical
(define-constant MAX-SINGLE-TXN u100000000000) ;; Max single txn: 100k STX equiv

;; --- Data Variables ---
(define-data-var total-pegin-volume uint u0)
(define-data-var total-pegout-volume uint u0)
(define-data-var total-pegin-count uint u0)
(define-data-var total-pegout-count uint u0)
(define-data-var bridge-reserves uint u0)
(define-data-var sbtc-minted uint u0)
(define-data-var bridge-paused bool false)
(define-data-var alert-count uint u0)
(define-data-var event-count uint u0)

;; --- Authorization ---
(define-map authorized-watchers principal bool)

;; --- Bridge Events ---
(define-map bridge-events uint
  {
    event-type: (string-ascii 10),
    amount: uint,
    sender: principal,
    btc-txid: (string-ascii 64),
    block-recorded: uint,
    reporter: principal
  }
)

;; --- Hourly Volume Snapshots (keyed by epoch) ---
(define-map volume-snapshots uint
  {
    pegin-volume: uint,
    pegout-volume: uint,
    pegin-count: uint,
    pegout-count: uint,
    net-flow: int,
    reserves: uint,
    minted: uint,
    block-height: uint
  }
)

(define-data-var snapshot-count uint u0)

;; --- Bridge Alerts ---
(define-map bridge-alerts uint
  {
    alert-type: (string-ascii 30),
    severity: uint,
    reserves: uint,
    minted: uint,
    imbalance-bps: uint,
    block-height: uint,
    resolved: bool
  }
)

;; --- Read-only Functions ---

(define-read-only (get-bridge-health)
  (let (
    (reserves (var-get bridge-reserves))
    (minted (var-get sbtc-minted))
    (diff (if (> reserves minted) (- reserves minted) (- minted reserves)))
    (imbalance-bps (if (> minted u0) (/ (* diff u10000) minted) u0))
  )
    {
      reserves: reserves,
      minted: minted,
      imbalance-bps: imbalance-bps,
      healthy: (< imbalance-bps IMBALANCE-WARNING-BPS),
      paused: (var-get bridge-paused),
      total-pegin-volume: (var-get total-pegin-volume),
      total-pegout-volume: (var-get total-pegout-volume)
    }
  )
)

(define-read-only (get-bridge-event (event-id uint))
  (map-get? bridge-events event-id)
)

(define-read-only (get-volume-snapshot (snapshot-id uint))
  (map-get? volume-snapshots snapshot-id)
)

(define-read-only (get-bridge-alert (alert-id uint))
  (map-get? bridge-alerts alert-id)
)

(define-read-only (is-watcher (watcher principal))
  (default-to false (map-get? authorized-watchers watcher))
)

(define-read-only (get-net-flow)
  (let (
    (pegin (var-get total-pegin-volume))
    (pegout (var-get total-pegout-volume))
  )
    (if (>= pegin pegout)
      (to-int (- pegin pegout))
      (* (to-int (- pegout pegin)) (- 0 1))
    )
  )
)

(define-read-only (get-stats)
  {
    total-pegin-volume: (var-get total-pegin-volume),
    total-pegout-volume: (var-get total-pegout-volume),
    total-pegin-count: (var-get total-pegin-count),
    total-pegout-count: (var-get total-pegout-count),
    event-count: (var-get event-count),
    alert-count: (var-get alert-count)
  }
)

;; --- Public Functions ---

(define-public (add-watcher (watcher principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (map-set authorized-watchers watcher true)
    (ok watcher)
  )
)

(define-public (record-pegin (amount uint) (sender principal) (btc-txid (string-ascii 64)))
  (let (
    (eid (var-get event-count))
  )
    (asserts! (is-watcher tx-sender) err-not-authorized)
    (asserts! (not (var-get bridge-paused)) err-bridge-paused)
    (asserts! (and (> amount u0) (<= amount MAX-SINGLE-TXN)) err-invalid-amount)

    (map-set bridge-events eid {
      event-type: "pegin",
      amount: amount,
      sender: sender,
      btc-txid: btc-txid,
      block-recorded: stacks-block-height,
      reporter: tx-sender
    })

    (var-set total-pegin-volume (+ (var-get total-pegin-volume) amount))
    (var-set total-pegin-count (+ (var-get total-pegin-count) u1))
    (var-set bridge-reserves (+ (var-get bridge-reserves) amount))
    (var-set sbtc-minted (+ (var-get sbtc-minted) amount))
    (var-set event-count (+ eid u1))

    (ok { event-id: eid, event-type: "pegin", amount: amount })
  )
)

(define-public (record-pegout (amount uint) (sender principal) (btc-txid (string-ascii 64)))
  (let (
    (eid (var-get event-count))
    (current-minted (var-get sbtc-minted))
  )
    (asserts! (is-watcher tx-sender) err-not-authorized)
    (asserts! (not (var-get bridge-paused)) err-bridge-paused)
    (asserts! (and (> amount u0) (<= amount MAX-SINGLE-TXN)) err-invalid-amount)
    (asserts! (>= current-minted amount) err-invalid-amount)

    (map-set bridge-events eid {
      event-type: "pegout",
      amount: amount,
      sender: sender,
      btc-txid: btc-txid,
      block-recorded: stacks-block-height,
      reporter: tx-sender
    })

    (var-set total-pegout-volume (+ (var-get total-pegout-volume) amount))
    (var-set total-pegout-count (+ (var-get total-pegout-count) u1))
    (var-set bridge-reserves (- (var-get bridge-reserves) amount))
    (var-set sbtc-minted (- current-minted amount))
    (var-set event-count (+ eid u1))

    ;; Check imbalance after pegout
    (check-and-raise-alert)

    (ok { event-id: eid, event-type: "pegout", amount: amount })
  )
)

(define-public (take-volume-snapshot)
  (let (
    (sid (var-get snapshot-count))
    (pegin-vol (var-get total-pegin-volume))
    (pegout-vol (var-get total-pegout-volume))
  )
    (asserts! (is-watcher tx-sender) err-not-authorized)

    (map-set volume-snapshots sid {
      pegin-volume: pegin-vol,
      pegout-volume: pegout-vol,
      pegin-count: (var-get total-pegin-count),
      pegout-count: (var-get total-pegout-count),
      net-flow: (get-net-flow),
      reserves: (var-get bridge-reserves),
      minted: (var-get sbtc-minted),
      block-height: stacks-block-height
    })

    (var-set snapshot-count (+ sid u1))
    (ok { snapshot-id: sid })
  )
)

;; --- Internal Helpers ---

(define-private (check-and-raise-alert)
  (let (
    (reserves (var-get bridge-reserves))
    (minted (var-get sbtc-minted))
    (diff (if (> reserves minted) (- reserves minted) (- minted reserves)))
    (imbalance-bps (if (> minted u0) (/ (* diff u10000) minted) u0))
  )
    (if (> imbalance-bps IMBALANCE-WARNING-BPS)
      (let ((aid (var-get alert-count)))
        (map-set bridge-alerts aid {
          alert-type: (if (> imbalance-bps IMBALANCE-CRITICAL-BPS) "critical-imbalance" "warning-imbalance"),
          severity: (if (> imbalance-bps IMBALANCE-CRITICAL-BPS) u3 u2),
          reserves: reserves,
          minted: minted,
          imbalance-bps: imbalance-bps,
          block-height: stacks-block-height,
          resolved: false
        })
        (var-set alert-count (+ aid u1))
        true
      )
      false
    )
  )
)

;; --- Admin Functions ---

(define-public (pause-bridge)
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (var-set bridge-paused true)
    (ok true)
  )
)

(define-public (resume-bridge)
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (var-set bridge-paused false)
    (ok true)
  )
)

(define-public (resolve-alert (alert-id uint))
  (match (map-get? bridge-alerts alert-id)
    alert-data
    (begin
      (asserts! (or (is-eq tx-sender contract-owner) (is-watcher tx-sender)) err-not-authorized)
      (map-set bridge-alerts alert-id (merge alert-data { resolved: true }))
      (ok alert-id)
    )
    err-not-found
  )
)
