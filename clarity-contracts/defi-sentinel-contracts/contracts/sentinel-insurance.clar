;; ============================================================
;; SENTINEL INSURANCE - Protocol Insurance Fund
;; ============================================================
;; Users buy insurance against smart contract risk by paying premiums.
;; Claims are resolved through DAO voting.
;; The insurance fund pays interest to liquidity providers.
;; ============================================================

;; ============================================================
;; CONSTANTS
;; ============================================================

(define-constant contract-owner tx-sender)
(define-constant err-owner-only            (err u100))
(define-constant err-not-insured           (err u101))
(define-constant err-already-insured       (err u102))
(define-constant err-claim-not-found       (err u103))
(define-constant err-claim-not-pending     (err u104))
(define-constant err-already-voted         (err u105))
(define-constant err-not-provider          (err u106))
(define-constant err-insufficient-coverage (err u107))
(define-constant err-coverage-expired      (err u108))
(define-constant err-invalid-amount        (err u109))
(define-constant err-contract-paused       (err u110))
(define-constant err-claim-window-closed   (err u111))
(define-constant err-min-stake-required    (err u112))
(define-constant err-withdraw-locked       (err u113))

;; Insurance parameters
;; Annual premium rate: 2% of coverage
(define-constant ANNUAL-PREMIUM-RATE u200)   ;; 200 basis points = 2%
(define-constant RATE-DENOMINATOR u10000)

;; Risk calculation per block (~144 blocks/day, ~52560 blocks/year)
(define-constant BLOCKS-PER-YEAR u52560)

;; Minimum coverage amount: 10 STX
(define-constant MIN-COVERAGE-STX u10000000)

;; Maximum coverage amount: 100,000 STX
(define-constant MAX-COVERAGE-STX u100000000000)

;; Liquidity provider minimum stake: 100 STX
(define-constant MIN-PROVIDER-STAKE u100000000)

;; Provider withdraw lock: 1000 blocks (~7 days)
(define-constant PROVIDER-LOCK-BLOCKS u1000)

;; Claim voting period: 720 blocks (~5 days)
(define-constant CLAIM-VOTING-BLOCKS u720)

;; Required vote ratio for approval: 60%
(define-constant APPROVAL-THRESHOLD u60)

;; Max payout rate from claim: 80% of coverage
(define-constant MAX-PAYOUT-RATE u8000)

;; ============================================================
;; DATA STRUCTURES
;; ============================================================

(define-data-var total-pool-stx uint u0)         ;; Total insurance fund
(define-data-var total-coverage-outstanding uint u0)  ;; Total active coverage
(define-data-var total-premiums-collected uint u0)
(define-data-var total-claims-paid uint u0)
(define-data-var next-claim-id uint u1)
(define-data-var is-paused bool false)
(define-data-var utilization-cap uint u8000)      ;; Max 80% utilization rate

;; Insurance policy
(define-map policies principal {
  coverage-amount: uint,     ;; Coverage amount (micro-STX)
  premium-paid: uint,        ;; Premium paid
  start-block: uint,         ;; Start block
  end-block: uint,           ;; End block (expiration)
  covered-protocol: (string-ascii 50),  ;; Which protocol is insured
  is-active: bool,
  total-claims: uint         ;; Number of claims made from this policy
})

;; Insurance claim
(define-map claims uint {
  claimant: principal,
  coverage-amount: uint,
  requested-amount: uint,    ;; Requested payout
  description: (string-utf8 500),  ;; Claim description
  evidence-url: (string-utf8 200), ;; Evidence URL
  status: uint,              ;; 0=pending, 1=approved, 2=rejected, 3=paid
  created-at: uint,
  voting-ends-at: uint,
  yes-votes: uint,
  no-votes: uint,
  payout-amount: uint        ;; Approved payout amount
})

;; Vote records
(define-map claim-votes { claim-id: uint, voter: principal } {
  vote: bool,                ;; true=approve, false=reject
  weight: uint,              ;; Vote weight (staked SNTL amount)
  voted-at: uint
})

;; Liquidity providers
(define-map providers principal {
  staked-stx: uint,          ;; Staked STX
  share-percentage: uint,    ;; Pool share (with PRECISION * 10000)
  deposited-at: uint,        ;; Deposit block
  unlock-at: uint,           ;; Withdrawal lock end block
  accumulated-rewards: uint, ;; Accumulated premium income
  last-reward-block: uint    ;; Last reward calculation block
})

(define-data-var total-provider-shares uint u0)
(define-data-var acc-reward-per-share uint u0)   ;; Accumulated reward/share
(define-constant SHARE-PRECISION u1000000)

