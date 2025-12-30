;; Token Swap Contract
;; Stacks Builder Challenge - Week 3
;; Simple AMM-style token swap

(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-insufficient-balance (err u101))
(define-constant err-zero-amount (err u102))
(define-constant err-pool-empty (err u103))
(define-constant err-slippage-exceeded (err u104))

;; Pool reserves
(define-data-var stx-reserve uint u0)
(define-data-var token-reserve uint u0)
(define-data-var total-liquidity uint u0)
(define-data-var swap-fee uint u30) ;; 0.3% = 30 basis points

;; Liquidity provider balances
(define-map lp-balances principal uint)

;; Read-only functions
(define-read-only (get-reserves)
  {stx: (var-get stx-reserve), token: (var-get token-reserve)})

(define-read-only (get-lp-balance (account principal))
  (default-to u0 (map-get? lp-balances account)))

(define-read-only (get-total-liquidity)
  (var-get total-liquidity))

(define-read-only (get-swap-fee)
  (var-get swap-fee))

;; Calculate output amount using constant product formula
(define-read-only (get-swap-output (input-amount uint) (input-reserve uint) (output-reserve uint))
  (let (
    (input-with-fee (* input-amount (- u10000 (var-get swap-fee))))
    (numerator (* input-with-fee output-reserve))
    (denominator (+ (* input-reserve u10000) input-with-fee))
  )
  (/ numerator denominator)))

;; Get STX to Token quote
(define-read-only (get-stx-to-token-quote (stx-amount uint))
  (get-swap-output stx-amount (var-get stx-reserve) (var-get token-reserve)))

;; Get Token to STX quote
(define-read-only (get-token-to-stx-quote (token-amount uint))
  (get-swap-output token-amount (var-get token-reserve) (var-get stx-reserve)))

;; Add liquidity
(define-public (add-liquidity (stx-amount uint))
  (let (
    (current-stx (var-get stx-reserve))
    (current-token (var-get token-reserve))
    (current-liquidity (var-get total-liquidity))
    (lp-tokens (if (is-eq current-liquidity u0)
                   stx-amount
                   (/ (* stx-amount current-liquidity) current-stx)))
  )
    (asserts! (> stx-amount u0) err-zero-amount)
    (try! (stx-transfer? stx-amount tx-sender (as-contract tx-sender)))
    (var-set stx-reserve (+ current-stx stx-amount))
    (var-set token-reserve (+ current-token stx-amount)) ;; Simplified: 1:1 initial ratio
    (var-set total-liquidity (+ current-liquidity lp-tokens))
    (map-set lp-balances tx-sender (+ (get-lp-balance tx-sender) lp-tokens))
    (ok lp-tokens)))

;; Remove liquidity
(define-public (remove-liquidity (lp-amount uint))
  (let (
    (sender-balance (get-lp-balance tx-sender))
    (current-liquidity (var-get total-liquidity))
    (stx-amount (/ (* lp-amount (var-get stx-reserve)) current-liquidity))
    (token-amount (/ (* lp-amount (var-get token-reserve)) current-liquidity))
  )
    (asserts! (>= sender-balance lp-amount) err-insufficient-balance)
    (asserts! (> lp-amount u0) err-zero-amount)
    (try! (as-contract (stx-transfer? stx-amount tx-sender contract-owner)))
    (var-set stx-reserve (- (var-get stx-reserve) stx-amount))
    (var-set token-reserve (- (var-get token-reserve) token-amount))
    (var-set total-liquidity (- current-liquidity lp-amount))
    (map-set lp-balances tx-sender (- sender-balance lp-amount))
    (ok {stx: stx-amount, token: token-amount})))

;; Swap STX for tokens
(define-public (swap-stx-for-tokens (stx-amount uint) (min-tokens uint))
  (let (
    (tokens-out (get-stx-to-token-quote stx-amount))
  )
    (asserts! (> stx-amount u0) err-zero-amount)
    (asserts! (> (var-get token-reserve) u0) err-pool-empty)
    (asserts! (>= tokens-out min-tokens) err-slippage-exceeded)
    (try! (stx-transfer? stx-amount tx-sender (as-contract tx-sender)))
    (var-set stx-reserve (+ (var-get stx-reserve) stx-amount))
    (var-set token-reserve (- (var-get token-reserve) tokens-out))
    (ok tokens-out)))

;; Swap tokens for STX
(define-public (swap-tokens-for-stx (token-amount uint) (min-stx uint))
  (let (
    (stx-out (get-token-to-stx-quote token-amount))
  )
    (asserts! (> token-amount u0) err-zero-amount)
    (asserts! (> (var-get stx-reserve) u0) err-pool-empty)
    (asserts! (>= stx-out min-stx) err-slippage-exceeded)
    (try! (as-contract (stx-transfer? stx-out tx-sender contract-owner)))
    (var-set token-reserve (+ (var-get token-reserve) token-amount))
    (var-set stx-reserve (- (var-get stx-reserve) stx-out))
    (ok stx-out)))

;; Set swap fee (owner only)
(define-public (set-swap-fee (new-fee uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (var-set swap-fee new-fee)
    (ok true)))

