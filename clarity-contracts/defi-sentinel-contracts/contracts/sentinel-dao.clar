;; Sentinel DAO Governance Contract
;; On-chain voting and proposal management

(define-constant CONTRACT_OWNER tx-sender)
(define-constant ERR_NOT_AUTHORIZED (err u100))
(define-constant ERR_PROPOSAL_NOT_FOUND (err u101))
(define-constant ERR_VOTING_CLOSED (err u102))
(define-constant ERR_ALREADY_VOTED (err u103))
(define-constant ERR_INSUFFICIENT_VOTING_POWER (err u104))
(define-constant ERR_PROPOSAL_NOT_PASSED (err u105))
(define-constant ERR_ALREADY_EXECUTED (err u106))
(define-constant ERR_QUORUM_NOT_MET (err u107))

;; Governance parameters
(define-constant MIN_PROPOSAL_THRESHOLD u10000000000) ;; 10,000 SNTL to create proposal
(define-constant VOTING_PERIOD u1008) ;; ~7 days in blocks (10 min blocks)
(define-constant EXECUTION_DELAY u144) ;; ~1 day delay after voting ends
(define-constant QUORUM_PERCENTAGE u1000) ;; 10% of total supply needed

;; Proposal types
(define-constant PROPOSAL_TYPE_GOVERNANCE u1)
(define-constant PROPOSAL_TYPE_TREASURY u2)
(define-constant PROPOSAL_TYPE_TECHNICAL u3)
(define-constant PROPOSAL_TYPE_COMMUNITY u4)

;; Data structures
(define-map proposals
  { proposal-id: uint }
  {
    title: (string-ascii 100),
    description: (string-ascii 500),
    proposer: principal,
    proposal-type: uint,
    created-at: uint,
    voting-ends: uint,
    execution-time: uint,
    votes-for: uint,
    votes-against: uint,
    total-voters: uint,
    executed: bool,
    canceled: bool
  }
)

(define-map votes
  { proposal-id: uint, voter: principal }
  { 
    vote: bool, ;; true = for, false = against
    voting-power: uint,
    voted-at: uint
  }
)

(define-map voting-power
  { holder: principal }
  { power: uint }
)

;; Data variables
(define-data-var proposal-count uint u0)
(define-data-var total-voting-power uint u0)

;; Read-only functions

(define-read-only (get-proposal (proposal-id uint))
  (map-get? proposals { proposal-id: proposal-id })
)

(define-read-only (get-vote (proposal-id uint) (voter principal))
  (map-get? votes { proposal-id: proposal-id, voter: voter })
)

(define-read-only (get-voting-power (holder principal))
  (default-to u0 (get power (map-get? voting-power { holder: holder })))
)

(define-read-only (get-proposal-count)
  (var-get proposal-count)
)

(define-read-only (is-voting-active (proposal-id uint))
  (match (get-proposal proposal-id)
    proposal
    (and 
      (< block-height (get voting-ends proposal))
      (not (get canceled proposal))
    )
    false
  )
)

(define-read-only (has-quorum (proposal-id uint))
  (match (get-proposal proposal-id)
    proposal
    (let (
      (total-votes (+ (get votes-for proposal) (get votes-against proposal)))
      (quorum-needed (/ (* (var-get total-voting-power) QUORUM_PERCENTAGE) u10000))
    )
    (>= total-votes quorum-needed)
    )
    false
  )
)

(define-read-only (is-proposal-passed (proposal-id uint))
  (match (get-proposal proposal-id)
    proposal
    (and
      (>= block-height (get voting-ends proposal))
      (has-quorum proposal-id)
      (> (get votes-for proposal) (get votes-against proposal))
      (not (get canceled proposal))
    )
    false
  )
)

(define-read-only (can-execute (proposal-id uint))
  (match (get-proposal proposal-id)
    proposal
    (and
      (is-proposal-passed proposal-id)
      (>= block-height (get execution-time proposal))
      (not (get executed proposal))
    )
    false
  )
)

;; Public functions