;; ============================================================
;; PRIVATE FUNCTIONS
;; ============================================================

(define-private (calculate-premium (coverage uint) (blocks uint))
  ;; Premium = coverage * annual_rate * blocks / blocks_per_year / denominator
  (/ (* (/ (* coverage ANNUAL-PREMIUM-RATE) RATE-DENOMINATOR) blocks) BLOCKS-PER-YEAR)
)

(define-private (get-utilization-rate)
  (if (> (var-get total-pool-stx) u0)
    (/ (* (var-get total-coverage-outstanding) RATE-DENOMINATOR) (var-get total-pool-stx))
    u0
  )
)

(define-private (is-under-utilization-cap)
  (<= (get-utilization-rate) (var-get utilization-cap))
)

(define-private (update-provider-rewards)
  ;; Distribute to providers when new premium enters the pool
  ;; This is a simplified version - in production called on every transaction
  true
)

;; ============================================================
;; PUBLIC FUNCTIONS - POLICY PURCHASE
;; ============================================================

;; BUY INSURANCE
;; coverage-amount: Coverage amount (micro-STX)
;; coverage-blocks: How many blocks to be insured for
;; covered-protocol: Which protocol (e.g.: "sentinel-lending")
(define-public (buy-policy
  (coverage-amount uint)
  (coverage-blocks uint)
  (covered-protocol (string-ascii 50)))
  (let (
    (user tx-sender)
    (premium (calculate-premium coverage-amount coverage-blocks))
    (end-block (+ stacks-block-height coverage-blocks))
  )
    (asserts! (not (var-get is-paused)) err-contract-paused)
    (asserts! (is-none (map-get? policies user)) err-already-insured)
    (asserts! (>= coverage-amount MIN-COVERAGE-STX) err-invalid-amount)
    (asserts! (<= coverage-amount MAX-COVERAGE-STX) err-invalid-amount)
    (asserts! (> premium u0) err-invalid-amount)
    ;; Pool sufficiency check
    (asserts! (is-under-utilization-cap) err-insufficient-coverage)
    (asserts! (<= (+ (var-get total-coverage-outstanding) coverage-amount)
                  (var-get total-pool-stx)) err-insufficient-coverage)
    ;; Sufficient balance
    (asserts! (>= (stx-get-balance user) premium) err-invalid-amount)

    ;; Pay premium
    (try! (stx-transfer? premium user (as-contract tx-sender)))

    ;; Save policy
    (map-set policies user {
      coverage-amount: coverage-amount,
      premium-paid: premium,
      start-block: stacks-block-height,
      end-block: end-block,
      covered-protocol: covered-protocol,
      is-active: true,
      total-claims: u0
    })

    ;; Update statistics
    (var-set total-pool-stx (+ (var-get total-pool-stx) premium))
    (var-set total-coverage-outstanding (+ (var-get total-coverage-outstanding) coverage-amount))
    (var-set total-premiums-collected (+ (var-get total-premiums-collected) premium))

    (print {
      event: "policy-purchased",
      insured: user,
      coverage: coverage-amount,
      premium: premium,
      protocol: covered-protocol,
      expires-at: end-block
    })

    (ok { coverage: coverage-amount, premium: premium, expires-at: end-block })
  )
)

;; RENEW POLICY
(define-public (renew-policy (additional-blocks uint))
  (let (
    (user tx-sender)
    (policy (unwrap! (map-get? policies user) err-not-insured))
    (coverage (get coverage-amount policy))
    (premium (calculate-premium coverage additional-blocks))
    (new-end-block (+ (max (get end-block policy) stacks-block-height) additional-blocks))
  )
    (asserts! (not (var-get is-paused)) err-contract-paused)
    (asserts! (>= (stx-get-balance user) premium) err-invalid-amount)

    (try! (stx-transfer? premium user (as-contract tx-sender)))

    (map-set policies user (merge policy {
      end-block: new-end-block,
      premium-paid: (+ (get premium-paid policy) premium)
    }))

    (var-set total-pool-stx (+ (var-get total-pool-stx) premium))
    (var-set total-premiums-collected (+ (var-get total-premiums-collected) premium))

    (print {
      event: "policy-renewed",
      insured: user,
      premium: premium,
      new-expires-at: new-end-block
    })

    (ok { premium: premium, new-expires-at: new-end-block })
  )
)

;; ============================================================
;; PUBLIC FUNCTIONS - INSURANCE CLAIMS
;; ============================================================

