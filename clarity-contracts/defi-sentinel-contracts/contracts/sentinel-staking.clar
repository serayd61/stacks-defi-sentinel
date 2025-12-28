;; Sentinel Staking Contract
;; Advanced staking with referral rewards and tiered bonuses

(define-constant CONTRACT_OWNER tx-sender)
(define-constant ERR_NOT_AUTHORIZED (err u100))
(define-constant ERR_INSUFFICIENT_BALANCE (err u101))
(define-constant ERR_NO_STAKE (err u102))
(define-constant ERR_STAKE_LOCKED (err u103))
(define-constant ERR_INVALID_REFERRER (err u104))
(define-constant ERR_SELF_REFERRAL (err u105))
(define-constant ERR_ALREADY_STAKING (err u106))

;; Token reference
(define-constant SENTINEL_TOKEN 'SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB.sentinel-token)

;; Staking tiers (in SNTL tokens - 6 decimals)
(define-constant TIER_BRONZE u0)           ;; 0+ SNTL
(define-constant TIER_SILVER u10000000000) ;; 10,000 SNTL
(define-constant TIER_GOLD u50000000000)   ;; 50,000 SNTL
(define-constant TIER_PLATINUM u100000000000) ;; 100,000 SNTL

;; APY rates (basis points - 10000 = 100%)
(define-constant APY_BRONZE u800)    ;; 8% APY
(define-constant APY_SILVER u1000)   ;; 10% APY
(define-constant APY_GOLD u1200)     ;; 12% APY
(define-constant APY_PLATINUM u1500) ;; 15% APY

;; Referral rewards (basis points)
(define-constant REFERRAL_REWARD_RATE u500) ;; 5% of staking rewards go to referrer

;; Lock periods (in blocks, ~10 min per block)
(define-constant MIN_LOCK_PERIOD u4320)   ;; ~30 days
(define-constant BONUS_LOCK_PERIOD u12960) ;; ~90 days (25% bonus)
(define-constant MAX_LOCK_PERIOD u25920)  ;; ~180 days (50% bonus)

;; Data structures
(define-map stakes 
  { staker: principal }
  {
    amount: uint,
    start-block: uint,
    lock-period: uint,
    last-claim-block: uint,
    referrer: (optional principal),
    tier: uint
  }
)

(define-map referral-earnings
  { referrer: principal }
  {
    total-earned: uint,
    referral-count: uint,
    pending: uint
  }
)

(define-map total-staked-by-tier
  { tier: uint }
  { amount: uint }
)

;; Data variables
(define-data-var total-staked uint u0)
(define-data-var total-stakers uint u0)
(define-data-var total-rewards-distributed uint u0)
(define-data-var contract-paused bool false)

;; Read-only functions

(define-read-only (get-stake (staker principal))
  (map-get? stakes { staker: staker })
)

(define-read-only (get-total-staked)
  (var-get total-staked)
)

(define-read-only (get-total-stakers)
  (var-get total-stakers)
)

(define-read-only (get-referral-stats (referrer principal))
  (default-to 
    { total-earned: u0, referral-count: u0, pending: u0 }
    (map-get? referral-earnings { referrer: referrer })
  )
)

(define-read-only (calculate-tier (amount uint))
  (if (>= amount TIER_PLATINUM)
    u3  ;; Platinum
    (if (>= amount TIER_GOLD)
      u2  ;; Gold
      (if (>= amount TIER_SILVER)
        u1  ;; Silver
        u0  ;; Bronze
      )
    )
  )
)

(define-read-only (get-tier-apy (tier uint))
  (if (is-eq tier u3)
    APY_PLATINUM
    (if (is-eq tier u2)
      APY_GOLD
      (if (is-eq tier u1)
        APY_SILVER
        APY_BRONZE
      )
    )
  )
)

(define-read-only (get-lock-bonus (lock-period uint))
  (if (>= lock-period MAX_LOCK_PERIOD)
    u5000  ;; 50% bonus
    (if (>= lock-period BONUS_LOCK_PERIOD)
      u2500  ;; 25% bonus
      u0     ;; No bonus
    )
  )
)

(define-read-only (calculate-pending-rewards (staker principal))
  (match (get-stake staker)
    stake-info
    (let (
      (blocks-staked (- stacks-block-height (get last-claim-block stake-info)))
      (base-apy (get-tier-apy (get tier stake-info)))
      (lock-bonus (get-lock-bonus (get lock-period stake-info)))
      (effective-apy (+ base-apy (/ (* base-apy lock-bonus) u10000)))
      (yearly-reward (/ (* (get amount stake-info) effective-apy) u10000))
      ;; Approximate blocks per year: 52,560 (assuming 10 min blocks)
      (reward (/ (* yearly-reward blocks-staked) u52560))
    )
    reward
    )
    u0
  )
)

(define-read-only (is-stake-unlocked (staker principal))
  (match (get-stake staker)
    stake-info
    (>= stacks-block-height (+ (get start-block stake-info) (get lock-period stake-info)))
    false
  )
)

;; Public functions

(define-public (stake (amount uint) (lock-period uint) (referrer (optional principal)))
  (let (
    (staker tx-sender)
    (tier (calculate-tier amount))
  )
    ;; Validations
    (asserts! (not (var-get contract-paused)) ERR_NOT_AUTHORIZED)
    (asserts! (> amount u0) ERR_INSUFFICIENT_BALANCE)
    (asserts! (>= lock-period MIN_LOCK_PERIOD) ERR_STAKE_LOCKED)
    (asserts! (is-none (get-stake staker)) ERR_ALREADY_STAKING)
    
    ;; Validate referrer
    (match referrer
      ref
      (begin
        (asserts! (not (is-eq ref staker)) ERR_SELF_REFERRAL)
        ;; Referrer must have staked before
        (asserts! (is-some (get-stake ref)) ERR_INVALID_REFERRER)
      )
      true
    )
    
    ;; Transfer tokens to contract
    ;; (try! (contract-call? SENTINEL_TOKEN transfer amount staker (as-contract tx-sender) none))
    
    ;; Create stake
    (map-set stakes
      { staker: staker }
      {
        amount: amount,
        start-block: stacks-block-height,
        lock-period: lock-period,
        last-claim-block: stacks-block-height,
        referrer: referrer,
        tier: tier
      }
    )
    
    ;; Update referral stats
    (match referrer
      ref
      (let (
        (current-stats (get-referral-stats ref))
      )
        (map-set referral-earnings
          { referrer: ref }
          {
            total-earned: (get total-earned current-stats),
            referral-count: (+ (get referral-count current-stats) u1),
            pending: (get pending current-stats)
          }
        )
      )
      true
    )
    
    ;; Update totals
    (var-set total-staked (+ (var-get total-staked) amount))
    (var-set total-stakers (+ (var-get total-stakers) u1))
    
    (ok { 
      amount: amount, 
      tier: tier, 
      lock-period: lock-period,
      apy: (get-tier-apy tier)
    })
  )
)

(define-public (claim-rewards)
  (let (
    (staker tx-sender)
    (stake-data (unwrap! (get-stake staker) ERR_NO_STAKE))
    (rewards (calculate-pending-rewards staker))
    (referrer-reward (/ (* rewards REFERRAL_REWARD_RATE) u10000))
  )
    (asserts! (> rewards u0) ERR_INSUFFICIENT_BALANCE)
    
    ;; Update last claim block
    (map-set stakes
      { staker: staker }
      (merge stake-data { last-claim-block: stacks-block-height })
    )
    
    ;; Process referrer reward
    (match (get referrer stake-data)
      ref
      (let (
        (ref-stats (get-referral-stats ref))
      )
        (map-set referral-earnings
          { referrer: ref }
          {
            total-earned: (get total-earned ref-stats),
            referral-count: (get referral-count ref-stats),
            pending: (+ (get pending ref-stats) referrer-reward)
          }
        )
      )
      true
    )
    
    ;; Transfer rewards to staker
    ;; (try! (as-contract (contract-call? SENTINEL_TOKEN transfer (- rewards referrer-reward) (as-contract tx-sender) staker none)))
    
    (var-set total-rewards-distributed (+ (var-get total-rewards-distributed) rewards))
    
    (ok { rewards-claimed: rewards, referrer-share: referrer-reward })
  )
)

(define-public (unstake)
  (let (
    (staker tx-sender)
    (stake-data (unwrap! (get-stake staker) ERR_NO_STAKE))
  )
    ;; Check lock period
    (asserts! (is-stake-unlocked staker) ERR_STAKE_LOCKED)
    
    ;; Claim remaining rewards first
    (try! (claim-rewards))
    
    ;; Transfer staked tokens back
    ;; (try! (as-contract (contract-call? SENTINEL_TOKEN transfer (get amount stake-data) (as-contract tx-sender) staker none)))
    
    ;; Remove stake
    (map-delete stakes { staker: staker })
    
    ;; Update totals
    (var-set total-staked (- (var-get total-staked) (get amount stake-data)))
    (var-set total-stakers (- (var-get total-stakers) u1))
    
    (ok { amount-returned: (get amount stake-data) })
  )
)

(define-public (claim-referral-rewards)
  (let (
    (referrer tx-sender)
    (stats (get-referral-stats referrer))
    (pending (get pending stats))
  )
    (asserts! (> pending u0) ERR_INSUFFICIENT_BALANCE)
    
    ;; Update stats
    (map-set referral-earnings
      { referrer: referrer }
      {
        total-earned: (+ (get total-earned stats) pending),
        referral-count: (get referral-count stats),
        pending: u0
      }
    )
    
    ;; Transfer rewards
    ;; (try! (as-contract (contract-call? SENTINEL_TOKEN transfer pending (as-contract tx-sender) referrer none)))
    
    (ok { claimed: pending })
  )
)

(define-public (add-to-stake (additional-amount uint))
  (let (
    (staker tx-sender)
    (stake-data (unwrap! (get-stake staker) ERR_NO_STAKE))
    (new-amount (+ (get amount stake-data) additional-amount))
    (new-tier (calculate-tier new-amount))
  )
    (asserts! (> additional-amount u0) ERR_INSUFFICIENT_BALANCE)
    
    ;; Claim existing rewards first
    (try! (claim-rewards))
    
    ;; Transfer additional tokens
    ;; (try! (contract-call? SENTINEL_TOKEN transfer additional-amount staker (as-contract tx-sender) none))
    
    ;; Update stake
    (map-set stakes
      { staker: staker }
      (merge stake-data { 
        amount: new-amount,
        tier: new-tier
      })
    )
    
    ;; Update total
    (var-set total-staked (+ (var-get total-staked) additional-amount))
    
    (ok { new-total: new-amount, new-tier: new-tier })
  )
)

;; Admin functions

(define-public (pause-contract)
  (begin
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_NOT_AUTHORIZED)
    (var-set contract-paused true)
    (ok true)
  )
)

(define-public (resume-contract)
  (begin
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_NOT_AUTHORIZED)
    (var-set contract-paused false)
    (ok true)
  )
)

