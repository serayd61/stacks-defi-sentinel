;; Protocol Insurance Contract
;; Decentralized insurance pool for Stacks DeFi protocol coverage
;; Users pay premiums to get covered against smart contract exploits

(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u900))
(define-constant err-not-authorized (err u901))
(define-constant err-not-found (err u902))
(define-constant err-insufficient-funds (err u903))
(define-constant err-already-covered (err u904))
(define-constant err-no-coverage (err u905))
(define-constant err-claim-pending (err u906))
(define-constant err-invalid-amount (err u907))

(define-constant COVERAGE-PERIOD u8640)    ;; ~60 days
(define-constant MIN-PREMIUM-BPS u50)     ;; 0.5% min premium
(define-constant MAX-COVERAGE-RATIO u5)   ;; 5x max pool leverage

(define-data-var pool-balance uint u0)
(define-data-var total-coverage-issued uint u0)
(define-data-var policy-count uint u0)
(define-data-var claim-count uint u0)
(define-data-var pool-active bool true)

(define-map adjusters principal bool)

;; Insurance policies
(define-map policies uint
  {
    holder: principal,
    protocol: principal,
    coverage-amount: uint,
    premium-paid: uint,
    start-block: uint,
    end-block: uint,
    active: bool,
    claimed: bool,
    claim-id: (optional uint)
  }
)

(define-map holder-policies principal (list 10 uint))

;; Claims
(define-map claims uint
  {
    policy-id: uint,
    claimant: principal,
    protocol: principal,
    claimed-amount: uint,
    incident-description: (string-ascii 200),
    submitted-at: uint,
    status: uint,    ;; 0=pending, 1=approved, 2=rejected
    adjuster: (optional principal),
    payout: uint
  }
)

;; Protocol coverage pools
(define-map protocol-pools principal
  {
    total-coverage: uint,
    pool-share: uint,
    premium-rate-bps: uint,
    max-coverage: uint,
    active: bool
  }
)

;; Read-only
(define-read-only (get-policy (policy-id uint))
  (map-get? policies policy-id)
)

(define-read-only (get-claim (claim-id uint))
  (map-get? claims claim-id)
)

(define-read-only (get-pool-info (protocol principal))
  (map-get? protocol-pools protocol)
)

(define-read-only (get-pool-balance)
  (var-get pool-balance)
)

(define-read-only (calculate-premium (coverage-amount uint) (premium-rate-bps uint))
  (/ (* coverage-amount premium-rate-bps) u10000)
)

(define-read-only (is-adjuster (a principal))
  (default-to false (map-get? adjusters a))
)

(define-read-only (is-policy-active (policy-id uint))
  (match (map-get? policies policy-id)
    p (and (get active p) (<= stacks-block-height (get end-block p)) (not (get claimed p)))
    false
  )
)

;; Public functions
(define-public (add-adjuster (adjuster principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (map-set adjusters adjuster true)
    (ok adjuster)
  )
)

(define-public (register-protocol-pool
    (protocol principal)
    (premium-rate-bps uint)
    (max-coverage uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (asserts! (>= premium-rate-bps MIN-PREMIUM-BPS) err-invalid-amount)
    (map-set protocol-pools protocol {
      total-coverage: u0,
      pool-share: u0,
      premium-rate-bps: premium-rate-bps,
      max-coverage: max-coverage,
      active: true
    })
    (ok protocol)
  )
)

(define-public (buy-coverage (protocol principal) (coverage-amount uint))
  (match (map-get? protocol-pools protocol)
    pool
    (let (
      (policy-id (var-get policy-count))
      (premium (calculate-premium coverage-amount (get premium-rate-bps pool)))
    )
      (asserts! (var-get pool-active) err-not-authorized)
      (asserts! (get active pool) err-not-found)
      (asserts! (> coverage-amount u0) err-invalid-amount)
      (asserts! (<= (+ (get total-coverage pool) coverage-amount) (get max-coverage pool)) err-invalid-amount)
      (asserts! (>= (stx-get-balance tx-sender) premium) err-insufficient-funds)

      (try! (stx-transfer? premium tx-sender (as-contract tx-sender)))

      (map-set policies policy-id {
        holder: tx-sender,
        protocol: protocol,
        coverage-amount: coverage-amount,
        premium-paid: premium,
        start-block: stacks-block-height,
        end-block: (+ stacks-block-height COVERAGE-PERIOD),
        active: true,
        claimed: false,
        claim-id: none
      })

      (map-set protocol-pools protocol (merge pool {
        total-coverage: (+ (get total-coverage pool) coverage-amount)
      }))

      (var-set pool-balance (+ (var-get pool-balance) premium))
      (var-set total-coverage-issued (+ (var-get total-coverage-issued) coverage-amount))
      (var-set policy-count (+ policy-id u1))

      (ok { policy-id: policy-id, coverage: coverage-amount, premium: premium })
    )
    err-not-found
  )
)

(define-public (file-claim
    (policy-id uint)
    (incident-description (string-ascii 200))
    (claimed-amount uint))
  (match (map-get? policies policy-id)
    policy
    (let ((claim-id (var-get claim-count)))
      (asserts! (is-eq tx-sender (get holder policy)) err-not-authorized)
      (asserts! (is-policy-active policy-id) err-no-coverage)
      (asserts! (<= claimed-amount (get coverage-amount policy)) err-invalid-amount)

      (map-set claims claim-id {
        policy-id: policy-id,
        claimant: tx-sender,
        protocol: (get protocol policy),
        claimed-amount: claimed-amount,
        incident-description: incident-description,
        submitted-at: stacks-block-height,
        status: u0,
        adjuster: none,
        payout: u0
      })

      (map-set policies policy-id (merge policy { claim-id: (some claim-id) }))
      (var-set claim-count (+ claim-id u1))

      (ok { claim-id: claim-id, policy-id: policy-id, claimed-amount: claimed-amount })
    )
    err-not-found
  )
)

(define-public (process-claim (claim-id uint) (approved bool) (payout uint))
  (match (map-get? claims claim-id)
    claim
    (begin
      (asserts! (is-adjuster tx-sender) err-not-authorized)
      (asserts! (is-eq (get status claim) u0) err-claim-pending)

      (if approved
        (begin
          (asserts! (<= payout (var-get pool-balance)) err-insufficient-funds)
          (try! (as-contract (stx-transfer? payout tx-sender (get claimant claim))))
          (var-set pool-balance (- (var-get pool-balance) payout))
          (map-set claims claim-id (merge claim { status: u1, adjuster: (some tx-sender), payout: payout }))
          (match (map-get? policies (get policy-id claim))
            policy (map-set policies (get policy-id claim) (merge policy { claimed: true, active: false }))
            false
          )
          (ok { claim-id: claim-id, approved: true, payout: payout })
        )
        (begin
          (map-set claims claim-id (merge claim { status: u2, adjuster: (some tx-sender) }))
          (ok { claim-id: claim-id, approved: false, payout: u0 })
        )
      )
    )
    err-not-found
  )
)

(define-public (add-to-pool (amount uint))
  (begin
    (asserts! (> amount u0) err-invalid-amount)
    (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
    (var-set pool-balance (+ (var-get pool-balance) amount))
    (ok { added: amount, total-pool: (var-get pool-balance) })
  )
)
