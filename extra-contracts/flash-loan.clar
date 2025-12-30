;; Flash Loan Contract
;; Stacks Builder Challenge - Week 3
;; Uncollateralized loans that must be repaid in same transaction

(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-insufficient-liquidity (err u101))
(define-constant err-loan-not-repaid (err u102))
(define-constant err-zero-amount (err u103))
(define-constant err-invalid-callback (err u104))

;; Configuration
(define-data-var flash-fee uint u9) ;; 0.09% fee (9 basis points)
(define-data-var total-liquidity uint u0)
(define-data-var total-fees-earned uint u0)
(define-data-var loan-active bool false)
(define-data-var active-loan-amount uint u0)

;; Liquidity provider balances
(define-map lp-balances principal uint)

;; Loan history
(define-map loan-history uint {
  borrower: principal,
  amount: uint,
  fee: uint,
  block: uint,
  repaid: bool
})
(define-data-var loan-nonce uint u0)

;; Read-only functions
(define-read-only (get-available-liquidity)
  (stx-get-balance (as-contract tx-sender)))

(define-read-only (get-flash-fee)
  (var-get flash-fee))

(define-read-only (calculate-fee (amount uint))
  (/ (* amount (var-get flash-fee)) u10000))

(define-read-only (get-lp-balance (account principal))
  (default-to u0 (map-get? lp-balances account)))

(define-read-only (get-total-fees-earned)
  (var-get total-fees-earned))

(define-read-only (get-loan-info (loan-id uint))
  (map-get? loan-history loan-id))

(define-read-only (is-loan-active)
  (var-get loan-active))

;; Deposit liquidity
(define-public (deposit (amount uint))
  (begin
    (asserts! (> amount u0) err-zero-amount)
    (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
    (var-set total-liquidity (+ (var-get total-liquidity) amount))
    (map-set lp-balances tx-sender (+ (get-lp-balance tx-sender) amount))
    (ok true)))

;; Withdraw liquidity
(define-public (withdraw (amount uint))
  (let ((balance (get-lp-balance tx-sender)))
    (asserts! (>= balance amount) err-insufficient-liquidity)
    (asserts! (not (var-get loan-active)) err-loan-not-repaid)
    (try! (as-contract (stx-transfer? amount tx-sender contract-owner)))
    (var-set total-liquidity (- (var-get total-liquidity) amount))
    (map-set lp-balances tx-sender (- balance amount))
    (ok true)))

;; Initiate flash loan
(define-public (flash-loan (amount uint))
  (let (
    (fee (calculate-fee amount))
    (loan-id (var-get loan-nonce))
    (available (get-available-liquidity))
  )
    (asserts! (> amount u0) err-zero-amount)
    (asserts! (>= available amount) err-insufficient-liquidity)
    (asserts! (not (var-get loan-active)) err-loan-not-repaid)
    
    ;; Set loan as active
    (var-set loan-active true)
    (var-set active-loan-amount (+ amount fee))
    
    ;; Transfer loan amount to borrower
    (try! (as-contract (stx-transfer? amount tx-sender contract-owner)))
    
    ;; Record loan
    (map-set loan-history loan-id {
      borrower: tx-sender,
      amount: amount,
      fee: fee,
      block: block-height,
      repaid: false
    })
    (var-set loan-nonce (+ loan-id u1))
    
    (ok {loan-id: loan-id, amount: amount, fee: fee, repay-amount: (+ amount fee)})))

;; Repay flash loan
(define-public (repay-flash-loan (loan-id uint))
  (let (
    (loan-info (unwrap! (get-loan-info loan-id) err-invalid-callback))
    (repay-amount (+ (get amount loan-info) (get fee loan-info)))
  )
    (asserts! (var-get loan-active) err-loan-not-repaid)
    (asserts! (is-eq tx-sender (get borrower loan-info)) err-invalid-callback)
    
    ;; Transfer repayment
    (try! (stx-transfer? repay-amount tx-sender (as-contract tx-sender)))
    
    ;; Update state
    (var-set loan-active false)
    (var-set active-loan-amount u0)
    (var-set total-fees-earned (+ (var-get total-fees-earned) (get fee loan-info)))
    
    ;; Update loan record
    (map-set loan-history loan-id (merge loan-info {repaid: true}))
    
    (ok true)))

;; Admin: Set flash fee
(define-public (set-flash-fee (new-fee uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (var-set flash-fee new-fee)
    (ok true)))

;; Emergency withdraw (owner only)
(define-public (emergency-withdraw)
  (let ((balance (get-available-liquidity)))
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (asserts! (not (var-get loan-active)) err-loan-not-repaid)
    (as-contract (stx-transfer? balance tx-sender contract-owner))))

