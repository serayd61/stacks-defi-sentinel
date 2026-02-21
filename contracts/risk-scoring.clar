;; Risk Scoring Contract
;; On-chain risk assessment engine for Stacks DeFi protocols
;; Computes composite risk scores based on multiple factors

(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u400))
(define-constant err-not-authorized (err u401))
(define-constant err-not-found (err u402))
(define-constant err-invalid-score (err u403))

(define-constant MAX-SCORE u100)
(define-constant RISK-LOW u25)
(define-constant RISK-MEDIUM u50)
(define-constant RISK-HIGH u75)
(define-constant RISK-CRITICAL u100)

(define-data-var scorer-count uint u0)
(define-data-var assessment-count uint u0)

(define-map authorized-scorers principal bool)

;; Risk assessments
(define-map risk-assessments principal
  {
    protocol-name: (string-ascii 50),
    composite-score: uint,
    tvl-score: uint,
    audit-score: uint,
    age-score: uint,
    incident-score: uint,
    liquidity-score: uint,
    last-assessed: uint,
    assessor: principal,
    notes: (optional (string-ascii 200))
  }
)

;; Score history
(define-map score-history
  { protocol: principal, assessment-id: uint }
  { score: uint, block: uint, assessor: principal }
)

(define-map protocol-assessment-count principal uint)

;; Read-only
(define-read-only (get-risk-assessment (protocol principal))
  (map-get? risk-assessments protocol)
)

(define-read-only (get-risk-level (protocol principal))
  (match (map-get? risk-assessments protocol)
    assessment
    (let ((score (get composite-score assessment)))
      (ok (if (<= score RISK-LOW) "LOW"
        (if (<= score RISK-MEDIUM) "MEDIUM"
          (if (<= score RISK-HIGH) "HIGH" "CRITICAL"))))
    )
    err-not-found
  )
)

(define-read-only (get-score-history (protocol principal) (assessment-id uint))
  (map-get? score-history { protocol: protocol, assessment-id: assessment-id })
)

(define-read-only (is-scorer (scorer principal))
  (default-to false (map-get? authorized-scorers scorer))
)

(define-read-only (calculate-composite-score
    (tvl-score uint)
    (audit-score uint)
    (age-score uint)
    (incident-score uint)
    (liquidity-score uint))
  ;; Weighted average: TVL 30%, Audit 25%, Age 15%, Incident 20%, Liquidity 10%
  (/ (+ (* tvl-score u30) (* audit-score u25) (* age-score u15)
         (* incident-score u20) (* liquidity-score u10)) u100)
)

;; Public functions
(define-public (add-scorer (scorer principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (map-set authorized-scorers scorer true)
    (var-set scorer-count (+ (var-get scorer-count) u1))
    (ok scorer)
  )
)

(define-public (submit-assessment
    (protocol principal)
    (protocol-name (string-ascii 50))
    (tvl-score uint)
    (audit-score uint)
    (age-score uint)
    (incident-score uint)
    (liquidity-score uint)
    (notes (optional (string-ascii 200))))
  (let (
    (composite (calculate-composite-score tvl-score audit-score age-score incident-score liquidity-score))
    (assessment-id (default-to u0 (map-get? protocol-assessment-count protocol)))
  )
    (asserts! (is-scorer tx-sender) err-not-authorized)
    (asserts! (<= tvl-score MAX-SCORE) err-invalid-score)
    (asserts! (<= audit-score MAX-SCORE) err-invalid-score)
    (asserts! (<= age-score MAX-SCORE) err-invalid-score)
    (asserts! (<= incident-score MAX-SCORE) err-invalid-score)
    (asserts! (<= liquidity-score MAX-SCORE) err-invalid-score)

    (map-set risk-assessments protocol {
      protocol-name: protocol-name,
      composite-score: composite,
      tvl-score: tvl-score,
      audit-score: audit-score,
      age-score: age-score,
      incident-score: incident-score,
      liquidity-score: liquidity-score,
      last-assessed: stacks-block-height,
      assessor: tx-sender,
      notes: notes
    })

    (map-set score-history
      { protocol: protocol, assessment-id: assessment-id }
      { score: composite, block: stacks-block-height, assessor: tx-sender }
    )

    (map-set protocol-assessment-count protocol (+ assessment-id u1))
    (var-set assessment-count (+ (var-get assessment-count) u1))

    (ok { protocol: protocol, composite-score: composite, risk-level: (if (<= composite RISK-LOW) "LOW" (if (<= composite RISK-MEDIUM) "MEDIUM" "HIGH")) })
  )
)
