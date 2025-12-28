;; Sentinel Lending Protocol
;; Collateralized lending with STX - Borrow SNTL tokens
;; NO as-contract usage for mainnet compatibility

;; ==========================================
;; CONSTANTS
;; ==========================================
(define-constant contract-owner tx-sender)
(define-constant treasury 'SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB)

;; Error codes
(define-constant err-owner-only (err u100))
(define-constant err-insufficient-collateral (err u101))
(define-constant err-insufficient-balance (err u102))
(define-constant err-loan-not-found (err u103))
(define-constant err-loan-healthy (err u104))
(define-constant err-invalid-amount (err u105))
(define-constant err-protocol-paused (err u106))
(define-constant err-max-ltv-exceeded (err u107))
(define-constant err-already-has-loan (err u108))

;; ==========================================
;; PROTOCOL PARAMETERS
;; ==========================================
(define-data-var protocol-paused bool false)
(define-data-var min-collateral uint u1000000) ;; 1 STX minimum
(define-data-var max-ltv uint u7500) ;; 75% max loan-to-value (basis points)
(define-data-var liquidation-threshold uint u8500) ;; 85% liquidation threshold
(define-data-var liquidation-bonus uint u500) ;; 5% bonus for liquidators
(define-data-var interest-rate uint u1000) ;; 10% annual (basis points)
(define-data-var stx-price uint u1000000) ;; $1.00 in micro-units (oracle updates this)
(define-data-var sntl-price uint u100) ;; $0.0001 per SNTL

;; ==========================================
;; PROTOCOL STATS
;; ==========================================
(define-data-var total-collateral-locked uint u0)
(define-data-var total-borrowed uint u0)
(define-data-var total-loans uint u0)
(define-data-var total-liquidations uint u0)

;; ==========================================
;; LOAN DATA STRUCTURE
;; ==========================================
(define-map loans principal 
  {
    collateral-amount: uint,      ;; STX deposited
    borrowed-amount: uint,        ;; SNTL borrowed
    borrow-block: uint,           ;; When loan was taken
    last-interest-block: uint,    ;; Last interest calculation
    accrued-interest: uint        ;; Interest owed
  }
)

;; User stats
(define-map user-stats principal
  {
    total-borrowed: uint,
    total-repaid: uint,
    total-liquidated: uint,
    loan-count: uint
  }
)

;; ==========================================
;; READ-ONLY FUNCTIONS
;; ==========================================

;; Get protocol info
(define-read-only (get-protocol-info)
  {
    paused: (var-get protocol-paused),
    min-collateral: (var-get min-collateral),
    max-ltv: (var-get max-ltv),
    liquidation-threshold: (var-get liquidation-threshold),
    liquidation-bonus: (var-get liquidation-bonus),
    interest-rate: (var-get interest-rate),
    stx-price: (var-get stx-price),
    sntl-price: (var-get sntl-price),
    total-collateral: (var-get total-collateral-locked),
    total-borrowed: (var-get total-borrowed),
    total-loans: (var-get total-loans)
  }
)

;; Get user loan
(define-read-only (get-loan (user principal))
  (map-get? loans user)
)

;; Get user stats
(define-read-only (get-user-stats (user principal))
  (default-to 
    { total-borrowed: u0, total-repaid: u0, total-liquidated: u0, loan-count: u0 }
    (map-get? user-stats user)
  )
)

;; Calculate collateral value in USD (micro-units)
(define-read-only (get-collateral-value (collateral-stx uint))
  (/ (* collateral-stx (var-get stx-price)) u1000000)
)

;; Calculate max borrowable amount based on collateral
(define-read-only (get-max-borrow (collateral-stx uint))
  (let (
    (collateral-value (get-collateral-value collateral-stx))
    (max-borrow-value (/ (* collateral-value (var-get max-ltv)) u10000))
    (sntl-amount (/ (* max-borrow-value u1000000) (var-get sntl-price)))
  )
    sntl-amount
  )
)

;; Calculate health factor (10000 = 100% healthy, <10000 = at risk)
(define-read-only (get-health-factor (user principal))
  (match (map-get? loans user)
    loan
    (let (
      (collateral-value (get-collateral-value (get collateral-amount loan)))
      (borrow-value (/ (* (+ (get borrowed-amount loan) (get accrued-interest loan)) (var-get sntl-price)) u1000000))
    )
      (if (is-eq borrow-value u0)
        u99999 ;; No debt = max health
        (/ (* collateral-value u10000) borrow-value)
      )
    )
    u0 ;; No loan
  )
)

;; Check if loan is liquidatable
(define-read-only (is-liquidatable (user principal))
  (< (get-health-factor user) (var-get liquidation-threshold))
)

;; Calculate interest owed
(define-read-only (calculate-interest (user principal))
  (match (map-get? loans user)
    loan
    (let (
      (blocks-elapsed (- stacks-block-height (get last-interest-block loan)))
      (annual-interest (/ (* (get borrowed-amount loan) (var-get interest-rate)) u10000))
      ;; Approximate: 52560 blocks per year (10 min blocks)
      (interest-owed (/ (* annual-interest blocks-elapsed) u52560))
    )
      (+ (get accrued-interest loan) interest-owed)
    )
    u0
  )
)

;; ==========================================
;; PUBLIC FUNCTIONS - LENDING
;; ==========================================

;; Deposit collateral and borrow SNTL
(define-public (borrow (collateral-stx uint) (borrow-amount uint))
  (let (
    (borrower tx-sender)
    (max-borrow (get-max-borrow collateral-stx))
  )
    ;; Validations
    (asserts! (not (var-get protocol-paused)) err-protocol-paused)
    (asserts! (>= collateral-stx (var-get min-collateral)) err-insufficient-collateral)
    (asserts! (> borrow-amount u0) err-invalid-amount)
    (asserts! (<= borrow-amount max-borrow) err-max-ltv-exceeded)
    (asserts! (is-none (map-get? loans borrower)) err-already-has-loan)
    (asserts! (>= (stx-get-balance borrower) collateral-stx) err-insufficient-balance)
    
    ;; Transfer STX collateral to treasury
    (try! (stx-transfer? collateral-stx borrower treasury))
    
    ;; Create loan record
    (map-set loans borrower {
      collateral-amount: collateral-stx,
      borrowed-amount: borrow-amount,
      borrow-block: stacks-block-height,
      last-interest-block: stacks-block-height,
      accrued-interest: u0
    })
    
    ;; Update protocol stats
    (var-set total-collateral-locked (+ (var-get total-collateral-locked) collateral-stx))
    (var-set total-borrowed (+ (var-get total-borrowed) borrow-amount))
    (var-set total-loans (+ (var-get total-loans) u1))
    
    ;; Update user stats
    (map-set user-stats borrower 
      (merge (get-user-stats borrower) 
        { 
          total-borrowed: (+ (get total-borrowed (get-user-stats borrower)) borrow-amount),
          loan-count: (+ (get loan-count (get-user-stats borrower)) u1)
        }
      )
    )
    
    ;; Return success with loan details
    ;; NOTE: SNTL tokens will be sent by treasury manually (no as-contract)
    (ok {
      collateral: collateral-stx,
      borrowed: borrow-amount,
      max-ltv: (var-get max-ltv),
      health-factor: (get-health-factor borrower)
    })
  )
)

;; Add more collateral to existing loan
(define-public (add-collateral (amount uint))
  (let (
    (borrower tx-sender)
  )
    (asserts! (not (var-get protocol-paused)) err-protocol-paused)
    (asserts! (> amount u0) err-invalid-amount)
    
    (match (map-get? loans borrower)
      loan
      (begin
        (asserts! (>= (stx-get-balance borrower) amount) err-insufficient-balance)
        
        ;; Transfer additional collateral
        (try! (stx-transfer? amount borrower treasury))
        
        ;; Update loan
        (map-set loans borrower 
          (merge loan { collateral-amount: (+ (get collateral-amount loan) amount) })
        )
        
        ;; Update stats
        (var-set total-collateral-locked (+ (var-get total-collateral-locked) amount))
        
        (ok { 
          new-collateral: (+ (get collateral-amount loan) amount),
          health-factor: (get-health-factor borrower)
        })
      )
      err-loan-not-found
    )
  )
)

;; Repay loan (partial or full)
;; NOTE: User sends SNTL to treasury, then calls this to record repayment
(define-public (record-repayment (repay-amount uint))
  (let (
    (borrower tx-sender)
  )
    (asserts! (> repay-amount u0) err-invalid-amount)
    
    (match (map-get? loans borrower)
      loan
      (let (
        (total-owed (+ (get borrowed-amount loan) (calculate-interest borrower)))
        (actual-repay (if (> repay-amount total-owed) total-owed repay-amount))
        (remaining (- total-owed actual-repay))
      )
        ;; Update or delete loan
        (if (<= remaining u0)
          ;; Full repayment - return collateral info
          (begin
            (map-delete loans borrower)
            (var-set total-collateral-locked (- (var-get total-collateral-locked) (get collateral-amount loan)))
            (var-set total-borrowed (- (var-get total-borrowed) (get borrowed-amount loan)))
            
            ;; Update user stats
            (map-set user-stats borrower 
              (merge (get-user-stats borrower) 
                { total-repaid: (+ (get total-repaid (get-user-stats borrower)) actual-repay) }
              )
            )
            
            ;; NOTE: Treasury should send back collateral manually
            (ok { 
              repaid: actual-repay, 
              remaining: u0, 
              collateral-to-return: (get collateral-amount loan),
              loan-closed: true
            })
          )
          ;; Partial repayment
          (begin
            (map-set loans borrower 
              (merge loan { 
                borrowed-amount: remaining,
                accrued-interest: u0,
                last-interest-block: stacks-block-height
              })
            )
            
            (var-set total-borrowed (- (var-get total-borrowed) actual-repay))
            
            (map-set user-stats borrower 
              (merge (get-user-stats borrower) 
                { total-repaid: (+ (get total-repaid (get-user-stats borrower)) actual-repay) }
              )
            )
            
            (ok { 
              repaid: actual-repay, 
              remaining: remaining, 
              collateral-to-return: u0,
              loan-closed: false
            })
          )
        )
      )
      err-loan-not-found
    )
  )
)

;; ==========================================
;; LIQUIDATION
;; ==========================================

;; Liquidate unhealthy position
;; Liquidator pays debt, receives collateral + bonus
(define-public (liquidate (borrower principal))
  (let (
    (liquidator tx-sender)
  )
    (asserts! (not (var-get protocol-paused)) err-protocol-paused)
    (asserts! (is-liquidatable borrower) err-loan-healthy)
    
    (match (map-get? loans borrower)
      loan
      (let (
        (collateral (get collateral-amount loan))
        (debt (+ (get borrowed-amount loan) (calculate-interest borrower)))
        (bonus-amount (/ (* collateral (var-get liquidation-bonus)) u10000))
        (total-collateral-reward (+ collateral bonus-amount))
      )
        ;; Delete the loan
        (map-delete loans borrower)
        
        ;; Update protocol stats
        (var-set total-collateral-locked (- (var-get total-collateral-locked) collateral))
        (var-set total-borrowed (- (var-get total-borrowed) (get borrowed-amount loan)))
        (var-set total-liquidations (+ (var-get total-liquidations) u1))
        
        ;; Update borrower stats
        (map-set user-stats borrower 
          (merge (get-user-stats borrower) 
            { total-liquidated: (+ (get total-liquidated (get-user-stats borrower)) collateral) }
          )
        )
        
        ;; NOTE: 
        ;; 1. Liquidator should send debt amount (SNTL) to treasury
        ;; 2. Treasury should send collateral + bonus to liquidator
        (ok {
          liquidated-user: borrower,
          debt-covered: debt,
          collateral-seized: collateral,
          bonus-earned: bonus-amount,
          total-reward: total-collateral-reward
        })
      )
      err-loan-not-found
    )
  )
)

;; ==========================================
;; ADMIN FUNCTIONS
;; ==========================================

;; Update price oracle (owner only - will be automated later)
(define-public (update-prices (new-stx-price uint) (new-sntl-price uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (var-set stx-price new-stx-price)
    (var-set sntl-price new-sntl-price)
    (ok { stx: new-stx-price, sntl: new-sntl-price })
  )
)

;; Update protocol parameters
(define-public (update-parameters 
  (new-max-ltv uint) 
  (new-liq-threshold uint) 
  (new-liq-bonus uint)
  (new-interest-rate uint)
)
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (asserts! (< new-max-ltv new-liq-threshold) (err u200))
    (var-set max-ltv new-max-ltv)
    (var-set liquidation-threshold new-liq-threshold)
    (var-set liquidation-bonus new-liq-bonus)
    (var-set interest-rate new-interest-rate)
    (ok true)
  )
)

;; Pause/unpause protocol
(define-public (set-paused (paused bool))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (var-set protocol-paused paused)
    (ok paused)
  )
)

;; Update minimum collateral
(define-public (set-min-collateral (amount uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (var-set min-collateral amount)
    (ok amount)
  )
)