;; FILE A CLAIM
(define-public (file-claim
  (requested-amount uint)
  (description (string-utf8 500))
  (evidence-url (string-utf8 200)))
  (let (
    (user tx-sender)
    (policy (unwrap! (map-get? policies user) err-not-insured))
    (claim-id (var-get next-claim-id))
    (max-payout (/ (* (get coverage-amount policy) MAX-PAYOUT-RATE) RATE-DENOMINATOR))
  )
    (asserts! (not (var-get is-paused)) err-contract-paused)
    (asserts! (get is-active policy) err-coverage-expired)
    (asserts! (<= stacks-block-height (get end-block policy)) err-coverage-expired)
    (asserts! (> requested-amount u0) err-invalid-amount)
    (asserts! (<= requested-amount max-payout) err-invalid-amount)

    (map-set claims claim-id {
      claimant: user,
      coverage-amount: (get coverage-amount policy),
      requested-amount: requested-amount,
      description: description,
      evidence-url: evidence-url,
      status: u0,  ;; pending
      created-at: stacks-block-height,
      voting-ends-at: (+ stacks-block-height CLAIM-VOTING-BLOCKS),
      yes-votes: u0,
      no-votes: u0,
      payout-amount: u0
    })

    (var-set next-claim-id (+ claim-id u1))

    ;; Freeze policy for now (during claim process)
    (map-set policies user (merge policy {
      total-claims: (+ (get total-claims policy) u1)
    }))

    (print {
      event: "claim-filed",
      claim-id: claim-id,
      claimant: user,
      amount: requested-amount,
      voting-ends: (+ stacks-block-height CLAIM-VOTING-BLOCKS)
    })

    (ok claim-id)
  )
)

;; VOTE ON CLAIM (SNTL holders)
;; claim-id: Claim to vote on
;; approve: true=approve, false=reject
;; vote-weight: Vote weight (staked SNTL amount - comes from oracle)
(define-public (vote-on-claim (claim-id uint) (approve bool) (vote-weight uint))
  (let (
    (voter tx-sender)
    (claim (unwrap! (map-get? claims claim-id) err-claim-not-found))
  )
    (asserts! (is-eq (get status claim) u0) err-claim-not-pending)
    (asserts! (< stacks-block-height (get voting-ends-at claim)) err-claim-window-closed)
    (asserts! (is-none (map-get? claim-votes { claim-id: claim-id, voter: voter })) err-already-voted)
    (asserts! (> vote-weight u0) err-invalid-amount)

    ;; Record vote
    (map-set claim-votes { claim-id: claim-id, voter: voter } {
      vote: approve,
      weight: vote-weight,
      voted-at: stacks-block-height
    })

    ;; Update vote count
    (map-set claims claim-id (merge claim {
      yes-votes: (if approve (+ (get yes-votes claim) vote-weight) (get yes-votes claim)),
      no-votes: (if (not approve) (+ (get no-votes claim) vote-weight) (get no-votes claim))
    }))

    (print {
      event: "claim-vote",
      claim-id: claim-id,
      voter: voter,
      approve: approve,
      weight: vote-weight
    })

    (ok true)
  )
)

;; RESOLVE CLAIM (After voting period ends)
(define-public (resolve-claim (claim-id uint))
  (let (
    (claim (unwrap! (map-get? claims claim-id) err-claim-not-found))
  )
    (asserts! (is-eq (get status claim) u0) err-claim-not-pending)
    (asserts! (>= stacks-block-height (get voting-ends-at claim)) err-claim-window-closed)

    (let (
      (total-votes (+ (get yes-votes claim) (get no-votes claim)))
      (yes-percentage (if (> total-votes u0)
        (/ (* (get yes-votes claim) u100) total-votes)
        u0
      ))
      (approved (>= yes-percentage APPROVAL-THRESHOLD))
      (payout (if approved (get requested-amount claim) u0))
    )
      ;; Make the payout
      (if (and approved (> payout u0))
        (begin
          (asserts! (>= (var-get total-pool-stx) payout) err-insufficient-coverage)
          (try! (as-contract (stx-transfer? payout tx-sender (get claimant claim))))
          (var-set total-pool-stx (- (var-get total-pool-stx) payout))
          (var-set total-claims-paid (+ (var-get total-claims-paid) payout))
        )
        true
      )

      ;; Update claim
      (map-set claims claim-id (merge claim {
        status: (if approved u1 u2),  ;; 1=approved, 2=rejected
        payout-amount: payout
      }))

      (print {
        event: "claim-resolved",
        claim-id: claim-id,
        approved: approved,
        payout: payout,
        yes-votes: (get yes-votes claim),
        no-votes: (get no-votes claim)
      })

      (ok { approved: approved, payout: payout })
    )
  )
)

