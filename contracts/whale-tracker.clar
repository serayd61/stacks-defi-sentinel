;; Whale Tracker Contract
;; Monitors large wallet movements on Stacks blockchain
;; Tracks whale accumulation, distribution, and position changes

(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u200))
(define-constant err-not-authorized (err u201))
(define-constant err-not-found (err u202))
(define-constant err-invalid-threshold (err u203))

;; Whale threshold: 100,000 STX
(define-constant DEFAULT-WHALE-THRESHOLD u100000000000)
(define-constant PRECISION u1000000)

(define-data-var whale-threshold uint DEFAULT-WHALE-THRESHOLD)
(define-data-var event-count uint u0)
(define-data-var tracked-wallets uint u0)

(define-map authorized-trackers principal bool)

;; Whale registry
(define-map whale-profiles principal
  {
    label: (string-ascii 50),
    first-seen: uint,
    last-active: uint,
    total-inflow: uint,
    total-outflow: uint,
    event-count: uint,
    risk-tag: (string-ascii 20),
    active: bool
  }
)

;; Movement events
(define-map whale-events uint
  {
    whale: principal,
    event-type: (string-ascii 20),
    amount: uint,
    token: (string-ascii 20),
    block-height: uint,
    reporter: principal,
    notes: (optional (string-ascii 150))
  }
)

;; Wallet->events index
(define-map wallet-event-count principal uint)

;; Read-only
(define-read-only (get-whale-profile (wallet principal))
  (map-get? whale-profiles wallet)
)

(define-read-only (get-whale-event (event-id uint))
  (map-get? whale-events event-id)
)

(define-read-only (get-whale-threshold)
  (var-get whale-threshold)
)

(define-read-only (is-whale (wallet principal))
  (is-some (map-get? whale-profiles wallet))
)

(define-read-only (get-event-count)
  (var-get event-count)
)

(define-read-only (is-tracker (tracker principal))
  (default-to false (map-get? authorized-trackers tracker))
)

;; Public functions
(define-public (add-tracker (tracker principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (map-set authorized-trackers tracker true)
    (ok tracker)
  )
)

(define-public (register-whale (wallet principal) (label (string-ascii 50)) (risk-tag (string-ascii 20)))
  (begin
    (asserts! (is-tracker tx-sender) err-not-authorized)
    (map-set whale-profiles wallet {
      label: label,
      first-seen: stacks-block-height,
      last-active: stacks-block-height,
      total-inflow: u0,
      total-outflow: u0,
      event-count: u0,
      risk-tag: risk-tag,
      active: true
    })
    (var-set tracked-wallets (+ (var-get tracked-wallets) u1))
    (ok { wallet: wallet, label: label })
  )
)

(define-public (record-movement
    (whale principal)
    (event-type (string-ascii 20))
    (amount uint)
    (token (string-ascii 20))
    (notes (optional (string-ascii 150))))
  (let (
    (event-id (var-get event-count))
  )
    (asserts! (is-tracker tx-sender) err-not-authorized)
    (asserts! (>= amount (var-get whale-threshold)) err-invalid-threshold)

    (map-set whale-events event-id {
      whale: whale,
      event-type: event-type,
      amount: amount,
      token: token,
      block-height: stacks-block-height,
      reporter: tx-sender,
      notes: notes
    })

    (match (map-get? whale-profiles whale)
      profile
      (map-set whale-profiles whale (merge profile {
        last-active: stacks-block-height,
        event-count: (+ (get event-count profile) u1),
        total-inflow: (if (is-eq event-type "buy")
          (+ (get total-inflow profile) amount)
          (get total-inflow profile)),
        total-outflow: (if (is-eq event-type "sell")
          (+ (get total-outflow profile) amount)
          (get total-outflow profile))
      }))
      false
    )

    (var-set event-count (+ event-id u1))
    (ok { event-id: event-id, whale: whale, amount: amount })
  )
)

(define-public (update-whale-threshold (new-threshold uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (asserts! (> new-threshold u0) err-invalid-threshold)
    (var-set whale-threshold new-threshold)
    (ok new-threshold)
  )
)

(define-public (deactivate-whale (wallet principal))
  (match (map-get? whale-profiles wallet)
    profile
    (begin
      (asserts! (is-tracker tx-sender) err-not-authorized)
      (map-set whale-profiles wallet (merge profile { active: false }))
      (ok wallet)
    )
    err-not-found
  )
)
