;; Liquidation Bot Registry v1 Contract
;; Register liquidation bots, track opportunities,
;; manage priority queue, and handle profit sharing
;; Part of the Stacks DeFi Sentinel suite

(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u900))
(define-constant err-not-authorized (err u901))
(define-constant err-not-found (err u902))
(define-constant err-invalid-amount (err u903))
(define-constant err-already-registered (err u904))
(define-constant err-already-claimed (err u905))
(define-constant err-bot-inactive (err u906))

;; Profit sharing: 90% to liquidator, 10% protocol fee
(define-constant LIQUIDATOR-SHARE-BPS u9000)
(define-constant PROTOCOL-FEE-BPS u1000)
(define-constant MIN-STAKE u5000000) ;; 5 STX minimum stake

;; --- Data Variables ---
(define-data-var bot-count uint u0)
(define-data-var opportunity-count uint u0)
(define-data-var total-liquidations uint u0)
(define-data-var total-profit-distributed uint u0)
(define-data-var protocol-fees-collected uint u0)

;; --- Bot Registry ---
(define-map liquidation-bots principal
  {
    bot-id: uint,
    bot-name: (string-ascii 50),
    stake-amount: uint,
    successful-liquidations: uint,
    total-profit: uint,
    priority-score: uint,
    registered-block: uint,
    last-active-block: uint,
    active: bool
  }
)

;; --- Liquidation Opportunities ---
(define-map liquidation-opportunities uint
  {
    protocol: principal,
    borrower: principal,
    collateral-value: uint,
    debt-value: uint,
    health-factor: uint,
    potential-profit: uint,
    reported-by: principal,
    reported-block: uint,
    claimed-by: (optional principal),
    executed: bool,
    expired: bool
  }
)

;; --- Execution Records ---
(define-map execution-records uint
  {
    opportunity-id: uint,
    liquidator: principal,
    actual-profit: uint,
    liquidator-payout: uint,
    protocol-fee: uint,
    execution-block: uint
  }
)

(define-data-var execution-count uint u0)

;; --- Read-only Functions ---

(define-read-only (get-bot (bot-addr principal))
  (map-get? liquidation-bots bot-addr)
)

(define-read-only (get-opportunity (opp-id uint))
  (map-get? liquidation-opportunities opp-id)
)

(define-read-only (get-execution (exec-id uint))
  (map-get? execution-records exec-id)
)

(define-read-only (get-bot-priority (bot-addr principal))
  (match (map-get? liquidation-bots bot-addr)
    bot
    (ok (get priority-score bot))
    err-not-found
  )
)

(define-read-only (get-registry-stats)
  {
    total-bots: (var-get bot-count),
    total-opportunities: (var-get opportunity-count),
    total-liquidations: (var-get total-liquidations),
    total-profit-distributed: (var-get total-profit-distributed),
    protocol-fees: (var-get protocol-fees-collected)
  }
)

(define-read-only (calculate-priority (stake uint) (successful uint))
  ;; Priority = stake weight (60%) + success rate weight (40%)
  (+ (/ (* stake u6) u10) (* successful u400))
)

;; --- Public Functions ---

(define-public (register-bot (bot-name (string-ascii 50)) (stake uint))
  (begin
    (asserts! (is-none (map-get? liquidation-bots tx-sender)) err-already-registered)
    (asserts! (>= stake MIN-STAKE) err-invalid-amount)

    ;; Transfer stake to contract
    (try! (stx-transfer? stake tx-sender (as-contract tx-sender)))

    (let ((bid (var-get bot-count)))
      (map-set liquidation-bots tx-sender {
        bot-id: bid,
        bot-name: bot-name,
        stake-amount: stake,
        successful-liquidations: u0,
        total-profit: u0,
        priority-score: (calculate-priority stake u0),
        registered-block: stacks-block-height,
        last-active-block: stacks-block-height,
        active: true
      })
      (var-set bot-count (+ bid u1))
      (ok { bot-id: bid, priority-score: (calculate-priority stake u0) })
    )
  )
)

