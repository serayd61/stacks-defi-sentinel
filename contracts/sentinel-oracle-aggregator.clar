;; Sentinel Oracle Aggregator
;; Aggregates prices from multiple oracle sources (Pyth, DIA)
;; Provides unified price feed interface for DeFi applications

(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-not-found (err u101))
(define-constant err-stale-price (err u102))
(define-constant err-invalid-source (err u103))

;; Oracle source addresses
(define-constant PYTH-ORACLE 'SP1CGXWEAMG6P6FT04W66NVGJ7PQWMDAC19R7PJ0Y.pyth-oracle-v4)
(define-constant PYTH-STORAGE 'SP1CGXWEAMG6P6FT04W66NVGJ7PQWMDAC19R7PJ0Y.pyth-storage-v4)
(define-constant DIA-ORACLE 'SP1G48FZ4Y7JY8G2Z0N51QTCYGBQ6F4J43J77BQC0.dia-oracle)

;; Pyth Price Feed IDs (32 bytes)
;; BTC/USD: 0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43
;; ETH/USD: 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace
;; STX/USD: 0xec7a775f46379b5e943c3526b1c8d54cd49749176b0b98e02dde68d1bd335c17

;; Cached aggregated prices
(define-map aggregated-prices (string-ascii 10)
  {
    price: uint,
    sources-count: uint,
    last-update: uint,
    confidence: uint
  }
)

;; Individual source prices for transparency
(define-map source-prices { asset: (string-ascii 10), source: (string-ascii 10) }
  {
    price: uint,
    timestamp: uint
  }
)

;; Supported assets configuration
(define-map asset-config (string-ascii 10)
  {
    pyth-feed-id: (buff 32),
    dia-key: (string-ascii 32),
    decimals: uint,
    active: bool
  }
)

;; Initialize supported assets
(map-set asset-config "BTC" {
  pyth-feed-id: 0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43,
  dia-key: "BTC/USD",
  decimals: u8,
  active: true
})

(map-set asset-config "ETH" {
  pyth-feed-id: 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace,
  dia-key: "ETH/USD",
  decimals: u8,
  active: true
})

(map-set asset-config "STX" {
  pyth-feed-id: 0xec7a775f46379b5e943c3526b1c8d54cd49749176b0b98e02dde68d1bd335c17,
  dia-key: "STX/USD",
  decimals: u8,
  active: true
})

;; Read-only functions

;; Get aggregated price for an asset
(define-read-only (get-aggregated-price (asset (string-ascii 10)))
  (map-get? aggregated-prices asset)
)

;; Get price from specific source
(define-read-only (get-source-price (asset (string-ascii 10)) (source (string-ascii 10)))
  (map-get? source-prices { asset: asset, source: source })
)

;; Get asset configuration
(define-read-only (get-asset-config (asset (string-ascii 10)))
  (map-get? asset-config asset)
)

;; Check if price is fresh (within 100 blocks ~ 16 hours)
(define-read-only (is-price-fresh (asset (string-ascii 10)))
  (match (map-get? aggregated-prices asset)
    price-data (<= (- block-height (get last-update price-data)) u100)
    false
  )
)

;; Get all supported assets prices
(define-read-only (get-all-prices)
  {
    btc: (map-get? aggregated-prices "BTC"),
    eth: (map-get? aggregated-prices "ETH"),
    stx: (map-get? aggregated-prices "STX")
  }
)

;; Public functions

;; Update price from DIA oracle (can be called by anyone)
(define-public (update-from-dia (asset (string-ascii 10)))
  (let (
    (config (unwrap! (map-get? asset-config asset) err-not-found))
    (dia-result (contract-call? DIA-ORACLE get-value (get dia-key config)))
  )
    (match dia-result
      dia-data 
        (begin
          (map-set source-prices 
            { asset: asset, source: "DIA" }
            { price: (get value dia-data), timestamp: (get timestamp dia-data) }
          )
          (try! (recalculate-aggregated-price asset))
          (ok { source: "DIA", price: (get value dia-data) })
        )
      err-val err-not-found
    )
  )
)

;; Manual price update (for testing or backup)
(define-public (manual-update (asset (string-ascii 10)) (price uint) (source (string-ascii 10)))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (map-set source-prices 
      { asset: asset, source: source }
      { price: price, timestamp: block-height }
    )
    (try! (recalculate-aggregated-price asset))
    (ok { asset: asset, price: price, source: source })
  )
)

;; Add new asset configuration
(define-public (add-asset (asset (string-ascii 10)) (pyth-feed-id (buff 32)) (dia-key (string-ascii 32)) (decimals uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (map-set asset-config asset {
      pyth-feed-id: pyth-feed-id,
      dia-key: dia-key,
      decimals: decimals,
      active: true
    })
    (ok asset)
  )
)

;; Private functions

;; Recalculate aggregated price from all sources
(define-private (recalculate-aggregated-price (asset (string-ascii 10)))
  (let (
    (dia-price (default-to { price: u0, timestamp: u0 } (map-get? source-prices { asset: asset, source: "DIA" })))
    (pyth-price (default-to { price: u0, timestamp: u0 } (map-get? source-prices { asset: asset, source: "PYTH" })))
    (manual-price (default-to { price: u0, timestamp: u0 } (map-get? source-prices { asset: asset, source: "MANUAL" })))
    (total-price (+ (get price dia-price) (get price pyth-price) (get price manual-price)))
    (source-count (+ 
      (if (> (get price dia-price) u0) u1 u0)
      (if (> (get price pyth-price) u0) u1 u0)
      (if (> (get price manual-price) u0) u1 u0)
    ))
  )
    (if (> source-count u0)
      (begin
        (map-set aggregated-prices asset {
          price: (/ total-price source-count),
          sources-count: source-count,
          last-update: block-height,
          confidence: (* source-count u33)
        })
        (ok true)
      )
      (ok false)
    )
  )
)
