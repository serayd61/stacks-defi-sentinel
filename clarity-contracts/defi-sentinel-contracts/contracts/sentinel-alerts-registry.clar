;; ============================================================
;; SENTINEL ALERTS REGISTRY - On-Chain Price Alert System
;; ============================================================
;; Users register alerts for specific price conditions.
;; Keepers trigger alerts when conditions are met and
;; earn SNTL rewards. STX deposit is required per alert.
;; ============================================================

;; ============================================================
;; CONSTANTS
;; ============================================================

(define-constant contract-owner tx-sender)
(define-constant err-owner-only           (err u100))
(define-constant err-alert-not-found      (err u101))
(define-constant err-alert-not-active     (err u102))
(define-constant err-not-alert-owner      (err u103))
(define-constant err-condition-not-met    (err u104))
(define-constant err-insufficient-deposit (err u105))
(define-constant err-invalid-amount       (err u106))
(define-constant err-contract-paused      (err u107))
(define-constant err-invalid-condition    (err u108))
(define-constant err-alert-expired        (err u109))
(define-constant err-max-alerts-reached   (err u110))
(define-constant err-cooldown-active      (err u111))

;; Alert condition types
(define-constant COND-PRICE-ABOVE  u0)   ;; Price rises above X
(define-constant COND-PRICE-BELOW  u1)   ;; Price drops below X
(define-constant COND-PRICE-CHANGE u2)   ;; Price changes by X%
(define-constant COND-VOLUME-ABOVE u3)   ;; 24h volume exceeds X
(define-constant COND-WHALE-TX     u4)   ;; Transfer larger than X occurs

;; Alert token types
(define-constant TOKEN-STX  u0)
(define-constant TOKEN-SNTL u1)
(define-constant TOKEN-SBTC u2)

;; Minimum deposit: 0.5 STX (for keeper reward)
(define-constant MIN-DEPOSIT-STX u500000)

;; Keeper reward: 80% of deposit
(define-constant KEEPER-REWARD-RATE u80)
(define-constant RATE-DENOMINATOR u100)

;; Protocol fee: 20% of deposit
(define-constant PROTOCOL-FEE-RATE u20)

;; Max alerts per user
(define-constant MAX-USER-ALERTS u50)

;; Alert cooldown (for re-triggering the same alert)
(define-constant ALERT-COOLDOWN-BLOCKS u144)  ;; ~1 day

;; Max expiry: 365 days
(define-constant MAX-EXPIRY-BLOCKS u52560)

;; ============================================================
;; DATA STRUCTURES
;; ============================================================

(define-data-var next-alert-id uint u1)
(define-data-var total-alerts uint u0)
(define-data-var total-active-alerts uint u0)
(define-data-var total-triggered uint u0)
(define-data-var total-keeper-rewards uint u0)
(define-data-var is-paused bool false)
(define-data-var treasury principal contract-owner)

;; Price alert record
(define-map alerts uint {
  owner: principal,
  token: uint,                       ;; 0=STX, 1=SNTL, 2=sBTC
  condition: uint,                   ;; 0=above, 1=below, 2=change, 3=volume, 4=whale
  threshold: uint,                   ;; Threshold value (micro-STX or %)
  repeat: bool,                      ;; Is it repeatable?
  cooldown-until: uint,              ;; Block until which re-triggering is disabled
  status: uint,                      ;; 0=active, 1=triggered, 2=cancelled, 3=expired
  deposit: uint,                     ;; Locked STX (for keeper reward)
  created-at: uint,
  expires-at: uint,
  last-triggered-at: uint,
  trigger-count: uint,               ;; How many times triggered
  webhook-url: (optional (string-utf8 200)),   ;; Notification URL (off-chain)
  note: (string-utf8 100)            ;; User note
})

;; User alert count
(define-map user-alert-count principal uint)

;; User alert index
(define-map user-alerts { user: principal, index: uint } uint)  ;; index -> alert-id

;; Keeper statistics
(define-map keeper-leaderboard principal {
  triggers: uint,
  total-earned-stx: uint,
  last-trigger-block: uint,
  success-rate: uint    ;; 0-100
})

