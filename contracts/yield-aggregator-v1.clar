;; Yield Aggregator v1 Contract
;; Aggregates yield opportunities across Stacks DeFi protocols,
;; supports strategy registry, auto-compound, best yield finding,
;; and user deposit routing
;; Part of the Stacks DeFi Sentinel suite

(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u1000))
(define-constant err-not-authorized (err u1001))
(define-constant err-not-found (err u1002))
(define-constant err-invalid-amount (err u1003))
(define-constant err-strategy-inactive (err u1004))
(define-constant err-invalid-apy (err u1005))
(define-constant err-insufficient-balance (err u1006))

;; Max APY sanity check: 50000 bps = 500%
(define-constant MAX-APY-BPS u5000000)
(define-constant MIN-DEPOSIT u1000000) ;; 1 STX minimum
(define-constant COMPOUND-FEE-BPS u50) ;; 0.5% compound fee

;; --- Data Variables ---
(define-data-var strategy-count uint u0)
(define-data-var total-deposits uint u0)
(define-data-var total-yield-earned uint u0)
(define-data-var compound-count uint u0)
(define-data-var best-strategy-id uint u0)
(define-data-var best-strategy-apy uint u0)

(define-map authorized-strategists principal bool)

;; --- Strategy Registry ---
(define-map strategies uint
  {
    protocol: principal,
    protocol-name: (string-ascii 50),
    strategy-name: (string-ascii 50),
    strategy-type: (string-ascii 20),
    current-apy-bps: uint,
    total-deposited: uint,
    total-yield: uint,
    compound-frequency: uint,
    last-compound-block: uint,
    last-update-block: uint,
    active: bool,
    risk-level: uint
  }
)

;; --- User Deposits ---
(define-map user-deposits
  { user: principal, strategy-id: uint }
  {
    deposited-amount: uint,
    accrued-yield: uint,
    deposit-block: uint,
    last-compound-block: uint,
    auto-compound: bool
  }
)

;; --- User Total Balances ---
(define-map user-balances principal
  {
    total-deposited: uint,
    total-yield-earned: uint,
    active-strategies: uint
  }
)

;; --- Compound History ---
(define-map compound-history uint
  {
    strategy-id: uint,
    yield-amount: uint,
    compound-fee: uint,
    participants: uint,
    block-height: uint
  }
)

;; --- Read-only Functions ---

(define-read-only (get-strategy (strategy-id uint))
  (map-get? strategies strategy-id)
)

(define-read-only (get-user-deposit (user principal) (strategy-id uint))
  (map-get? user-deposits { user: user, strategy-id: strategy-id })
)

(define-read-only (get-user-balance (user principal))
  (map-get? user-balances user)
)

(define-read-only (get-compound-record (compound-id uint))
  (map-get? compound-history compound-id)
)

(define-read-only (get-best-strategy)
  {
    strategy-id: (var-get best-strategy-id),
    apy-bps: (var-get best-strategy-apy)
  }
)

(define-read-only (get-aggregator-stats)
  {
    total-strategies: (var-get strategy-count),
    total-deposits: (var-get total-deposits),
    total-yield-earned: (var-get total-yield-earned),
    total-compounds: (var-get compound-count),
    best-strategy-id: (var-get best-strategy-id),
    best-apy-bps: (var-get best-strategy-apy)
  }
)

(define-read-only (is-strategist (addr principal))
  (default-to false (map-get? authorized-strategists addr))
)

(define-read-only (estimate-yield (amount uint) (apy-bps uint) (blocks uint))
  ;; Simplified yield estimate: amount * apy * blocks / (blocks-per-year * 10000)
  ;; Approximate 52560 blocks per year on Stacks
  (/ (* (* amount apy-bps) blocks) (* u52560 u10000))
)

;; --- Public Functions ---