(define-public (report-opportunity
    (protocol principal)
    (borrower principal)
    (collateral-value uint)
    (debt-value uint)
    (health-factor uint)
    (potential-profit uint))
  (let (
    (oid (var-get opportunity-count))
  )
    (asserts! (is-some (map-get? liquidation-bots tx-sender)) err-not-authorized)

    (map-set liquidation-opportunities oid {
      protocol: protocol,
      borrower: borrower,
      collateral-value: collateral-value,
      debt-value: debt-value,
      health-factor: health-factor,
      potential-profit: potential-profit,
      reported-by: tx-sender,
      reported-block: stacks-block-height,
      claimed-by: none,
      executed: false,
      expired: false
    })

    (var-set opportunity-count (+ oid u1))
    (ok { opportunity-id: oid, potential-profit: potential-profit })
  )
)

(define-public (claim-opportunity (opp-id uint))
  (match (map-get? liquidation-opportunities opp-id)
    opp
    (begin
      (asserts! (is-some (map-get? liquidation-bots tx-sender)) err-not-authorized)
      (asserts! (is-none (get claimed-by opp)) err-already-claimed)
      (asserts! (not (get executed opp)) err-already-claimed)
      (asserts! (not (get expired opp)) err-not-found)

      (match (map-get? liquidation-bots tx-sender)
        bot
        (begin
          (asserts! (get active bot) err-bot-inactive)
          (map-set liquidation-opportunities opp-id
            (merge opp { claimed-by: (some tx-sender) })
          )
          (ok { opportunity-id: opp-id, claimed-by: tx-sender })
        )
        err-not-found
      )
    )
    err-not-found
  )
)

(define-public (execute-liquidation (opp-id uint) (actual-profit uint))
  (match (map-get? liquidation-opportunities opp-id)
    opp
    (let (
      (eid (var-get execution-count))
      (liquidator-payout (/ (* actual-profit LIQUIDATOR-SHARE-BPS) u10000))
      (protocol-fee (/ (* actual-profit PROTOCOL-FEE-BPS) u10000))
    )
      (asserts! (is-eq (some tx-sender) (get claimed-by opp)) err-not-authorized)
      (asserts! (not (get executed opp)) err-already-claimed)

      ;; Mark opportunity as executed
      (map-set liquidation-opportunities opp-id
        (merge opp { executed: true })
      )

      ;; Record execution
      (map-set execution-records eid {
        opportunity-id: opp-id,
        liquidator: tx-sender,
        actual-profit: actual-profit,
        liquidator-payout: liquidator-payout,
        protocol-fee: protocol-fee,
        execution-block: stacks-block-height
      })

      ;; Update bot stats
      (match (map-get? liquidation-bots tx-sender)
        bot
        (map-set liquidation-bots tx-sender (merge bot {
          successful-liquidations: (+ (get successful-liquidations bot) u1),
          total-profit: (+ (get total-profit bot) liquidator-payout),
          priority-score: (calculate-priority (get stake-amount bot) (+ (get successful-liquidations bot) u1)),
          last-active-block: stacks-block-height
        }))
        false
      )

      (var-set execution-count (+ eid u1))
      (var-set total-liquidations (+ (var-get total-liquidations) u1))
      (var-set total-profit-distributed (+ (var-get total-profit-distributed) liquidator-payout))
      (var-set protocol-fees-collected (+ (var-get protocol-fees-collected) protocol-fee))

      (ok { execution-id: eid, liquidator-payout: liquidator-payout, protocol-fee: protocol-fee })
    )
    err-not-found
  )
)

(define-public (deactivate-bot)
  (match (map-get? liquidation-bots tx-sender)
    bot
    (begin
      (map-set liquidation-bots tx-sender (merge bot { active: false }))
      ;; Return stake
      (try! (as-contract (stx-transfer? (get stake-amount bot) tx-sender tx-sender)))
      (ok { returned-stake: (get stake-amount bot) })
    )
    err-not-found
  )
)

(define-public (expire-opportunity (opp-id uint))
  (match (map-get? liquidation-opportunities opp-id)
    opp
    (begin
      (asserts! (or (is-eq tx-sender contract-owner) (is-eq tx-sender (get reported-by opp))) err-not-authorized)
      (asserts! (not (get executed opp)) err-already-claimed)
      (map-set liquidation-opportunities opp-id (merge opp { expired: true }))
      (ok opp-id)
    )
    err-not-found
  )
)

;; --- Admin ---

(define-public (withdraw-protocol-fees (amount uint) (recipient principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (asserts! (<= amount (var-get protocol-fees-collected)) err-invalid-amount)
    (try! (as-contract (stx-transfer? amount tx-sender recipient)))
    (var-set protocol-fees-collected (- (var-get protocol-fees-collected) amount))
    (ok amount)
  )
)