(define-public (create-proposal 
  (title (string-ascii 100))
  (description (string-ascii 500))
  (proposal-type uint)
)
  (let (
    (proposer tx-sender)
    (proposer-power (get-voting-power proposer))
    (new-id (+ (var-get proposal-count) u1))
    (voting-ends (+ block-height VOTING_PERIOD))
    (execution-time (+ voting-ends EXECUTION_DELAY))
  )
    ;; Check proposer has enough voting power
    (asserts! (>= proposer-power MIN_PROPOSAL_THRESHOLD) ERR_INSUFFICIENT_VOTING_POWER)
    
    ;; Create proposal
    (map-set proposals
      { proposal-id: new-id }
      {
        title: title,
        description: description,
        proposer: proposer,
        proposal-type: proposal-type,
        created-at: block-height,
        voting-ends: voting-ends,
        execution-time: execution-time,
        votes-for: u0,
        votes-against: u0,
        total-voters: u0,
        executed: false,
        canceled: false
      }
    )
    
    (var-set proposal-count new-id)
    
    (ok { 
      proposal-id: new-id,
      voting-ends: voting-ends,
      execution-time: execution-time
    })
  )
)

(define-public (cast-vote (proposal-id uint) (vote-for bool))
  (let (
    (voter tx-sender)
    (voter-power (get-voting-power voter))
    (proposal (unwrap! (get-proposal proposal-id) ERR_PROPOSAL_NOT_FOUND))
  )
    ;; Check voting is still active
    (asserts! (is-voting-active proposal-id) ERR_VOTING_CLOSED)
    
    ;; Check hasn't voted already
    (asserts! (is-none (get-vote proposal-id voter)) ERR_ALREADY_VOTED)
    
    ;; Check has voting power
    (asserts! (> voter-power u0) ERR_INSUFFICIENT_VOTING_POWER)
    
    ;; Record vote
    (map-set votes
      { proposal-id: proposal-id, voter: voter }
      {
        vote: vote-for,
        voting-power: voter-power,
        voted-at: block-height
      }
    )
    
    ;; Update proposal vote counts
    (map-set proposals
      { proposal-id: proposal-id }
      (merge proposal {
        votes-for: (if vote-for 
          (+ (get votes-for proposal) voter-power)
          (get votes-for proposal)
        ),
        votes-against: (if vote-for
          (get votes-against proposal)
          (+ (get votes-against proposal) voter-power)
        ),
        total-voters: (+ (get total-voters proposal) u1)
      })
    )
    
    (ok { 
      proposal-id: proposal-id, 
      vote: vote-for, 
      voting-power: voter-power 
    })
  )
)

(define-public (execute-proposal (proposal-id uint))
  (let (
    (proposal (unwrap! (get-proposal proposal-id) ERR_PROPOSAL_NOT_FOUND))
  )
    ;; Check can execute
    (asserts! (can-execute proposal-id) ERR_PROPOSAL_NOT_PASSED)
    
    ;; Mark as executed
    (map-set proposals
      { proposal-id: proposal-id }
      (merge proposal { executed: true })
    )
    
    ;; In a real implementation, this would trigger the actual proposal execution
    ;; based on the proposal type and parameters
    
    (ok { executed: true, proposal-id: proposal-id })
  )
)

(define-public (cancel-proposal (proposal-id uint))
  (let (
    (proposal (unwrap! (get-proposal proposal-id) ERR_PROPOSAL_NOT_FOUND))
  )
    ;; Only proposer or contract owner can cancel
    (asserts! 
      (or 
        (is-eq tx-sender (get proposer proposal))
        (is-eq tx-sender CONTRACT_OWNER)
      )
      ERR_NOT_AUTHORIZED
    )
    
    ;; Can only cancel active proposals
    (asserts! (not (get executed proposal)) ERR_ALREADY_EXECUTED)
    
    ;; Mark as canceled
    (map-set proposals
      { proposal-id: proposal-id }
      (merge proposal { canceled: true })
    )
    
    (ok true)
  )
)

;; Admin functions to manage voting power (would be integrated with staking)

(define-public (set-voting-power (holder principal) (power uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_NOT_AUTHORIZED)
    
    (let (
      (current-power (get-voting-power holder))
    )
      ;; Update total
      (var-set total-voting-power 
        (+ (- (var-get total-voting-power) current-power) power)
      )
      
      ;; Set new power
      (map-set voting-power
        { holder: holder }
        { power: power }
      )
    )
    
    (ok power)
  )
)

(define-public (delegate-voting-power (delegate principal))
  (let (
    (delegator tx-sender)
    (delegator-power (get-voting-power delegator))
    (delegate-power (get-voting-power delegate))
  )
    (asserts! (> delegator-power u0) ERR_INSUFFICIENT_VOTING_POWER)
    
    ;; Transfer voting power
    (map-set voting-power { holder: delegator } { power: u0 })
    (map-set voting-power { holder: delegate } { power: (+ delegate-power delegator-power) })
    
    (ok { 
      from: delegator, 
      to: delegate, 
      amount: delegator-power 
    })
  )
)