(define-public (add-strategist (strategist principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (map-set authorized-strategists strategist true)
    (ok strategist)
  )
)

(define-public (register-strategy
    (protocol principal)
    (protocol-name (string-ascii 50))
    (strategy-name (string-ascii 50))
    (strategy-type (string-ascii 20))
    (apy-bps uint)
    (compound-frequency uint)
    (risk-level uint))
  (let (
    (sid (var-get strategy-count))
  )
    (asserts! (or (is-eq tx-sender contract-owner) (is-strategist tx-sender)) err-not-authorized)
    (asserts! (<= apy-bps MAX-APY-BPS) err-invalid-apy)

    (map-set strategies sid {
      protocol: protocol,
      protocol-name: protocol-name,
      strategy-name: strategy-name,
      strategy-type: strategy-type,
      current-apy-bps: apy-bps,
      total-deposited: u0,
      total-yield: u0,
      compound-frequency: compound-frequency,
      last-compound-block: stacks-block-height,
      last-update-block: stacks-block-height,
      active: true,
      risk-level: risk-level
    })

    ;; Update best strategy tracker
    (if (> apy-bps (var-get best-strategy-apy))
      (begin
        (var-set best-strategy-id sid)
        (var-set best-strategy-apy apy-bps)
      )
      false
    )

    (var-set strategy-count (+ sid u1))
    (ok { strategy-id: sid, protocol-name: protocol-name, apy-bps: apy-bps })
  )
)

(define-public (update-strategy-apy (strategy-id uint) (new-apy-bps uint))
  (match (map-get? strategies strategy-id)
    strat
    (begin
      (asserts! (or (is-eq tx-sender contract-owner) (is-strategist tx-sender)) err-not-authorized)
      (asserts! (<= new-apy-bps MAX-APY-BPS) err-invalid-apy)
      (asserts! (get active strat) err-strategy-inactive)

      (map-set strategies strategy-id (merge strat {
        current-apy-bps: new-apy-bps,
        last-update-block: stacks-block-height
      }))

      ;; Update best strategy if needed
      (if (> new-apy-bps (var-get best-strategy-apy))
        (begin
          (var-set best-strategy-id strategy-id)
          (var-set best-strategy-apy new-apy-bps)
        )
        false
      )

      (ok { strategy-id: strategy-id, new-apy-bps: new-apy-bps })
    )
    err-not-found
  )
)

(define-public (deposit-to-strategy (strategy-id uint) (amount uint) (auto-compound bool))
  (match (map-get? strategies strategy-id)
    strat
    (let (
      (existing-deposit (map-get? user-deposits { user: tx-sender, strategy-id: strategy-id }))
      (existing-balance (map-get? user-balances tx-sender))
    )
      (asserts! (get active strat) err-strategy-inactive)
      (asserts! (>= amount MIN-DEPOSIT) err-invalid-amount)

      ;; Transfer STX to contract
      (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))

      ;; Update user deposit for this strategy
      (match existing-deposit
        dep
        (map-set user-deposits { user: tx-sender, strategy-id: strategy-id } {
          deposited-amount: (+ (get deposited-amount dep) amount),
          accrued-yield: (get accrued-yield dep),
          deposit-block: (get deposit-block dep),
          last-compound-block: stacks-block-height,
          auto-compound: auto-compound
        })
        (map-set user-deposits { user: tx-sender, strategy-id: strategy-id } {
          deposited-amount: amount,
          accrued-yield: u0,
          deposit-block: stacks-block-height,
          last-compound-block: stacks-block-height,
          auto-compound: auto-compound
        })
      )

      ;; Update user total balance
      (match existing-balance
        bal
        (map-set user-balances tx-sender {
          total-deposited: (+ (get total-deposited bal) amount),
          total-yield-earned: (get total-yield-earned bal),
          active-strategies: (if (is-none existing-deposit)
            (+ (get active-strategies bal) u1)
            (get active-strategies bal))
        })
        (map-set user-balances tx-sender {
          total-deposited: amount,
          total-yield-earned: u0,
          active-strategies: u1
        })
      )

      ;; Update strategy totals
      (map-set strategies strategy-id (merge strat {
        total-deposited: (+ (get total-deposited strat) amount)
      }))

      (var-set total-deposits (+ (var-get total-deposits) amount))

      (ok { strategy-id: strategy-id, deposited: amount, auto-compound: auto-compound })
    )
    err-not-found
  )
)

(define-public (withdraw-from-strategy (strategy-id uint) (amount uint))
  (match (map-get? user-deposits { user: tx-sender, strategy-id: strategy-id })
    dep
    (let (
      (available (+ (get deposited-amount dep) (get accrued-yield dep)))
    )
      (asserts! (<= amount available) err-insufficient-balance)
      (asserts! (> amount u0) err-invalid-amount)

      ;; Transfer STX back
      (try! (as-contract (stx-transfer? amount tx-sender tx-sender)))

      ;; Update deposit record
      (if (<= amount (get accrued-yield dep))
        (map-set user-deposits { user: tx-sender, strategy-id: strategy-id }
          (merge dep { accrued-yield: (- (get accrued-yield dep) amount) }))
        (map-set user-deposits { user: tx-sender, strategy-id: strategy-id }
          (merge dep {
            deposited-amount: (- available amount),
            accrued-yield: u0
          }))
      )

      ;; Update strategy total
      (match (map-get? strategies strategy-id)
        strat
        (map-set strategies strategy-id (merge strat {
          total-deposited: (if (> (get total-deposited strat) amount)
            (- (get total-deposited strat) amount)
            u0)
        }))
        false
      )

      (ok { withdrawn: amount, remaining: (- available amount) })
    )
    err-not-found
  )
)

(define-public (trigger-compound (strategy-id uint) (yield-amount uint))
  (match (map-get? strategies strategy-id)
    strat
    (let (
      (cid (var-get compound-count))
      (fee (/ (* yield-amount COMPOUND-FEE-BPS) u10000))
      (net-yield (- yield-amount fee))
    )
      (asserts! (or (is-eq tx-sender contract-owner) (is-strategist tx-sender)) err-not-authorized)
      (asserts! (get active strat) err-strategy-inactive)

      ;; Record compound event
      (map-set compound-history cid {
        strategy-id: strategy-id,
        yield-amount: net-yield,
        compound-fee: fee,
        participants: u0,
        block-height: stacks-block-height
      })

      ;; Update strategy yield tracking
      (map-set strategies strategy-id (merge strat {
        total-yield: (+ (get total-yield strat) net-yield),
        last-compound-block: stacks-block-height
      }))

      (var-set compound-count (+ cid u1))
      (var-set total-yield-earned (+ (var-get total-yield-earned) net-yield))

      (ok { compound-id: cid, net-yield: net-yield, fee: fee })
    )
    err-not-found
  )
)

;; --- Admin ---

(define-public (deactivate-strategy (strategy-id uint))
  (match (map-get? strategies strategy-id)
    strat
    (begin
      (asserts! (is-eq tx-sender contract-owner) err-owner-only)
      (map-set strategies strategy-id (merge strat { active: false }))
      (ok strategy-id)
    )
    err-not-found
  )
)