;; Trigger history
(define-map trigger-history { alert-id: uint, trigger-index: uint } {
  keeper: principal,
  price-at-trigger: uint,
  reward-paid: uint,
  triggered-at: uint
})

(define-map alert-trigger-count uint uint)  ;; alert-id -> trigger count

;; ============================================================
;; PRIVATE FUNCTIONS
;; ============================================================

(define-private (get-user-alert-count (user principal))
  (default-to u0 (map-get? user-alert-count user))
)

(define-private (check-condition (condition uint) (threshold uint) (current-value uint) (previous-value uint))
  (if (is-eq condition COND-PRICE-ABOVE)
    (>= current-value threshold)
    (if (is-eq condition COND-PRICE-BELOW)
      (<= current-value threshold)
      (if (is-eq condition COND-PRICE-CHANGE)
        ;; X% change: |current - previous| / previous * 100 >= threshold
        (let (
          (diff (if (>= current-value previous-value)
            (- current-value previous-value)
            (- previous-value current-value)
          ))
          (change-pct (if (> previous-value u0)
            (/ (* diff u100) previous-value)
            u0
          ))
        )
          (>= change-pct threshold)
        )
        (if (is-eq condition COND-VOLUME-ABOVE)
          (>= current-value threshold)
          (if (is-eq condition COND-WHALE-TX)
            (>= current-value threshold)
            false  ;; Unknown condition
          )
        )
      )
    )
  )
)

;; ============================================================
;; PUBLIC FUNCTIONS - ALERT MANAGEMENT
;; ============================================================

;; CREATE ALERT
;; token: Token to monitor (0=STX, 1=SNTL, 2=sBTC)
;; condition: Trigger condition (0-4)
;; threshold: Threshold value
;; repeat: Should it re-trigger?
;; expiry-blocks: How long the alert stays active
;; deposit-stx: STX to be locked for keeper reward
;; webhook-url: Notification URL (optional, off-chain)
;; note: Personal note
(define-public (create-alert
  (token uint)
  (condition uint)
  (threshold uint)
  (repeat bool)
  (expiry-blocks uint)
  (deposit-stx uint)
  (webhook-url (optional (string-utf8 200)))
  (note (string-utf8 100)))
  (let (
    (user tx-sender)
    (alert-id (var-get next-alert-id))
    (user-count (get-user-alert-count user))
    (expire-block (+ stacks-block-height expiry-blocks))
  )
    (asserts! (not (var-get is-paused)) err-contract-paused)
    (asserts! (< user-count MAX-USER-ALERTS) err-max-alerts-reached)
    (asserts! (>= deposit-stx MIN-DEPOSIT-STX) err-insufficient-deposit)
    (asserts! (<= expiry-blocks MAX-EXPIRY-BLOCKS) err-alert-expired)
    (asserts! (> threshold u0) err-invalid-amount)
    (asserts! (<= condition u4) err-invalid-condition)
    (asserts! (<= token u2) err-invalid-condition)
    (asserts! (>= (stx-get-balance user) deposit-stx) err-insufficient-deposit)

    ;; Lock the deposit
    (try! (stx-transfer? deposit-stx user (as-contract tx-sender)))

    ;; Save the alert
    (map-set alerts alert-id {
      owner: user,
      token: token,
      condition: condition,
      threshold: threshold,
      repeat: repeat,
      cooldown-until: u0,
      status: u0,  ;; active
      deposit: deposit-stx,
      created-at: stacks-block-height,
      expires-at: expire-block,
      last-triggered-at: u0,
      trigger-count: u0,
      webhook-url: webhook-url,
      note: note
    })

    ;; Update user index
    (map-set user-alerts { user: user, index: user-count } alert-id)
    (map-set user-alert-count user (+ user-count u1))
    (map-set alert-trigger-count alert-id u0)

    ;; Global counters
    (var-set next-alert-id (+ alert-id u1))
    (var-set total-alerts (+ (var-get total-alerts) u1))
    (var-set total-active-alerts (+ (var-get total-active-alerts) u1))

    (print {
      event: "alert-created",
      alert-id: alert-id,
      owner: user,
      token: token,
      condition: condition,
      threshold: threshold,
      repeat: repeat,
      deposit: deposit-stx,
      expires-at: expire-block
    })

    (ok alert-id)
  )
)

