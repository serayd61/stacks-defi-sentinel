;; Simple Token Sale Contract
;; Direct purchase of SNTL tokens with STX

(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-sale-not-active (err u101))
(define-constant err-insufficient-funds (err u102))

;; Sale state
(define-data-var sale-active bool false)
(define-data-var price-per-token uint u100000) ;; 0.1 STX per 1000 SNTL
(define-data-var total-sold uint u0)
(define-data-var stx-collected uint u0)

;; Start sale
(define-public (start-sale)
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (var-set sale-active true)
    (ok true)))

;; Stop sale
(define-public (stop-sale)
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (var-set sale-active false)
    (ok true)))

;; Purchase tokens - STX in, get SNTL tokens minted
(define-public (purchase (stx-amount uint))
  (let (
    (tokens-to-mint (* (/ stx-amount (var-get price-per-token)) u1000000000)) ;; 1000 SNTL per price unit
  )
    (asserts! (var-get sale-active) err-sale-not-active)
    (asserts! (> stx-amount u0) err-insufficient-funds)
    
    ;; Transfer STX to contract
    (try! (stx-transfer? stx-amount tx-sender (as-contract tx-sender)))
    
    ;; Mint tokens to buyer
    (try! (contract-call? 'SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.sentinel-token mint tokens-to-mint tx-sender))
    
    ;; Update stats
    (var-set total-sold (+ (var-get total-sold) tokens-to-mint))
    (var-set stx-collected (+ (var-get stx-collected) stx-amount))
    
    (ok {tokens: tokens-to-mint, stx-spent: stx-amount})))

;; Get sale info
(define-read-only (get-info)
  {
    active: (var-get sale-active),
    price: (var-get price-per-token),
    sold: (var-get total-sold),
    collected: (var-get stx-collected)
  })

;; Withdraw STX
(define-public (withdraw (amount uint) (to principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (try! (as-contract (stx-transfer? amount (as-contract tx-sender) to)))
    (ok true)))

