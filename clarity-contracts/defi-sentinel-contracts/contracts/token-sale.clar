;; Token Sale Contract - SNTL Token Sale & Distribution
;; Multiple sale mechanisms: ICO, DEX listing, Stake-to-Earn

;; Constants
(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-sale-not-active (err u101))
(define-constant err-sale-ended (err u102))
(define-constant err-insufficient-funds (err u103))
(define-constant err-invalid-amount (err u104))
(define-constant err-max-purchase-exceeded (err u105))
(define-constant err-sale-paused (err u106))

;; Sentinel Token Contract
(define-constant sentinel-token 'SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB.sentinel-token)

;; Sale Configuration
(define-data-var sale-active bool false)
(define-data-var sale-paused bool false)
(define-data-var sale-start-block uint u0)
(define-data-var sale-end-block uint u0)
(define-data-var total-sale-amount uint u50000000000000) ;; 50M SNTL for sale
(define-data-var sold-amount uint u0)
(define-data-var stx-collected uint u0)

;; Sale Tiers (different price tiers)
(define-data-var tier1-price uint u100000) ;; 0.1 STX per 1000 SNTL (early bird)
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
(define-data-var max-purchase-stx uint u100000000) ;; 100 STX maximum per address
(define-data-var max-purchase-per-address uint u100000000)

;; Purchase tracking
(define-map purchases principal uint) ;; Total STX spent per address
(define-map tokens-purchased principal uint) ;; SNTL tokens purchased

;; Stake-to-Earn Configuration
(define-data-var stake-reward-pool uint u0) ;; STX collected from sales
(define-data-var stake-reward-rate uint u1000) ;; 0.1% per 1000 blocks
(define-data-var stake-min-amount uint u1000000000) ;; 1000 SNTL minimum stake

;; Staking data
(define-map staked-amount principal uint)
(define-map stake-start-block principal uint)
(define-map total-rewards-earned principal uint)

;; ==========================================
;; PRO MEMBERSHIP TIERS
;; ==========================================
;; Tier thresholds (in SNTL micro-units, 6 decimals)
(define-data-var pro-threshold uint u10000000000) ;; 10,000 SNTL for Pro
(define-data-var vip-threshold uint u50000000000) ;; 50,000 SNTL for VIP
(define-data-var whale-threshold uint u100000000000) ;; 100,000 SNTL for Whale

;; Tier names: 0 = Basic, 1 = Pro, 2 = VIP, 3 = Whale
(define-read-only (get-user-tier (user principal))
  (let
    (
      (staked (default-to u0 (map-get? staked-amount user)))
    )
    (if (>= staked (var-get whale-threshold))
      { tier: u3, name: "whale", staked: staked, required: (var-get whale-threshold) }
      (if (>= staked (var-get vip-threshold))
        { tier: u2, name: "vip", staked: staked, required: (var-get vip-threshold) }
        (if (>= staked (var-get pro-threshold))
          { tier: u1, name: "pro", staked: staked, required: (var-get pro-threshold) }
          { tier: u0, name: "basic", staked: staked, required: (var-get pro-threshold) }
        )
      )
    )
  )
)

;; Check if user has Pro or higher access
(define-read-only (is-pro-member (user principal))
  (let
    (
      (staked (default-to u0 (map-get? staked-amount user)))
    )
    (>= staked (var-get pro-threshold))
  )
)

;; Check if user has VIP or higher access
(define-read-only (is-vip-member (user principal))
  (let
    (
      (staked (default-to u0 (map-get? staked-amount user)))
    )
    (>= staked (var-get vip-threshold))
  )
)

;; Check if user is a Whale
(define-read-only (is-whale-member (user principal))
  (let
    (
      (staked (default-to u0 (map-get? staked-amount user)))
    )
    (>= staked (var-get whale-threshold))
  )
)

;; Get all tier thresholds
(define-read-only (get-tier-thresholds)
  {
    pro: (var-get pro-threshold),
    vip: (var-get vip-threshold),
    whale: (var-get whale-threshold)
  }
)

;; Owner can update tier thresholds
(define-public (set-tier-thresholds (pro uint) (vip uint) (whale uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (asserts! (< pro vip) (err u700))
    (asserts! (< vip whale) (err u701))
    (var-set pro-threshold pro)
    (var-set vip-threshold vip)
    (var-set whale-threshold whale)
    (ok true)
  )
)

;; ==========================================
;; SALE MANAGEMENT (Owner only)
;; ==========================================

;; Initialize sale
(define-public (initialize-sale (start-block uint) (end-block uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (asserts! (is-eq (var-get sale-active) false) (err u200))
    (var-set sale-start-block start-block)
    (var-set sale-end-block end-block)
    (var-set sale-active true)
    (var-set sale-paused false)
    (ok {
      start: start-block,
      end: end-block,
      total-amount: (var-get total-sale-amount)
    })
  )
)

;; Pause/Resume sale
(define-public (set-sale-paused (paused bool))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (var-set sale-paused paused)
    (ok paused)
  )
)

;; Update sale prices
(define-public (set-tier-price (tier uint) (price uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (if (is-eq tier u1)
      (begin
        (var-set tier1-price price)
        (ok true)
      )
      (if (is-eq tier u2)
        (begin
          (var-set tier2-price price)
          (ok true)
        )
        (if (is-eq tier u3)
          (begin
            (var-set tier3-price price)
            (ok true)
          )
          (err u300)
        )
      )
    )
  )
)

;; ==========================================
;; TOKEN PURCHASE
;; ==========================================

;; Calculate which tier and price
(define-read-only (get-current-tier-price)
  (let
    (
      (tier1-remaining (- (var-get tier1-amount) (var-get tier1-sold)))
      (tier2-remaining (- (var-get tier2-amount) (var-get tier2-sold)))
    )
    (if (> tier1-remaining u0)
      (ok { tier: u1, price: (var-get tier1-price), remaining: tier1-remaining })
      (if (> tier2-remaining u0)
        (ok { tier: u2, price: (var-get tier2-price), remaining: tier2-remaining })
        (ok { tier: u3, price: (var-get tier3-price), remaining: (- (var-get tier3-amount) (var-get tier3-sold)) })
      )
    )
  )
)

;; Purchase SNTL tokens with STX
;; Amount parameter specifies how much STX to spend
(define-public (purchase-tokens (amount uint))
  (let
    (
      (buyer tx-sender)
      (current-block stacks-block-height)
      (min-required (var-get min-purchase-stx))
      (max-allowed (var-get max-purchase-stx))
    )
    ;; Check sale is active
    (asserts! (var-get sale-active) err-sale-not-active)
    (asserts! (is-eq (var-get sale-paused) false) err-sale-paused)
    (asserts! (>= current-block (var-get sale-start-block)) err-sale-not-active)
    (asserts! (<= current-block (var-get sale-end-block)) err-sale-ended)
    (asserts! (>= amount min-required) err-insufficient-funds)
    (asserts! (<= amount max-allowed) err-max-purchase-exceeded)
    
    ;; Validate user has enough STX
    (asserts! (>= (stx-get-balance buyer) amount) err-insufficient-funds)
    
    ;; Calculate how much STX user will spend
    (let
      (
        (stx-to-spend amount)
        (tier-info (unwrap! (get-current-tier-price) (err u400)))
        (tier-price (get price tier-info))
        (tier-remaining (get remaining tier-info))
        (tier-num (get tier tier-info))
        
        ;; Calculate tokens to receive
        (tokens-received (/ (* stx-to-spend u1000000) tier-price)) ;; price is per 1000 tokens
        (tokens-received-adjusted (/ tokens-received u1000))
        
        ;; Check purchase limits
        (user-total-spent (default-to u0 (map-get? purchases buyer)))
        (user-new-total (+ user-total-spent stx-to-spend))
      )
      
      ;; Validate purchase
      (asserts! (>= tier-remaining tokens-received-adjusted) (err u500))
      (asserts! (<= user-new-total (var-get max-purchase-per-address)) err-max-purchase-exceeded)
      
      ;; Transfer STX to contract
      (try! (stx-transfer? stx-to-spend buyer (as-contract tx-sender)))
      
      ;; Update sale stats
      (var-set sold-amount (+ (var-get sold-amount) tokens-received-adjusted))
      (var-set stx-collected (+ (var-get stx-collected) stx-to-spend))
      
      ;; Update tier sold amounts
      (if (is-eq tier-num u1)
        (var-set tier1-sold (+ (var-get tier1-sold) tokens-received-adjusted))
        (if (is-eq tier-num u2)
          (var-set tier2-sold (+ (var-get tier2-sold) tokens-received-adjusted))
          (var-set tier3-sold (+ (var-get tier3-sold) tokens-received-adjusted))
        )
      )
      
      ;; Update user purchase tracking
      (map-set purchases buyer user-new-total)
      (map-set tokens-purchased buyer (+ (default-to u0 (map-get? tokens-purchased buyer)) tokens-received-adjusted))
      
      ;; Transfer reward pool percentage to stake pool (50% of STX goes to rewards)
      (let
        (
          (reward-amount (/ stx-to-spend u2)) ;; 50% to rewards
        )
        (var-set stake-reward-pool (+ (var-get stake-reward-pool) reward-amount))
      )
      
      ;; Mint and transfer SNTL tokens to buyer
      (try! (contract-call? sentinel-token mint tokens-received-adjusted buyer))
      
      (ok {
        purchased: tokens-received-adjusted,
        stx-spent: stx-to-spend,
        tier: tier-num,
        price: tier-price
      })
    )
  )
)

;; ==========================================
;; STAKE-TO-EARN
;; ==========================================

;; Stake SNTL tokens to earn STX rewards
(define-public (stake-tokens (amount uint))
  (begin
    (asserts! (>= amount (var-get stake-min-amount)) err-invalid-amount)
    
    ;; Check user has tokens
    (let
      (
        (user-balance (unwrap! (contract-call? sentinel-token get-balance tx-sender) (err u600)))
      )
      (asserts! (>= user-balance amount) err-insufficient-funds)
      
      ;; Transfer tokens to contract
      (try! (contract-call? sentinel-token transfer amount tx-sender (as-contract tx-sender) none))
      
      ;; Update staking data
      (map-set staked-amount tx-sender (+ (default-to u0 (map-get? staked-amount tx-sender)) amount))
      (map-set stake-start-block tx-sender stacks-block-height)
      
      (ok {
        staked: amount,
        total-staked: (+ (default-to u0 (map-get? staked-amount tx-sender)) amount)
      })
    )
  )
)

;; Unstake tokens and claim rewards
(define-public (unstake-tokens (amount uint))
  (let
    (
      (staker tx-sender)
      (staked (default-to u0 (map-get? staked-amount staker)))
      (start-block (default-to stacks-block-height (map-get? stake-start-block staker)))
      (blocks-staked (- stacks-block-height start-block))
    )
    (asserts! (>= staked amount) err-insufficient-funds)
    (asserts! (> amount u0) err-invalid-amount)
    
    ;; Calculate STX rewards
    (let
      (
        (reward-rate (var-get stake-reward-rate))
        (reward-pool (var-get stake-reward-pool))
        (stake-portion (/ (* amount u1000000) staked)) ;; Percentage of total stake
        (blocks-reward (/ (* blocks-staked reward-rate) u1000000)) ;; Reward per block
        (stx-reward (/ (* stake-portion blocks-reward reward-pool) u1000000000000))
      )
      
      ;; Update staking
      (if (is-eq amount staked)
        (begin
          (map-delete staked-amount staker)
          (map-delete stake-start-block staker)
        )
        (begin
          (map-set staked-amount staker (- staked amount))
          (map-set stake-start-block staker stacks-block-height)
        )
      )
      
      ;; Transfer SNTL back
      (try! (as-contract (contract-call? sentinel-token transfer amount (as-contract tx-sender) staker none)))
      
      ;; Transfer STX rewards if available
      (if (and (> stx-reward u0) (>= reward-pool stx-reward))
        (begin
          (var-set stake-reward-pool (- reward-pool stx-reward))
          (map-set total-rewards-earned staker (+ (default-to u0 (map-get? total-rewards-earned staker)) stx-reward))
          (try! (as-contract (stx-transfer? stx-reward (as-contract tx-sender) staker)))
          (ok {
            unstaked: amount,
            reward: stx-reward,
            total-rewards: (+ (default-to u0 (map-get? total-rewards-earned staker)) stx-reward)
          })
        )
        (ok {
          unstaked: amount,
          reward: u0,
          total-rewards: (default-to u0 (map-get? total-rewards-earned staker))
        })
      )
    )
  )
)

;; Get staking info
(define-read-only (get-stake-info (user principal))
  (let
    (
      (staked (default-to u0 (map-get? staked-amount user)))
      (start-block (default-to stacks-block-height (map-get? stake-start-block user)))
      (blocks-staked (if (> staked u0) (- stacks-block-height start-block) u0))
      (total-rewards (default-to u0 (map-get? total-rewards-earned user)))
    )
    {
      staked: staked,
      start-block: start-block,
      blocks-staked: blocks-staked,
      total-rewards-earned: total-rewards,
      reward-pool: (var-get stake-reward-pool)
    }
  )
)

;; ==========================================
;; READ-ONLY FUNCTIONS
;; ==========================================

;; Get sale info
(define-read-only (get-sale-info)
  {
    active: (var-get sale-active),
    paused: (var-get sale-paused),
    start-block: (var-get sale-start-block),
    end-block: (var-get sale-end-block),
    total-amount: (var-get total-sale-amount),
    sold: (var-get sold-amount),
    remaining: (- (var-get total-sale-amount) (var-get sold-amount)),
    stx-collected: (var-get stx-collected),
    tier1: {
      price: (var-get tier1-price),
      total: (var-get tier1-amount),
      sold: (var-get tier1-sold),
      remaining: (- (var-get tier1-amount) (var-get tier1-sold))
    },
    tier2: {
      price: (var-get tier2-price),
      total: (var-get tier2-amount),
      sold: (var-get tier2-sold),
      remaining: (- (var-get tier2-amount) (var-get tier2-sold))
    },
    tier3: {
      price: (var-get tier3-price),
      total: (var-get tier3-amount),
      sold: (var-get tier3-sold),
      remaining: (- (var-get tier3-amount) (var-get tier3-sold))
    }
  }
)

;; Get user purchase info
(define-read-only (get-user-purchase (user principal))
  {
    stx-spent: (default-to u0 (map-get? purchases user)),
    tokens-purchased: (default-to u0 (map-get? tokens-purchased user))
  }
)

;; ==========================================
;; ADMIN FUNCTIONS
;; ==========================================

;; Withdraw STX (for liquidity pool)
(define-public (withdraw-stx (amount uint) (recipient principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (try! (as-contract (stx-transfer? amount (as-contract tx-sender) recipient)))
    (ok true)
  )
)

;; Add STX to reward pool
(define-public (add-reward-stx (amount uint))
  (begin
    (asserts! (>= (stx-get-balance tx-sender) amount) err-insufficient-funds)
    (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
    (var-set stake-reward-pool (+ (var-get stake-reward-pool) amount))
    (ok true)
  )
)

