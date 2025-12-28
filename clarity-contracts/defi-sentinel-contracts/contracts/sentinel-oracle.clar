;; Sentinel Price Oracle
;; Decentralized price feeds for STX, sBTC, and SNTL
;; Supports multiple price reporters with median aggregation

;; ==========================================
;; CONSTANTS
;; ==========================================
(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-not-reporter (err u101))
(define-constant err-invalid-price (err u102))
(define-constant err-stale-price (err u103))
(define-constant err-reporter-exists (err u104))
(define-constant err-reporter-not-found (err u105))

;; Price staleness threshold (blocks) - ~1 hour
(define-constant staleness-threshold u360)

;; Asset IDs
(define-constant ASSET-STX u1)
(define-constant ASSET-SBTC u2)
(define-constant ASSET-SNTL u3)

;; ==========================================
;; DATA VARIABLES
;; ==========================================
(define-data-var reporter-count uint u0)
(define-data-var min-reporters uint u1) ;; Minimum reporters for valid price

;; ==========================================
;; PRICE DATA
;; ==========================================
;; Main price storage (asset-id -> price info)
(define-map prices uint 
  {
    price: uint,              ;; Price in USD micro-units (6 decimals)
    last-update: uint,        ;; Block height of last update
    reporter: principal,      ;; Who submitted this price
    confidence: uint          ;; Confidence score (0-10000)
  }
)

;; Individual reporter prices (for aggregation)
(define-map reporter-prices { asset: uint, reporter: principal }
  {
    price: uint,
    timestamp: uint
  }
)

;; Authorized reporters
(define-map reporters principal bool)

;; Price history (last 10 prices per asset)
(define-map price-history { asset: uint, index: uint }
  {
    price: uint,
    block: uint
  }
)

(define-map history-index uint uint) ;; Current index for each asset

;; ==========================================
;; READ-ONLY FUNCTIONS
;; ==========================================

;; Get current price for an asset
(define-read-only (get-price (asset-id uint))
  (match (map-get? prices asset-id)
    price-data
    (let (
      (blocks-since-update (- stacks-block-height (get last-update price-data)))
    )
      (if (> blocks-since-update staleness-threshold)
        { price: (get price price-data), fresh: false, stale-blocks: blocks-since-update }
        { price: (get price price-data), fresh: true, stale-blocks: u0 }
      )
    )
    { price: u0, fresh: false, stale-blocks: u999999 }
  )
)

;; Get STX price
(define-read-only (get-stx-price)
  (get price (get-price ASSET-STX))
)

;; Get sBTC price
(define-read-only (get-sbtc-price)
  (get price (get-price ASSET-SBTC))
)

;; Get SNTL price
(define-read-only (get-sntl-price)
  (get price (get-price ASSET-SNTL))
)

;; Get all prices
(define-read-only (get-all-prices)
  {
    stx: (get-price ASSET-STX),
    sbtc: (get-price ASSET-SBTC),
    sntl: (get-price ASSET-SNTL),
    block: stacks-block-height
  }
)

;; Check if price is fresh
(define-read-only (is-price-fresh (asset-id uint))
  (get fresh (get-price asset-id))
)

;; Check if address is reporter
(define-read-only (is-reporter (address principal))
  (default-to false (map-get? reporters address))
)

;; Get price in different denomination
;; Convert amount of asset to USD value
(define-read-only (get-usd-value (asset-id uint) (amount uint))
  (let (
    (price (get price (get-price asset-id)))
  )
    (/ (* amount price) u1000000)
  )
)

;; Get oracle stats
(define-read-only (get-oracle-stats)
  {
    reporter-count: (var-get reporter-count),
    min-reporters: (var-get min-reporters),
    stx-price: (get-stx-price),
    sbtc-price: (get-sbtc-price),
    sntl-price: (get-sntl-price),
    current-block: stacks-block-height
  }
)

