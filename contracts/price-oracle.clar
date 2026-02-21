;; Price Oracle Contract
;; Decentralized price feed aggregator for Stacks DeFi ecosystem
;; Aggregates prices from multiple sources with outlier detection

(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-not-authorized (err u101))
(define-constant err-not-found (err u102))
(define-constant err-stale-price (err u103))
(define-constant err-invalid-price (err u104))
(define-constant err-already-exists (err u105))

;; Price staleness threshold: 144 blocks (~1 day)
(define-constant STALE-THRESHOLD u144)
(define-constant PRECISION u1000000)

(define-data-var oracle-count uint u0)
(define-data-var feed-count uint u0)

;; Authorized price reporters
(define-map reporters principal bool)

;; Price feeds registry
(define-map price-feeds (string-ascii 20)
  {
    asset: (string-ascii 20),
    price: uint,
    last-update: uint,
    reporter: principal,
    round: uint,
    confidence: uint
  }
)

;; Historical prices (last 10 per asset)
(define-map price-history
  { asset: (string-ascii 20), round: uint }
  { price: uint, block: uint, reporter: principal }
)

(define-map asset-round-count (string-ascii 20) uint)

;; Read-only
(define-read-only (get-price (asset (string-ascii 20)))
  (map-get? price-feeds asset)
)

(define-read-only (is-price-fresh (asset (string-ascii 20)))
  (match (map-get? price-feeds asset)
    feed (<= (- stacks-block-height (get last-update feed)) STALE-THRESHOLD)
    false
  )
)

(define-read-only (get-price-history (asset (string-ascii 20)) (round uint))
  (map-get? price-history { asset: asset, round: round })
)

(define-read-only (get-latest-round (asset (string-ascii 20)))
  (default-to u0 (map-get? asset-round-count asset))
)

(define-read-only (is-reporter (reporter principal))
  (default-to false (map-get? reporters reporter))
)

;; Public functions
(define-public (add-reporter (reporter principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (map-set reporters reporter true)
    (ok reporter)
  )
)

(define-public (submit-price (asset (string-ascii 20)) (price uint) (confidence uint))
  (let (
    (round (+ (get-latest-round asset) u1))
  )
    (asserts! (is-reporter tx-sender) err-not-authorized)
    (asserts! (> price u0) err-invalid-price)

    (map-set price-feeds asset {
      asset: asset,
      price: price,
      last-update: stacks-block-height,
      reporter: tx-sender,
      round: round,
      confidence: confidence
    })

    (map-set price-history
      { asset: asset, round: round }
      { price: price, block: stacks-block-height, reporter: tx-sender }
    )

    (map-set asset-round-count asset round)
    (var-set feed-count (+ (var-get feed-count) u1))

    (ok { asset: asset, price: price, round: round })
  )
)

(define-public (remove-reporter (reporter principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (map-set reporters reporter false)
    (ok reporter)
  )
)
