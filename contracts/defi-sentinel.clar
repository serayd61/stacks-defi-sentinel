;; DeFi Sentinel - Whale Alert Subscription Contract
;; A smart contract for managing DeFi monitoring subscriptions

;; Constants
(define-constant contract-owner tx-sender)
(define-constant err-not-authorized (err u401))
(define-constant err-already-subscribed (err u402))
(define-constant err-not-subscribed (err u403))
(define-constant err-insufficient-funds (err u404))

;; Data Variables
(define-data-var subscription-price uint u1000000) ;; 1 STX = 1,000,000 microSTX
(define-data-var total-subscribers uint u0)
(define-data-var total-revenue uint u0)

;; Data Maps
(define-map subscribers principal 
  {
    subscribed-at: uint,
    expires-at: uint,
    tier: (string-ascii 20)
  }
)

(define-map watchlist principal (list 20 principal))

(define-map alert-settings principal 
  {
    whale-alerts: bool,
    swap-alerts: bool,
    liquidity-alerts: bool,
    nft-alerts: bool,
    min-stx-amount: uint
  }
)

;; Read-only functions

(define-read-only (get-subscription-price)
  (var-get subscription-price)
)

(define-read-only (get-total-subscribers)
  (var-get total-subscribers)
)

(define-read-only (get-total-revenue)
  (var-get total-revenue)
)

(define-read-only (is-subscribed (user principal))
  (match (map-get? subscribers user)
    subscription (> (get expires-at subscription) block-height)
    false
  )
)

(define-read-only (get-subscription (user principal))
  (map-get? subscribers user)
)

(define-read-only (get-watchlist (user principal))
  (default-to (list) (map-get? watchlist user))
)

(define-read-only (get-alert-settings (user principal))
  (map-get? alert-settings user)
)

;; Public functions

;; Subscribe to DeFi Sentinel (30 days = ~4320 blocks)
(define-public (subscribe)
  (let 
    (
      (price (var-get subscription-price))
      (current-block block-height)
      (expiry (+ current-block u4320))
    )
    (asserts! (>= (stx-get-balance tx-sender) price) err-insufficient-funds)
    (try! (stx-transfer? price tx-sender contract-owner))
    (map-set subscribers tx-sender 
      {
        subscribed-at: current-block,
        expires-at: expiry,
        tier: "basic"
      }
    )
    (var-set total-subscribers (+ (var-get total-subscribers) u1))
    (var-set total-revenue (+ (var-get total-revenue) price))
    (ok {
      subscribed: true,
      expires-at: expiry,
      tier: "basic"
    })
  )
)

;; Subscribe to premium tier (90 days, 2.5 STX)
(define-public (subscribe-premium)
  (let 
    (
      (price u2500000) ;; 2.5 STX
      (current-block block-height)
      (expiry (+ current-block u12960)) ;; ~90 days
    )
    (asserts! (>= (stx-get-balance tx-sender) price) err-insufficient-funds)
    (try! (stx-transfer? price tx-sender contract-owner))
    (map-set subscribers tx-sender 
      {
        subscribed-at: current-block,
        expires-at: expiry,
        tier: "premium"
      }
    )
    (var-set total-subscribers (+ (var-get total-subscribers) u1))
    (var-set total-revenue (+ (var-get total-revenue) price))
    (ok {
      subscribed: true,
      expires-at: expiry,
      tier: "premium"
    })
  )
)

;; Set alert preferences
(define-public (set-alert-preferences 
    (whale-alerts bool) 
    (swap-alerts bool) 
    (liquidity-alerts bool)
    (nft-alerts bool)
    (min-stx-amount uint)
  )
  (begin
    (asserts! (is-subscribed tx-sender) err-not-subscribed)
    (map-set alert-settings tx-sender 
      {
        whale-alerts: whale-alerts,
        swap-alerts: swap-alerts,
        liquidity-alerts: liquidity-alerts,
        nft-alerts: nft-alerts,
        min-stx-amount: min-stx-amount
      }
    )
    (ok true)
  )
)

;; Add address to watchlist
(define-public (add-to-watchlist (address principal))
  (let 
    (
      (current-list (get-watchlist tx-sender))
    )
    (asserts! (is-subscribed tx-sender) err-not-subscribed)
    (map-set watchlist tx-sender (unwrap! (as-max-len? (append current-list address) u20) (err u500)))
    (ok true)
  )
)

;; Clear watchlist
(define-public (clear-watchlist)
  (begin
    (asserts! (is-subscribed tx-sender) err-not-subscribed)
    (map-delete watchlist tx-sender)
    (ok true)
  )
)

;; Admin functions

(define-public (set-subscription-price (new-price uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-not-authorized)
    (var-set subscription-price new-price)
    (ok true)
  )
)

;; Withdraw collected fees (owner only)
(define-public (withdraw-fees (amount uint) (recipient principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-not-authorized)
    (try! (as-contract (stx-transfer? amount tx-sender recipient)))
    (ok true)
  )
)