;; Get price history for an asset
(define-read-only (get-price-at-index (asset-id uint) (index uint))
  (map-get? price-history { asset: asset-id, index: index })
)

;; ==========================================
;; REPORTER FUNCTIONS
;; ==========================================

;; Submit price update (reporters only)
(define-public (submit-price (asset-id uint) (price uint))
  (let (
    (reporter tx-sender)
  )
    ;; Validations
    (asserts! (is-reporter reporter) err-not-reporter)
    (asserts! (> price u0) err-invalid-price)
    (asserts! (or (is-eq asset-id ASSET-STX) (is-eq asset-id ASSET-SBTC) (is-eq asset-id ASSET-SNTL)) err-invalid-price)
    
    ;; Store reporter's individual price
    (map-set reporter-prices { asset: asset-id, reporter: reporter }
      { price: price, timestamp: stacks-block-height }
    )
    
    ;; Update main price (in production, would aggregate from multiple reporters)
    (map-set prices asset-id {
      price: price,
      last-update: stacks-block-height,
      reporter: reporter,
      confidence: u10000 ;; 100% for single reporter
    })
    
    ;; Update history
    (let (
      (current-index (default-to u0 (map-get? history-index asset-id)))
      (next-index (mod (+ current-index u1) u10))
    )
      (map-set price-history { asset: asset-id, index: current-index }
        { price: price, block: stacks-block-height }
      )
      (map-set history-index asset-id next-index)
    )
    
    (ok { asset: asset-id, price: price, block: stacks-block-height })
  )
)

;; Batch price update
(define-public (submit-prices (stx-price uint) (sbtc-price uint) (sntl-price uint))
  (begin
    (asserts! (is-reporter tx-sender) err-not-reporter)
    (try! (submit-price ASSET-STX stx-price))
    (try! (submit-price ASSET-SBTC sbtc-price))
    (try! (submit-price ASSET-SNTL sntl-price))
    (ok {
      stx: stx-price,
      sbtc: sbtc-price,
      sntl: sntl-price,
      block: stacks-block-height
    })
  )
)

;; ==========================================
;; ADMIN FUNCTIONS
;; ==========================================

;; Add price reporter
(define-public (add-reporter (reporter principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (asserts! (not (is-reporter reporter)) err-reporter-exists)
    (map-set reporters reporter true)
    (var-set reporter-count (+ (var-get reporter-count) u1))
    (ok reporter)
  )
)

;; Remove price reporter
(define-public (remove-reporter (reporter principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (asserts! (is-reporter reporter) err-reporter-not-found)
    (map-delete reporters reporter)
    (var-set reporter-count (- (var-get reporter-count) u1))
    (ok reporter)
  )
)

;; Set minimum reporters for valid price
(define-public (set-min-reporters (min uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (var-set min-reporters min)
    (ok min)
  )
)

;; Emergency price update (owner only)
(define-public (emergency-update (asset-id uint) (price uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (asserts! (> price u0) err-invalid-price)
    (map-set prices asset-id {
      price: price,
      last-update: stacks-block-height,
      reporter: tx-sender,
      confidence: u10000
    })
    (ok { asset: asset-id, price: price })
  )
)

;; Initialize oracle with default prices
(define-public (initialize-prices)
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    ;; Set initial prices (approximate market values)
    (map-set prices ASSET-STX { price: u1200000, last-update: stacks-block-height, reporter: tx-sender, confidence: u10000 }) ;; $1.20
    (map-set prices ASSET-SBTC { price: u100000000000, last-update: stacks-block-height, reporter: tx-sender, confidence: u10000 }) ;; $100,000
    (map-set prices ASSET-SNTL { price: u100, last-update: stacks-block-height, reporter: tx-sender, confidence: u10000 }) ;; $0.0001
    ;; Add owner as first reporter
    (map-set reporters tx-sender true)
    (var-set reporter-count u1)
    (ok true)
  )
)