;; TRIGGER ALERT (Called by keeper)
;; alert-id: Alert to trigger
;; current-value: Current value (price/volume)
;; previous-value: Previous value (for % change calculation)
(define-public (trigger-alert (alert-id uint) (current-value uint) (previous-value uint))
  (let (
    (keeper tx-sender)
    (alert (unwrap! (map-get? alerts alert-id) err-alert-not-found))
  )
    (asserts! (not (var-get is-paused)) err-contract-paused)
    (asserts! (is-eq (get status alert) u0) err-alert-not-active)
    (asserts! (< stacks-block-height (get expires-at alert)) err-alert-expired)
    (asserts! (>= stacks-block-height (get cooldown-until alert)) err-cooldown-active)

    ;; Condition check
    (asserts! (check-condition
      (get condition alert)
      (get threshold alert)
      current-value
      previous-value
    ) err-condition-not-met)

    (let (
      (deposit (get deposit alert))
      (keeper-reward (/ (* deposit KEEPER-REWARD-RATE) RATE-DENOMINATOR))
      (protocol-fee (/ (* deposit PROTOCOL-FEE-RATE) RATE-DENOMINATOR))
      (trigger-index (default-to u0 (map-get? alert-trigger-count alert-id)))
    )
      ;; Send reward to keeper
      (try! (as-contract (stx-transfer? keeper-reward tx-sender keeper)))
      ;; Send protocol fee to treasury
      (try! (as-contract (stx-transfer? protocol-fee tx-sender (var-get treasury))))

      ;; Record trigger history
      (map-set trigger-history { alert-id: alert-id, trigger-index: trigger-index } {
        keeper: keeper,
        price-at-trigger: current-value,
        reward-paid: keeper-reward,
        triggered-at: stacks-block-height
      })
      (map-set alert-trigger-count alert-id (+ trigger-index u1))

      ;; Update alert status
      (if (get repeat alert)
        ;; Repeatable: set cooldown and reset deposit
        (map-set alerts alert-id (merge alert {
          status: u0,  ;; Still active
          cooldown-until: (+ stacks-block-height ALERT-COOLDOWN-BLOCKS),
          last-triggered-at: stacks-block-height,
          trigger-count: (+ (get trigger-count alert) u1),
          deposit: u0  ;; Deposit used
        }))
        ;; One-time: completed
        (begin
          (map-set alerts alert-id (merge alert {
            status: u1,  ;; triggered
            last-triggered-at: stacks-block-height,
            trigger-count: u1,
            deposit: u0
          }))
          (var-set total-active-alerts (- (var-get total-active-alerts) u1))
        )
      )

      ;; Update keeper leaderboard
      (let ((k-stats (default-to
          { triggers: u0, total-earned-stx: u0, last-trigger-block: u0, success-rate: u100 }
          (map-get? keeper-leaderboard keeper))))
        (map-set keeper-leaderboard keeper {
          triggers: (+ (get triggers k-stats) u1),
          total-earned-stx: (+ (get total-earned-stx k-stats) keeper-reward),
          last-trigger-block: stacks-block-height,
          success-rate: u100
        })
      )

      (var-set total-triggered (+ (var-get total-triggered) u1))
      (var-set total-keeper-rewards (+ (var-get total-keeper-rewards) keeper-reward))

      (print {
        event: "alert-triggered",
        alert-id: alert-id,
        keeper: keeper,
        owner: (get alert owner),
        current-value: current-value,
        threshold: (get threshold alert),
        keeper-reward: keeper-reward,
        trigger-count: (+ (get trigger-count alert) u1)
      })

      (ok { keeper-reward: keeper-reward, alert-id: alert-id })
    )
  )
)

