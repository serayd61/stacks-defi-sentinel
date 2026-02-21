;; Governance Votes Contract
;; On-chain voting system for DeFi Sentinel protocol governance
;; Supports proposal creation, voting, and execution

(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u800))
(define-constant err-not-authorized (err u801))
(define-constant err-not-found (err u802))
(define-constant err-already-voted (err u803))
(define-constant err-voting-closed (err u804))
(define-constant err-voting-open (err u805))
(define-constant err-quorum-not-met (err u806))
(define-constant err-invalid-duration (err u807))

(define-constant MIN-VOTING-PERIOD u144)   ;; ~1 day
(define-constant MAX-VOTING-PERIOD u4320)  ;; ~30 days
(define-constant QUORUM-BPS u1000)         ;; 10% quorum

(define-data-var proposal-count uint u0)
(define-data-var total-voting-power uint u0)

(define-map voting-members principal uint)  ;; principal -> voting power

;; Proposals
(define-map proposals uint
  {
    proposer: principal,
    title: (string-ascii 100),
    description: (string-ascii 500),
    action: (string-ascii 200),
    start-block: uint,
    end-block: uint,
    votes-for: uint,
    votes-against: uint,
    votes-abstain: uint,
    executed: bool,
    cancelled: bool,
    passed: bool
  }
)

;; Vote records
(define-map votes
  { proposal-id: uint, voter: principal }
  { vote: uint, power: uint, block: uint }
  ;; vote: 0=against, 1=for, 2=abstain
)

;; Read-only
(define-read-only (get-proposal (proposal-id uint))
  (map-get? proposals proposal-id)
)

(define-read-only (get-vote (proposal-id uint) (voter principal))
  (map-get? votes { proposal-id: proposal-id, voter: voter })
)

(define-read-only (get-voting-power (member principal))
  (default-to u0 (map-get? voting-members member))
)

(define-read-only (is-voting-active (proposal-id uint))
  (match (map-get? proposals proposal-id)
    p (and
        (>= stacks-block-height (get start-block p))
        (<= stacks-block-height (get end-block p))
        (not (get cancelled p)))
    false
  )
)

(define-read-only (has-passed (proposal-id uint))
  (match (map-get? proposals proposal-id)
    p (and
        (> stacks-block-height (get end-block p))
        (> (get votes-for p) (get votes-against p))
        (> (+ (get votes-for p) (get votes-against p) (get votes-abstain p))
           (/ (* (var-get total-voting-power) QUORUM-BPS) u10000)))
    false
  )
)

;; Public functions
(define-public (set-voting-power (member principal) (power uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (let ((old-power (get-voting-power member)))
      (map-set voting-members member power)
      (var-set total-voting-power
        (+ (- (var-get total-voting-power) old-power) power))
      (ok { member: member, power: power })
    )
  )
)

(define-public (create-proposal
    (title (string-ascii 100))
    (description (string-ascii 500))
    (action (string-ascii 200))
    (duration uint))
  (let ((proposal-id (var-get proposal-count)))
    (asserts! (> (get-voting-power tx-sender) u0) err-not-authorized)
    (asserts! (>= duration MIN-VOTING-PERIOD) err-invalid-duration)
    (asserts! (<= duration MAX-VOTING-PERIOD) err-invalid-duration)

    (map-set proposals proposal-id {
      proposer: tx-sender,
      title: title,
      description: description,
      action: action,
      start-block: stacks-block-height,
      end-block: (+ stacks-block-height duration),
      votes-for: u0,
      votes-against: u0,
      votes-abstain: u0,
      executed: false,
      cancelled: false,
      passed: false
    })

    (var-set proposal-count (+ proposal-id u1))
    (ok { proposal-id: proposal-id, end-block: (+ stacks-block-height duration) })
  )
)

(define-public (cast-vote (proposal-id uint) (vote uint))
  (match (map-get? proposals proposal-id)
    proposal
    (let ((power (get-voting-power tx-sender)))
      (asserts! (is-voting-active proposal-id) err-voting-closed)
      (asserts! (> power u0) err-not-authorized)
      (asserts! (is-none (map-get? votes { proposal-id: proposal-id, voter: tx-sender })) err-already-voted)
      (asserts! (<= vote u2) err-not-authorized)

      (map-set votes
        { proposal-id: proposal-id, voter: tx-sender }
        { vote: vote, power: power, block: stacks-block-height }
      )

      (map-set proposals proposal-id
        (merge proposal {
          votes-for: (if (is-eq vote u1) (+ (get votes-for proposal) power) (get votes-for proposal)),
          votes-against: (if (is-eq vote u0) (+ (get votes-against proposal) power) (get votes-against proposal)),
          votes-abstain: (if (is-eq vote u2) (+ (get votes-abstain proposal) power) (get votes-abstain proposal))
        })
      )

      (ok { proposal-id: proposal-id, vote: vote, power: power })
    )
    err-not-found
  )
)

(define-public (finalize-proposal (proposal-id uint))
  (match (map-get? proposals proposal-id)
    proposal
    (begin
      (asserts! (> stacks-block-height (get end-block proposal)) err-voting-open)
      (asserts! (not (get executed proposal)) err-not-authorized)
      (let ((passed (has-passed proposal-id)))
        (map-set proposals proposal-id (merge proposal { passed: passed, executed: true }))
        (ok { proposal-id: proposal-id, passed: passed })
      )
    )
    err-not-found
  )
)

(define-public (cancel-proposal (proposal-id uint))
  (match (map-get? proposals proposal-id)
    proposal
    (begin
      (asserts! (or (is-eq tx-sender (get proposer proposal)) (is-eq tx-sender contract-owner)) err-not-authorized)
      (asserts! (not (get executed proposal)) err-not-authorized)
      (map-set proposals proposal-id (merge proposal { cancelled: true }))
      (ok proposal-id)
    )
    err-not-found
  )
)
