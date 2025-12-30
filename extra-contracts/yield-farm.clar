;; Yield Farming Contract
;; Stacks Builder Challenge - Week 3
;; Stake LP tokens to earn farming rewards

(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-insufficient-balance (err u101))
(define-constant err-no-stake (err u102))
(define-constant err-zero-amount (err u103))
(define-constant err-farm-ended (err u104))
(define-constant err-farm-not-started (err u105))

;; Farm configuration
(define-data-var reward-per-block uint u1000) ;; microSTX per block
(define-data-var total-staked uint u0)
(define-data-var farm-start-block uint u0)
(define-data-var farm-end-block uint u0)
(define-data-var accumulated-reward-per-share uint u0)
(define-data-var last-reward-block uint u0)
(define-data-var precision-factor uint u1000000000000) ;; 1e12

;; User info
(define-map user-info principal {
  amount: uint,
  reward-debt: uint,
  pending-rewards: uint,
  last-deposit-block: uint
})

;; Read-only functions
(define-read-only (get-user-info (user principal))
  (default-to 
    {amount: u0, reward-debt: u0, pending-rewards: u0, last-deposit-block: u0}
    (map-get? user-info user)))

(define-read-only (get-total-staked)
  (var-get total-staked))

(define-read-only (get-reward-per-block)
  (var-get reward-per-block))

(define-read-only (get-farm-info)
  {
    start-block: (var-get farm-start-block),
    end-block: (var-get farm-end-block),
    reward-per-block: (var-get reward-per-block),
    total-staked: (var-get total-staked),
    acc-reward-per-share: (var-get accumulated-reward-per-share)
  })

;; Calculate pending rewards for user
(define-read-only (pending-reward (user principal))
  (let (
    (info (get-user-info user))
    (acc-per-share (var-get accumulated-reward-per-share))
    (user-amount (get amount info))
  )
    (if (is-eq user-amount u0)
      (get pending-rewards info)
      (+ 
        (get pending-rewards info)
        (- (/ (* user-amount acc-per-share) (var-get precision-factor)) (get reward-debt info))))))

;; Internal: Update pool
(define-private (update-pool)
  (let (
    (current-block block-height)
    (last-block (var-get last-reward-block))
    (total (var-get total-staked))
  )
    (if (or (<= current-block last-block) (is-eq total u0))
      true
      (let (
        (multiplier (- current-block last-block))
        (reward (* multiplier (var-get reward-per-block)))
        (new-acc (+ (var-get accumulated-reward-per-share) 
                    (/ (* reward (var-get precision-factor)) total)))
      )
        (var-set accumulated-reward-per-share new-acc)
        (var-set last-reward-block current-block)
        true))))

;; Deposit/Stake
(define-public (deposit (amount uint))
  (let (
    (info (get-user-info tx-sender))
    (current-amount (get amount info))
  )
    (asserts! (> amount u0) err-zero-amount)
    (asserts! (>= block-height (var-get farm-start-block)) err-farm-not-started)
    (asserts! (or (is-eq (var-get farm-end-block) u0) (< block-height (var-get farm-end-block))) err-farm-ended)
    
    ;; Update pool
    (update-pool)
    
    ;; Calculate pending if user has stake
    (let (
      (pending (if (> current-amount u0)
                   (- (/ (* current-amount (var-get accumulated-reward-per-share)) (var-get precision-factor))
                      (get reward-debt info))
                   u0))
      (new-amount (+ current-amount amount))
      (new-debt (/ (* new-amount (var-get accumulated-reward-per-share)) (var-get precision-factor)))
    )
      ;; Transfer tokens
      (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
      
      ;; Update user info
      (map-set user-info tx-sender {
        amount: new-amount,
        reward-debt: new-debt,
        pending-rewards: (+ (get pending-rewards info) pending),
        last-deposit-block: block-height
      })
      
      ;; Update total staked
      (var-set total-staked (+ (var-get total-staked) amount))
      
      (ok true))))

;; Withdraw/Unstake
(define-public (withdraw (amount uint))
  (let (
    (info (get-user-info tx-sender))
    (current-amount (get amount info))
  )
    (asserts! (> amount u0) err-zero-amount)
    (asserts! (>= current-amount amount) err-insufficient-balance)
    
    ;; Update pool
    (update-pool)
    
    ;; Calculate pending
    (let (
      (pending (- (/ (* current-amount (var-get accumulated-reward-per-share)) (var-get precision-factor))
                  (get reward-debt info)))
      (new-amount (- current-amount amount))
      (new-debt (/ (* new-amount (var-get accumulated-reward-per-share)) (var-get precision-factor)))
    )
      ;; Transfer tokens back
      (try! (as-contract (stx-transfer? amount tx-sender contract-owner)))
      
      ;; Update user info
      (map-set user-info tx-sender {
        amount: new-amount,
        reward-debt: new-debt,
        pending-rewards: (+ (get pending-rewards info) pending),
        last-deposit-block: (get last-deposit-block info)
      })
      
      ;; Update total staked
      (var-set total-staked (- (var-get total-staked) amount))
      
      (ok true))))

;; Harvest rewards
(define-public (harvest)
  (let (
    (info (get-user-info tx-sender))
    (current-amount (get amount info))
  )
    (asserts! (> current-amount u0) err-no-stake)
    
    ;; Update pool
    (update-pool)
    
    ;; Calculate pending
    (let (
      (pending (+ (get pending-rewards info)
                  (- (/ (* current-amount (var-get accumulated-reward-per-share)) (var-get precision-factor))
                     (get reward-debt info))))
      (new-debt (/ (* current-amount (var-get accumulated-reward-per-share)) (var-get precision-factor)))
    )
      ;; Transfer rewards
      (if (> pending u0)
        (try! (as-contract (stx-transfer? pending tx-sender contract-owner)))
        true)
      
      ;; Update user info
      (map-set user-info tx-sender {
        amount: current-amount,
        reward-debt: new-debt,
        pending-rewards: u0,
        last-deposit-block: (get last-deposit-block info)
      })
      
      (ok pending))))

;; Admin: Set reward per block
(define-public (set-reward-per-block (new-reward uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (update-pool)
    (var-set reward-per-block new-reward)
    (ok true)))

;; Admin: Set farm period
(define-public (set-farm-period (start-block uint) (end-block uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (var-set farm-start-block start-block)
    (var-set farm-end-block end-block)
    (var-set last-reward-block start-block)
    (ok true)))

;; Fund farm rewards
(define-public (fund-farm (amount uint))
  (stx-transfer? amount tx-sender (as-contract tx-sender)))

;; Get contract balance
(define-read-only (get-contract-balance)
  (stx-get-balance (as-contract tx-sender)))