;; CANCEL ALERT (Deposit is refunded)
(define-public (cancel-alert (alert-id uint))
  (let (
    (user tx-sender)
    (alert (unwrap! (map-get? alerts alert-id) err-alert-not-found))
  )
    (asserts! (is-eq user (get owner alert)) err-not-alert-owner)
    (asserts! (is-eq (get status alert) u0) err-alert-not-active)

    ;; Refund remaining deposit
    (if (> (get deposit alert) u0)
      (try! (as-contract (stx-transfer? (get deposit alert) tx-sender user)))
      true
    )

    (map-set alerts alert-id (merge alert { status: u2, deposit: u0 }))  ;; cancelled
    (var-set total-active-alerts (- (var-get total-active-alerts) u1))

    (print {
      event: "alert-cancelled",
      alert-id: alert-id,
      owner: user,
      refund: (get deposit alert)
    })

    (ok (get deposit alert))
  )
)

;; REFILL ALERT (Add deposit - for repeating alerts)
(define-public (refill-alert (alert-id uint) (additional-deposit uint))
  (let (
    (user tx-sender)
    (alert (unwrap! (map-get? alerts alert-id) err-alert-not-found))
  )
    (asserts! (is-eq user (get owner alert)) err-not-alert-owner)
    (asserts! (get repeat alert) err-alert-not-active)
    (asserts! (>= additional-deposit MIN-DEPOSIT-STX) err-insufficient-deposit)
    (asserts! (>= (stx-get-balance user) additional-deposit) err-insufficient-deposit)

    (try! (stx-transfer? additional-deposit user (as-contract tx-sender)))

    (map-set alerts alert-id (merge alert {
      deposit: (+ (get deposit alert) additional-deposit),
      status: u0,
      expires-at: (+ (get expires-at alert) (* ALERT-COOLDOWN-BLOCKS u10))
    }))

    (print { event: "alert-refilled", alert-id: alert-id, deposit: additional-deposit })

    (ok true)
  )
)

;; CLEAN UP EXPIRED ALERT
(define-public (expire-alert (alert-id uint))
  (let (
    (alert (unwrap! (map-get? alerts alert-id) err-alert-not-found))
    (caller tx-sender)
  )
    (asserts! (is-eq (get status alert) u0) err-alert-not-active)
    (asserts! (>= stacks-block-height (get expires-at alert)) err-alert-not-active)

    ;; Refund remaining deposit
    (if (> (get deposit alert) u0)
      (try! (as-contract (stx-transfer? (get deposit alert) tx-sender (get owner alert))))
      true
    )

    (map-set alerts alert-id (merge alert { status: u3, deposit: u0 }))  ;; expired
    (var-set total-active-alerts (- (var-get total-active-alerts) u1))

    (print { event: "alert-expired", alert-id: alert-id })

    (ok true)
  )
)

;; ============================================================
;; READ-ONLY FUNCTIONS
;; ============================================================

(define-read-only (get-alert (alert-id uint))
  (map-get? alerts alert-id)
)

(define-read-only (get-user-alerts-count (user principal))
  (default-to u0 (map-get? user-alert-count user))
)

(define-read-only (get-user-alert-at (user principal) (index uint))
  (match (map-get? user-alerts { user: user, index: index })
    alert-id (map-get? alerts alert-id)
    none
  )
)

(define-read-only (get-trigger-history (alert-id uint) (trigger-index uint))
  (map-get? trigger-history { alert-id: alert-id, trigger-index: trigger-index })
)

(define-read-only (get-keeper-stats (keeper principal))
  (default-to
    { triggers: u0, total-earned-stx: u0, last-trigger-block: u0, success-rate: u0 }
    (map-get? keeper-leaderboard keeper))
)

(define-read-only (get-registry-stats)
  {
    total-alerts: (var-get total-alerts),
    active-alerts: (var-get total-active-alerts),
    total-triggered: (var-get total-triggered),
    total-keeper-rewards: (var-get total-keeper-rewards),
    is-paused: (var-get is-paused)
  }
)

(define-read-only (is-alert-triggerable (alert-id uint) (current-value uint) (previous-value uint))
  (match (map-get? alerts alert-id)
    alert (and
      (is-eq (get status alert) u0)
      (< stacks-block-height (get expires-at alert))
      (>= stacks-block-height (get cooldown-until alert))
      (check-condition (get condition alert) (get threshold alert) current-value previous-value)
    )
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

(define-public (set-treasury (new-treasury principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (var-set treasury new-treasury)
    (ok true)
  )
)
