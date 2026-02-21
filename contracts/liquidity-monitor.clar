;; Liquidity Monitor Contract
;; Tracks liquidity pool health, depth, and anomalies on Stacks DEXes
;; Monitors Velar, ALEX, and other Stacks DEX pools

(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u300))
(define-constant err-not-authorized (err u301))
(define-constant err-not-found (err u302))
(define-constant err-invalid-value (err u303))
(define-constant err-pool-inactive (err u304))

(define-constant MIN-LIQUIDITY-THRESHOLD u1000000000) ;; 1000 STX min

(define-data-var pool-count uint u0)
(define-data-var snapshot-count uint u0)
(define-data-var alert-count uint u0)

(define-map authorized-monitors principal bool)

;; Liquidity pools registry
(define-map pools principal
  {
    name: (string-ascii 50),
    token-a: (string-ascii 20),
    token-b: (string-ascii 20),
    dex: (string-ascii 30),
    reserve-a: uint,
    reserve-b: uint,
    total-liquidity: uint,
    last-update: uint,
    active: bool,
    min-liquidity: uint,
    alert-threshold-bps: uint
  }
)

;; Pool snapshots
(define-map pool-snapshots
  { pool: principal, snapshot-id: uint }
  {
    reserve-a: uint,
    reserve-b: uint,
    total-liquidity: uint,
    price-ratio: uint,
    block-height: uint,
    recorded-by: principal
  }
)

(define-map pool-snapshot-count principal uint)

;; Liquidity alerts
(define-map liquidity-alerts uint
  {
    pool: principal,
    alert-type: (string-ascii 30),
    severity: uint,
    liquidity-before: uint,
    liquidity-after: uint,
    change-bps: uint,
    block-height: uint,
    resolved: bool
  }
)

;; Read-only
(define-read-only (get-pool (pool principal))
  (map-get? pools pool)
)

(define-read-only (get-pool-snapshot (pool principal) (snapshot-id uint))
  (map-get? pool-snapshots { pool: pool, snapshot-id: snapshot-id })
)

(define-read-only (get-alert (alert-id uint))
  (map-get? liquidity-alerts alert-id)
)

(define-read-only (calculate-price-ratio (reserve-a uint) (reserve-b uint))
  (if (> reserve-b u0)
    (ok (/ (* reserve-a u1000000) reserve-b))
    err-invalid-value
  )
)

(define-read-only (is-monitor (monitor principal))
  (default-to false (map-get? authorized-monitors monitor))
)

(define-read-only (get-pool-count)
  (var-get pool-count)
)

;; Public functions
(define-public (add-monitor (monitor principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (map-set authorized-monitors monitor true)
    (ok monitor)
  )
)

(define-public (register-pool
    (pool principal)
    (name (string-ascii 50))
    (token-a (string-ascii 20))
    (token-b (string-ascii 20))
    (dex (string-ascii 30))
    (initial-reserve-a uint)
    (initial-reserve-b uint)
    (alert-threshold-bps uint))
  (begin
    (asserts! (is-monitor tx-sender) err-not-authorized)
    (map-set pools pool {
      name: name,
      token-a: token-a,
      token-b: token-b,
      dex: dex,
      reserve-a: initial-reserve-a,
      reserve-b: initial-reserve-b,
      total-liquidity: (+ initial-reserve-a initial-reserve-b),
      last-update: stacks-block-height,
      active: true,
      min-liquidity: MIN-LIQUIDITY-THRESHOLD,
      alert-threshold-bps: alert-threshold-bps
    })
    (var-set pool-count (+ (var-get pool-count) u1))
    (ok { pool: pool, name: name })
  )
)

(define-public (update-pool-liquidity
    (pool principal)
    (new-reserve-a uint)
    (new-reserve-b uint))
  (match (map-get? pools pool)
    pool-data
    (let (
      (snapshot-id (default-to u0 (map-get? pool-snapshot-count pool)))
      (new-total (+ new-reserve-a new-reserve-b))
      (old-total (get total-liquidity pool-data))
      (price-ratio (/ (* new-reserve-a u1000000) (if (> new-reserve-b u0) new-reserve-b u1)))
    )
      (asserts! (is-monitor tx-sender) err-not-authorized)
      (asserts! (get active pool-data) err-pool-inactive)

      (map-set pool-snapshots
        { pool: pool, snapshot-id: snapshot-id }
        {
          reserve-a: new-reserve-a,
          reserve-b: new-reserve-b,
          total-liquidity: new-total,
          price-ratio: price-ratio,
          block-height: stacks-block-height,
          recorded-by: tx-sender
        }
      )

      (map-set pools pool (merge pool-data {
        reserve-a: new-reserve-a,
        reserve-b: new-reserve-b,
        total-liquidity: new-total,
        last-update: stacks-block-height
      }))

      (map-set pool-snapshot-count pool (+ snapshot-id u1))
      (var-set snapshot-count (+ (var-get snapshot-count) u1))

      ;; Check for liquidity drop alert
      (let (
        (drop-bps (if (> old-total new-total)
          (/ (* (- old-total new-total) u10000) old-total)
          u0))
      )
        (if (> drop-bps (get alert-threshold-bps pool-data))
          (let ((alert-id (var-get alert-count)))
            (map-set liquidity-alerts alert-id {
              pool: pool,
              alert-type: "liquidity-drop",
              severity: (if (> drop-bps u5000) u3 u2),
              liquidity-before: old-total,
              liquidity-after: new-total,
              change-bps: drop-bps,
              block-height: stacks-block-height,
              resolved: false
            })
            (var-set alert-count (+ alert-id u1))
            (ok { snapshot-id: snapshot-id, alert-raised: true, drop-bps: drop-bps })
          )
          (ok { snapshot-id: snapshot-id, alert-raised: false, drop-bps: drop-bps })
        )
      )
    )
    err-not-found
  )
)

(define-public (resolve-alert (alert-id uint))
  (match (map-get? liquidity-alerts alert-id)
    alert
    (begin
      (asserts! (is-monitor tx-sender) err-not-authorized)
      (map-set liquidity-alerts alert-id (merge alert { resolved: true }))
      (ok alert-id)
    )
    err-not-found
  )
)
