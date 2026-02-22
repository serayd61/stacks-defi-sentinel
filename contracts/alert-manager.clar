;; Alert Manager Contract
;; Centralized alert routing and notification registry for DeFi Sentinel
;; Manages alert subscriptions, escalations, and history

(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u500))
(define-constant err-not-authorized (err u501))
(define-constant err-not-found (err u502))
(define-constant err-already-subscribed (err u503))
(define-constant err-invalid-level (err u504))

(define-constant LEVEL-INFO u1)
(define-constant LEVEL-WARNING u2)
(define-constant LEVEL-CRITICAL u3)
(define-constant LEVEL-EMERGENCY u4)

(define-data-var alert-count uint u0)
(define-data-var subscription-count uint u0)
(define-data-var manager-active bool true)

(define-map authorized-sources principal bool)

;; Alert subscriptions
(define-map subscriptions principal
  {
    min-level: uint,
    protocols: (list 10 principal),
    active: bool,
    subscribed-at: uint,
    alert-count: uint
  }
)

;; Alert log
(define-map alerts uint
  {
    source: principal,
    protocol: (optional principal),
    level: uint,
    category: (string-ascii 30),
    message: (string-ascii 200),
    raised-at: uint,
    acknowledged: bool,
    acknowledged-by: (optional principal),
    resolved: bool
  }
)

;; Escalation rules
(define-map escalation-rules (string-ascii 30)
  {
    auto-escalate: bool,
    escalate-after-blocks: uint,
    escalate-to-level: uint
  }
)

;; Read-only
(define-read-only (get-alert (alert-id uint))
  (map-get? alerts alert-id)
)

(define-read-only (get-subscription (subscriber principal))
  (map-get? subscriptions subscriber)
)

(define-read-only (get-alert-count)
  (var-get alert-count)
)

(define-read-only (is-source (source principal))
  (default-to false (map-get? authorized-sources source))
)

(define-read-only (is-manager-active)
  (var-get manager-active)
)

;; Public functions
(define-public (add-source (source principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (map-set authorized-sources source true)
    (ok source)
  )
)

(define-public (subscribe (min-level uint) (protocols (list 10 principal)))
  (begin
    (asserts! (and (>= min-level LEVEL-INFO) (<= min-level LEVEL-EMERGENCY)) err-invalid-level)
    (map-set subscriptions tx-sender {
      min-level: min-level,
      protocols: protocols,
      active: true,
      subscribed-at: stacks-block-height,
      alert-count: u0
    })
    (var-set subscription-count (+ (var-get subscription-count) u1))
    (ok { subscriber: tx-sender, min-level: min-level })
  )
)

(define-public (unsubscribe)
  (match (map-get? subscriptions tx-sender)
    sub
    (begin
      (map-set subscriptions tx-sender (merge sub { active: false }))
      (ok true)
    )
    err-not-found
  )
)

(define-public (raise-alert
    (protocol (optional principal))
    (level uint)
    (category (string-ascii 30))
    (message (string-ascii 200)))
  (let ((alert-id (var-get alert-count)))
    (asserts! (is-source tx-sender) err-not-authorized)
    (asserts! (var-get manager-active) err-not-authorized)
    (asserts! (and (>= level LEVEL-INFO) (<= level LEVEL-EMERGENCY)) err-invalid-level)

    (map-set alerts alert-id {
      source: tx-sender,
      protocol: protocol,
      level: level,
      category: category,
      message: message,
      raised-at: stacks-block-height,
      acknowledged: false,
      acknowledged-by: none,
      resolved: false
    })

    (var-set alert-count (+ alert-id u1))
    (ok { alert-id: alert-id, level: level })
  )
)

(define-public (acknowledge-alert (alert-id uint))
  (match (map-get? alerts alert-id)
    alert
    (begin
      (asserts! (is-source tx-sender) err-not-authorized)
      (map-set alerts alert-id (merge alert {
        acknowledged: true,
        acknowledged-by: (some tx-sender)
      }))
      (ok alert-id)
    )
    err-not-found
  )
)

(define-public (resolve-alert (alert-id uint))
  (match (map-get? alerts alert-id)
    alert
    (begin
      (asserts! (is-source tx-sender) err-not-authorized)
      (map-set alerts alert-id (merge alert { resolved: true }))
      (ok alert-id)
    )
    err-not-found
  )
)

(define-public (set-escalation-rule
    (category (string-ascii 30))
    (auto-escalate bool)
    (escalate-after-blocks uint)
    (escalate-to-level uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (map-set escalation-rules category {
      auto-escalate: auto-escalate,
      escalate-after-blocks: escalate-after-blocks,
      escalate-to-level: escalate-to-level
    })
    (ok category)
  )
)

(define-public (toggle-manager (active bool))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (var-set manager-active active)
    (ok active)
  )
)