;; ============================================================
;; PUBLIC FUNCTIONS - LIQUIDITY PROVIDER
;; ============================================================

;; PROVIDE LIQUIDITY (Deposit STX, earn premium income)
(define-public (provide-liquidity (amount uint))
  (let (
    (provider tx-sender)
    (existing (map-get? providers provider))
    (current-amount (match existing p (get staked-stx p) u0))
    (new-amount (+ current-amount amount))
  )
    (asserts! (not (var-get is-paused)) err-contract-paused)
    (asserts! (>= new-amount MIN-PROVIDER-STAKE) err-min-stake-required)
    (asserts! (>= (stx-get-balance provider) amount) err-invalid-amount)

    (try! (stx-transfer? amount provider (as-contract tx-sender)))

    (map-set providers provider {
      staked-stx: new-amount,
      share-percentage: u0,  ;; To be calculated
      deposited-at: stacks-block-height,
      unlock-at: (+ stacks-block-height PROVIDER-LOCK-BLOCKS),
      accumulated-rewards: (match existing p (get accumulated-rewards p) u0),
      last-reward-block: stacks-block-height
    })

    (var-set total-pool-stx (+ (var-get total-pool-stx) amount))
    (var-set total-provider-shares (+ (var-get total-provider-shares) amount))

    (print {
      event: "liquidity-provided",
      provider: provider,
      amount: amount,
      unlock-at: (+ stacks-block-height PROVIDER-LOCK-BLOCKS)
    })

    (ok { staked: new-amount, unlock-at: (+ stacks-block-height PROVIDER-LOCK-BLOCKS) })
  )
)

;; WITHDRAW LIQUIDITY
(define-public (withdraw-liquidity (amount uint))
  (let (
    (provider tx-sender)
    (p (unwrap! (map-get? providers provider) err-not-provider))
  )
    (asserts! (>= stacks-block-height (get unlock-at p)) err-withdraw-locked)
    (asserts! (<= amount (get staked-stx p)) err-invalid-amount)
    ;; Utilization rate check - prevent withdrawal if too high
    (asserts! (is-under-utilization-cap) err-insufficient-coverage)

    (try! (as-contract (stx-transfer? amount tx-sender provider)))

    (let ((new-amount (- (get staked-stx p) amount)))
      (if (is-eq new-amount u0)
        (map-delete providers provider)
        (map-set providers provider (merge p {
          staked-stx: new-amount,
          unlock-at: (+ stacks-block-height PROVIDER-LOCK-BLOCKS)
        }))
      )

      (var-set total-pool-stx (- (var-get total-pool-stx) amount))
      (var-set total-provider-shares (- (var-get total-provider-shares) amount))

      (print { event: "liquidity-withdrawn", provider: provider, amount: amount })

      (ok amount)
    )
  )
)

;; ============================================================
;; READ-ONLY FUNCTIONS
;; ============================================================

(define-read-only (get-policy (user principal))
  (map-get? policies user)
)

(define-read-only (get-claim (claim-id uint))
  (map-get? claims claim-id)
)

(define-read-only (get-provider-info (provider principal))
  (map-get? providers provider)
)

(define-read-only (get-pool-stats)
  {
    total-pool-stx: (var-get total-pool-stx),
    total-coverage-outstanding: (var-get total-coverage-outstanding),
    total-premiums-collected: (var-get total-premiums-collected),
    total-claims-paid: (var-get total-claims-paid),
    utilization-rate: (get-utilization-rate),
    utilization-cap: (var-get utilization-cap),
    is-paused: (var-get is-paused)
  }
)

(define-read-only (get-quote (coverage-amount uint) (coverage-blocks uint))
  (ok {
    coverage: coverage-amount,
    premium: (calculate-premium coverage-amount coverage-blocks),
    blocks: coverage-blocks,
    annual-rate-bps: ANNUAL-PREMIUM-RATE
  })
)

(define-read-only (is-policy-active (user principal))
  (match (map-get? policies user)
    policy (and (get is-active policy) (<= stacks-block-height (get end-block policy)))
    false
  )
)

;; ============================================================
;; ADMIN
;; ============================================================

(define-public (set-paused (paused bool))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (var-set is-paused paused)
    (ok true)
  )
)

(define-public (set-utilization-cap (new-cap uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (asserts! (<= new-cap RATE-DENOMINATOR) err-invalid-amount)
    (var-set utilization-cap new-cap)
    (ok true)
  )
)
