;; Yield Tracker Contract
;; Tracks APY, APR and yield metrics across Stacks DeFi protocols
;; Monitors yield sustainability and detects anomalous APY spikes

(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u600))
(define-constant err-not-authorized (err u601))
(define-constant err-not-found (err u602))
(define-constant err-invalid-yield (err u603))

;; Max sane APY: 10000% in basis points
(define-constant MAX-APY-BPS u1000000)

(define-data-var yield-record-count uint u0)
(define-data-var protocol-count uint u0)

(define-map authorized-reporters principal bool)

;; Protocol yield profiles
(define-map yield-profiles principal
  {
    protocol-name: (string-ascii 50),
    protocol-type: (string-ascii 20),
    current-apy-bps: uint,
    current-apr-bps: uint,
    tvl-micro-stx: uint,
    last-update: uint,
    reporter: principal,
    sustainable: bool,
    risk-flag: bool
  }
)

;; Yield history
(define-map yield-history
  { protocol: principal, record-id: uint }
  {
    apy-bps: uint,
    apr-bps: uint,
    tvl: uint,
    block-height: uint,
    reporter: principal
  }
)

(define-map protocol-record-count principal uint)

;; Yield anomalies
(define-map yield-anomalies uint
  {
    protocol: principal,
    anomaly-type: (string-ascii 30),
    old-apy-bps: uint,
    new-apy-bps: uint,
    change-bps: uint,
    block-height: uint,
    investigated: bool
  }
)

(define-data-var anomaly-count uint u0)

;; Read-only
(define-read-only (get-yield-profile (protocol principal))
  (map-get? yield-profiles protocol)
)

(define-read-only (get-yield-history (protocol principal) (record-id uint))
  (map-get? yield-history { protocol: protocol, record-id: record-id })
)

(define-read-only (get-anomaly (anomaly-id uint))
  (map-get? yield-anomalies anomaly-id)
)

(define-read-only (is-reporter (reporter principal))
  (default-to false (map-get? authorized-reporters reporter))
)

(define-read-only (calculate-daily-yield (apy-bps uint))
  ;; Daily yield = APY / 365
  (/ apy-bps u365)
)

;; Public functions
(define-public (add-reporter (reporter principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (map-set authorized-reporters reporter true)
    (ok reporter)
  )
)

(define-public (register-protocol
    (protocol principal)
    (name (string-ascii 50))
    (protocol-type (string-ascii 20))
    (initial-apy-bps uint)
    (initial-tvl uint))
  (begin
    (asserts! (is-reporter tx-sender) err-not-authorized)
    (asserts! (<= initial-apy-bps MAX-APY-BPS) err-invalid-yield)
    (map-set yield-profiles protocol {
      protocol-name: name,
      protocol-type: protocol-type,
      current-apy-bps: initial-apy-bps,
      current-apr-bps: initial-apy-bps,
      tvl-micro-stx: initial-tvl,
      last-update: stacks-block-height,
      reporter: tx-sender,
      sustainable: (< initial-apy-bps u50000),
      risk-flag: (> initial-apy-bps u100000)
    })
    (var-set protocol-count (+ (var-get protocol-count) u1))
    (ok { protocol: protocol, name: name, apy-bps: initial-apy-bps })
  )
)

(define-public (update-yield
    (protocol principal)
    (new-apy-bps uint)
    (new-tvl uint))
  (match (map-get? yield-profiles protocol)
    profile
    (let (
      (record-id (default-to u0 (map-get? protocol-record-count protocol)))
      (old-apy (get current-apy-bps profile))
      (change (if (> new-apy-bps old-apy)
        (- new-apy-bps old-apy)
        (- old-apy new-apy-bps)))
    )
      (asserts! (is-reporter tx-sender) err-not-authorized)
      (asserts! (<= new-apy-bps MAX-APY-BPS) err-invalid-yield)

      (map-set yield-profiles protocol (merge profile {
        current-apy-bps: new-apy-bps,
        tvl-micro-stx: new-tvl,
        last-update: stacks-block-height,
        sustainable: (< new-apy-bps u50000),
        risk-flag: (> new-apy-bps u100000)
      }))

      (map-set yield-history
        { protocol: protocol, record-id: record-id }
        { apy-bps: new-apy-bps, apr-bps: new-apy-bps, tvl: new-tvl,
          block-height: stacks-block-height, reporter: tx-sender }
      )

      (map-set protocol-record-count protocol (+ record-id u1))
      (var-set yield-record-count (+ (var-get yield-record-count) u1))

      ;; Detect anomaly (>50% APY change)
      (if (> (/ (* change u10000) (if (> old-apy u0) old-apy u1)) u5000)
        (let ((anomaly-id (var-get anomaly-count)))
          (map-set yield-anomalies anomaly-id {
            protocol: protocol,
            anomaly-type: "apy-spike",
            old-apy-bps: old-apy,
            new-apy-bps: new-apy-bps,
            change-bps: change,
            block-height: stacks-block-height,
            investigated: false
          })
          (var-set anomaly-count (+ anomaly-id u1))
          (ok { updated: true, anomaly-detected: true })
        )
        (ok { updated: true, anomaly-detected: false })
      )
    )
    err-not-found
  )
)

(define-public (mark-investigated (anomaly-id uint))
  (match (map-get? yield-anomalies anomaly-id)
    anomaly
    (begin
      (asserts! (is-reporter tx-sender) err-not-authorized)
      (map-set yield-anomalies anomaly-id (merge anomaly { investigated: true }))
      (ok anomaly-id)
    )
    err-not-found
  )
)
