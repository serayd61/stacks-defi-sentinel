;; Token Sale Contract V8 - SNTL Token Sale
;; NO as-contract usage - funds go to treasury address

;; Constants
(define-constant contract-owner tx-sender)
(define-constant treasury 'SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB)
(define-constant err-owner-only (err u100))
(define-constant err-sale-not-active (err u101))
(define-constant err-sale-ended (err u102))
(define-constant err-insufficient-funds (err u103))
(define-constant err-invalid-amount (err u104))
(define-constant err-max-purchase-exceeded (err u105))
(define-constant err-sale-paused (err u106))

;; Sale Configuration
(define-data-var sale-active bool false)
(define-data-var sale-paused bool false)
(define-data-var sale-start-block uint u0)
(define-data-var sale-end-block uint u0)
(define-data-var total-sale-amount uint u50000000000000) ;; 50M SNTL for sale
(define-data-var sold-amount uint u0)
(define-data-var stx-collected uint u0)

;; Sale Tiers
(define-data-var tier1-price uint u100000) ;; 0.1 STX per 1000 SNTL
(define-data-var tier1-amount uint u10000000000000) ;; 10M SNTL
(define-data-var tier1-sold uint u0)

(define-data-var tier2-price uint u120000) ;; 0.12 STX per 1000 SNTL
(define-data-var tier2-amount uint u20000000000000) ;; 20M SNTL
(define-data-var tier2-sold uint u0)

(define-data-var tier3-price uint u150000) ;; 0.15 STX per 1000 SNTL
(define-data-var tier3-amount uint u20000000000000) ;; 20M SNTL
(define-data-var tier3-sold uint u0)

;; Purchase limits
(define-data-var min-purchase-stx uint u1000000) ;; 1 STX minimum
(define-data-var max-purchase-stx uint u100000000) ;; 100 STX maximum per tx
(define-data-var max-purchase-per-address uint u1000000000) ;; 1000 STX max per address

;; Purchase tracking
(define-map purchases principal uint)
(define-map tokens-purchased principal uint)
(define-map tokens-claimed principal uint)

;; ==========================================
;; PRO MEMBERSHIP TIERS
;; ==========================================
(define-data-var pro-threshold uint u10000000000) ;; 10,000 SNTL for Pro
(define-data-var vip-threshold uint u50000000000) ;; 50,000 SNTL for VIP
(define-data-var whale-threshold uint u100000000000) ;; 100,000 SNTL for Whale

(define-read-only (get-user-tier (user principal))
  (let ((purchased (default-to u0 (map-get? tokens-purchased user))))
    (if (>= purchased (var-get whale-threshold))
      { tier: u3, name: "whale", purchased: purchased }
      (if (>= purchased (var-get vip-threshold))
        { tier: u2, name: "vip", purchased: purchased }
        (if (>= purchased (var-get pro-threshold))
          { tier: u1, name: "pro", purchased: purchased }
          { tier: u0, name: "basic", purchased: purchased })))))

(define-read-only (is-pro-member (user principal))
  (>= (default-to u0 (map-get? tokens-purchased user)) (var-get pro-threshold)))

;; ==========================================
;; SALE MANAGEMENT (Owner only)
;; ==========================================

(define-public (initialize-sale (start-block uint) (end-block uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (asserts! (> end-block start-block) (err u200))
    (var-set sale-start-block start-block)
    (var-set sale-end-block end-block)
    (var-set sale-active true)
    (var-set sale-paused false)
    (ok { start: start-block, end: end-block })))

(define-public (extend-sale (new-end-block uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (asserts! (> new-end-block stacks-block-height) (err u800))
    (var-set sale-end-block new-end-block)
    (var-set sale-active true)
    (var-set sale-paused false)
    (ok { new-end-block: new-end-block })))

(define-public (set-sale-paused (paused bool))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (var-set sale-paused paused)
    (ok paused)))

;; ==========================================
;; TOKEN PURCHASE
;; ==========================================

(define-read-only (get-current-tier-price)
  (let ((tier1-remaining (- (var-get tier1-amount) (var-get tier1-sold)))
        (tier2-remaining (- (var-get tier2-amount) (var-get tier2-sold))))
    (if (> tier1-remaining u0)
      (ok { tier: u1, price: (var-get tier1-price), remaining: tier1-remaining })
      (if (> tier2-remaining u0)
        (ok { tier: u2, price: (var-get tier2-price), remaining: tier2-remaining })
        (ok { tier: u3, price: (var-get tier3-price), remaining: (- (var-get tier3-amount) (var-get tier3-sold)) })))))

;; Purchase SNTL tokens with STX (funds go to treasury, tokens recorded)
(define-public (purchase-tokens (amount uint))
  (let ((buyer tx-sender)
        (current-block stacks-block-height))
    ;; Check sale is active
    (asserts! (var-get sale-active) err-sale-not-active)
    (asserts! (not (var-get sale-paused)) err-sale-paused)
    (asserts! (>= current-block (var-get sale-start-block)) err-sale-not-active)
    (asserts! (<= current-block (var-get sale-end-block)) err-sale-ended)
    (asserts! (>= amount (var-get min-purchase-stx)) err-insufficient-funds)
    (asserts! (<= amount (var-get max-purchase-stx)) err-max-purchase-exceeded)
    
    (let ((tier-info (unwrap! (get-current-tier-price) (err u400)))
          (tier-price (get price tier-info))
          (tier-remaining (get remaining tier-info))
          (tier-num (get tier tier-info))
          (tokens-received (/ (* amount u1000000) tier-price))
          (tokens-adjusted (/ tokens-received u1000))
          (user-total-spent (default-to u0 (map-get? purchases buyer))))
      
      ;; Validate
      (asserts! (>= tier-remaining tokens-adjusted) (err u500))
      (asserts! (<= (+ user-total-spent amount) (var-get max-purchase-per-address)) err-max-purchase-exceeded)
      
      ;; Transfer STX to treasury (NOT as-contract!)
      (try! (stx-transfer? amount buyer treasury))
      
      ;; Update sale stats
      (var-set sold-amount (+ (var-get sold-amount) tokens-adjusted))
      (var-set stx-collected (+ (var-get stx-collected) amount))
      
      ;; Update tier sold
      (if (is-eq tier-num u1)
        (var-set tier1-sold (+ (var-get tier1-sold) tokens-adjusted))
        (if (is-eq tier-num u2)
          (var-set tier2-sold (+ (var-get tier2-sold) tokens-adjusted))
          (var-set tier3-sold (+ (var-get tier3-sold) tokens-adjusted))))
      
      ;; Track purchase (tokens to be claimed later by owner sending)
      (map-set purchases buyer (+ user-total-spent amount))
      (map-set tokens-purchased buyer (+ (default-to u0 (map-get? tokens-purchased buyer)) tokens-adjusted))
      
      (ok { purchased: tokens-adjusted, stx-spent: amount, tier: tier-num, price: tier-price }))))

;; ==========================================
;; READ-ONLY FUNCTIONS
;; ==========================================

(define-read-only (get-sale-info)
  { active: (var-get sale-active),
    paused: (var-get sale-paused),
    start-block: (var-get sale-start-block),
    end-block: (var-get sale-end-block),
    total-amount: (var-get total-sale-amount),
    sold: (var-get sold-amount),
    remaining: (- (var-get total-sale-amount) (var-get sold-amount)),
    stx-collected: (var-get stx-collected),
    current-block: stacks-block-height })

(define-read-only (get-user-purchase (user principal))
  { stx-spent: (default-to u0 (map-get? purchases user)),
    tokens-purchased: (default-to u0 (map-get? tokens-purchased user)),
    tokens-claimed: (default-to u0 (map-get? tokens-claimed user)) })

(define-read-only (get-tier-thresholds)
  { pro: (var-get pro-threshold),
    vip: (var-get vip-threshold),
    whale: (var-get whale-threshold) })

;; Mark tokens as claimed (owner updates after manual distribution)
(define-public (mark-claimed (user principal) (amount uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (map-set tokens-claimed user (+ (default-to u0 (map-get? tokens-claimed user)) amount))
    (ok true)))

