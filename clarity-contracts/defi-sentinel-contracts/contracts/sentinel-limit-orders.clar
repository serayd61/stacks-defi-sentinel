;; ============================================================
;; SENTINEL LIMIT ORDERS - On-Chain DEX Limit Order Book
;; ============================================================
;; Users place buy/sell orders at specific price levels.
;; Keepers earn fees by executing orders.
;; ============================================================

;; ============================================================
;; CONSTANTS
;; ============================================================

(define-constant contract-owner tx-sender)
(define-constant err-owner-only            (err u100))
(define-constant err-invalid-amount        (err u101))
(define-constant err-invalid-price         (err u102))
(define-constant err-order-not-found       (err u103))
(define-constant err-order-not-open        (err u104))
(define-constant err-not-order-owner       (err u105))
(define-constant err-price-not-met         (err u106))
(define-constant err-insufficient-balance  (err u107))
(define-constant err-invalid-order-type    (err u108))
(define-constant err-contract-paused       (err u109))
(define-constant err-slippage-exceeded     (err u110))
(define-constant err-zero-address          (err u111))

;; Order types
(define-constant ORDER-TYPE-BUY  u0)  ;; Buy SNTL with STX
(define-constant ORDER-TYPE-SELL u1)  ;; Sell SNTL, receive STX

;; Order statuses
(define-constant STATUS-OPEN      u0)
(define-constant STATUS-FILLED    u1)
(define-constant STATUS-CANCELLED u2)
(define-constant STATUS-EXPIRED   u3)

;; Fee: 0.3% = 30 basis points
(define-constant FEE-NUMERATOR   u30)
(define-constant FEE-DENOMINATOR u10000)

;; Keeper fee: 10% of order fill fee goes to keeper
(define-constant KEEPER-SHARE u10)
(define-constant KEEPER-SHARE-DENOM u100)

;; Minimum order amount: 1 STX (1_000_000 micro-STX)
(define-constant MIN-ORDER-STX u1000000)

;; Maximum order expiry: 52560 blocks (~1 year)
(define-constant MAX-EXPIRY-BLOCKS u52560)

;; ============================================================
;; DATA STRUCTURES
;; ============================================================

(define-data-var next-order-id uint u1)
(define-data-var total-orders uint u0)
(define-data-var total-volume-stx uint u0)
(define-data-var total-fees-collected uint u0)
(define-data-var is-paused bool false)
(define-data-var treasury-address principal contract-owner)

;; Order records
(define-map orders uint {
  owner: principal,
  order-type: uint,           ;; 0=buy, 1=sell
  status: uint,               ;; 0=open, 1=filled, 2=cancelled, 3=expired
  target-price: uint,         ;; Desired STX price per 1 SNTL (micro-STX, 6 decimals)
  amount-in: uint,            ;; Amount sent (buy=STX, sell=SNTL)
  amount-out-min: uint,       ;; Minimum amount to receive (slippage protection)
  amount-filled: uint,        ;; How much has been filled
  created-at: uint,           ;; Creation block
  expires-at: uint,           ;; Expiration block
  filled-at: uint,            ;; Fill block
  filled-by: (optional principal),  ;; Who executed the order
  fee-paid: uint              ;; Fee paid
})

;; Per-user order list (max 50 open orders)
(define-map user-order-count principal uint)

;; Open order index (for keepers to scan)
(define-map open-orders-by-price uint uint)  ;; price -> order-id (simple index)
(define-data-var open-order-count uint u0)

;; Keeper statistics
(define-map keeper-stats principal {
  executions: uint,
  total-earned: uint,
  last-execution: uint
})

;; ============================================================
;; PRIVATE FUNCTIONS
;; ============================================================

(define-private (calculate-fee (amount uint))
  (/ (* amount FEE-NUMERATOR) FEE-DENOMINATOR)
)

(define-private (calculate-keeper-fee (fee uint))
  (/ (* fee KEEPER-SHARE) KEEPER-SHARE-DENOM)
)

(define-private (get-order-count (user principal))
  (default-to u0 (map-get? user-order-count user))
)

(define-private (increment-order-count (user principal))
  (map-set user-order-count user (+ (get-order-count user) u1))
)

(define-private (decrement-order-count (user principal))
  (let ((count (get-order-count user)))
    (map-set user-order-count user (if (> count u0) (- count u1) u0))
  )
)

;; ============================================================
;; PUBLIC FUNCTIONS - ORDER MANAGEMENT
;; ============================================================

;; BUY ORDER: Lock STX, buy SNTL at specific price
;; amount-stx: Amount of STX to spend
;; target-price: Max STX to pay per 1 SNTL (micro-STX)
;; min-sntl-out: Minimum SNTL amount to receive
;; expiry-blocks: Number of blocks until expiry
(define-public (place-buy-order
  (amount-stx uint)
  (target-price uint)
  (min-sntl-out uint)
  (expiry-blocks uint))
  (let (
    (order-id (var-get next-order-id))
    (expire-block (+ stacks-block-height expiry-blocks))
    (fee (calculate-fee amount-stx))
    (net-amount (- amount-stx fee))
  )
    ;; Validations
    (asserts! (not (var-get is-paused)) err-contract-paused)
    (asserts! (>= amount-stx MIN-ORDER-STX) err-invalid-amount)
    (asserts! (> target-price u0) err-invalid-price)
    (asserts! (> min-sntl-out u0) err-invalid-amount)
    (asserts! (<= expiry-blocks MAX-EXPIRY-BLOCKS) err-invalid-price)
    (asserts! (>= (stx-get-balance tx-sender) amount-stx) err-insufficient-balance)

    ;; Lock STX in contract
    (try! (stx-transfer? amount-stx tx-sender (as-contract tx-sender)))

    ;; Save the order
    (map-set orders order-id {
      owner: tx-sender,
      order-type: ORDER-TYPE-BUY,
      status: STATUS-OPEN,
      target-price: target-price,
      amount-in: amount-stx,
      amount-out-min: min-sntl-out,
      amount-filled: u0,
      created-at: stacks-block-height,
      expires-at: expire-block,
      filled-at: u0,
      filled-by: none,
      fee-paid: u0
    })

    ;; Update counters
    (var-set next-order-id (+ order-id u1))
    (var-set total-orders (+ (var-get total-orders) u1))
    (var-set open-order-count (+ (var-get open-order-count) u1))
    (increment-order-count tx-sender)

    (print {
      event: "buy-order-placed",
      order-id: order-id,
      owner: tx-sender,
      amount-stx: amount-stx,
      target-price: target-price,
      min-sntl-out: min-sntl-out,
      expires-at: expire-block
    })

    (ok order-id)
  )
)

;; SELL ORDER: Lock SNTL, sell for STX at specific price
;; amount-sntl: Amount of SNTL to sell
;; target-price: Min STX to receive per 1 SNTL (micro-STX)
;; min-stx-out: Minimum STX amount to receive
;; expiry-blocks: Number of blocks until expiry
(define-public (place-sell-order
  (amount-sntl uint)
  (target-price uint)
  (min-stx-out uint)
  (expiry-blocks uint))
  (let (
    (order-id (var-get next-order-id))
    (expire-block (+ stacks-block-height expiry-blocks))
  )
    ;; Validations
    (asserts! (not (var-get is-paused)) err-contract-paused)
    (asserts! (> amount-sntl u0) err-invalid-amount)
    (asserts! (> target-price u0) err-invalid-price)
    (asserts! (> min-stx-out u0) err-invalid-amount)
    (asserts! (<= expiry-blocks MAX-EXPIRY-BLOCKS) err-invalid-price)

    ;; Lock SNTL in contract
    (try! (contract-call? .sentinel-token transfer
      amount-sntl tx-sender (as-contract tx-sender) none))

    ;; Save the order
    (map-set orders order-id {
      owner: tx-sender,
      order-type: ORDER-TYPE-SELL,
      status: STATUS-OPEN,
      target-price: target-price,
      amount-in: amount-sntl,
      amount-out-min: min-stx-out,
      amount-filled: u0,
      created-at: stacks-block-height,
      expires-at: expire-block,
      filled-at: u0,
      filled-by: none,
      fee-paid: u0
    })

    ;; Update counters
    (var-set next-order-id (+ order-id u1))
    (var-set total-orders (+ (var-get total-orders) u1))
    (var-set open-order-count (+ (var-get open-order-count) u1))
    (increment-order-count tx-sender)

    (print {
      event: "sell-order-placed",
      order-id: order-id,
      owner: tx-sender,
      amount-sntl: amount-sntl,
      target-price: target-price,
      min-stx-out: min-stx-out,
      expires-at: expire-block
    })

    (ok order-id)
  )
)

;; EXECUTE BUY ORDER: Keeper calls this; fills if current price meets target
;; order-id: Order to execute
;; current-price: Current price of 1 SNTL in micro-STX (from oracle)
;; sntl-amount: Amount of SNTL the keeper will provide
(define-public (execute-buy-order (order-id uint) (current-price uint) (sntl-amount uint))
  (let (
    (order (unwrap! (map-get? orders order-id) err-order-not-found))
    (keeper tx-sender)
    (order-owner (get owner order))
    (target-price (get target-price order))
    (amount-stx (get amount-in order))
    (min-sntl-out (get amount-out-min order))
    (fee (calculate-fee amount-stx))
    (keeper-fee (calculate-keeper-fee fee))
    (treasury-fee (- fee keeper-fee))
    (net-stx (- amount-stx fee))
  )
    ;; Validations
    (asserts! (not (var-get is-paused)) err-contract-paused)
    (asserts! (is-eq (get status order) STATUS-OPEN) err-order-not-open)
    (asserts! (is-eq (get order-type order) ORDER-TYPE-BUY) err-invalid-order-type)
    (asserts! (< (stacks-block-height) (get expires-at order)) err-order-not-open)
    ;; Price check: current price must be <= target price (for buy)
    (asserts! (<= current-price target-price) err-price-not-met)
    ;; Slippage check
    (asserts! (>= sntl-amount min-sntl-out) err-slippage-exceeded)

    ;; Keeper sends SNTL to order owner
    (try! (contract-call? .sentinel-token transfer
      sntl-amount keeper order-owner none))

    ;; Send STX from contract to keeper (net_stx - keeper_fee)
    (try! (as-contract (stx-transfer? (- net-stx keeper-fee) tx-sender keeper)))
    ;; Send treasury fee
    (try! (as-contract (stx-transfer? treasury-fee tx-sender (var-get treasury-address))))
    ;; Send keeper fee
    ;; (keeper already received net_stx - treasury_fee)

    ;; Update order
    (map-set orders order-id (merge order {
      status: STATUS-FILLED,
      amount-filled: sntl-amount,
      filled-at: stacks-block-height,
      filled-by: (some keeper),
      fee-paid: fee
    }))

    ;; Update keeper statistics
    (let ((k-stats (default-to { executions: u0, total-earned: u0, last-execution: u0 }
                   (map-get? keeper-stats keeper))))
      (map-set keeper-stats keeper {
        executions: (+ (get executions k-stats) u1),
        total-earned: (+ (get total-earned k-stats) keeper-fee),
        last-execution: stacks-block-height
      })
    )

    ;; Global statistics
    (var-set total-volume-stx (+ (var-get total-volume-stx) amount-stx))
    (var-set total-fees-collected (+ (var-get total-fees-collected) fee))
    (var-set open-order-count (- (var-get open-order-count) u1))
    (decrement-order-count order-owner)

    (print {
      event: "buy-order-executed",
      order-id: order-id,
      keeper: keeper,
      owner: order-owner,
      sntl-received: sntl-amount,
      stx-spent: amount-stx,
      fee-paid: fee,
      keeper-fee: keeper-fee
    })

    (ok { order-id: order-id, sntl-amount: sntl-amount, stx-amount: amount-stx, fee: fee })
  )
)

;; EXECUTE SELL ORDER: Keeper fills if current price meets target
(define-public (execute-sell-order (order-id uint) (current-price uint) (stx-amount uint))
  (let (
    (order (unwrap! (map-get? orders order-id) err-order-not-found))
    (keeper tx-sender)
    (order-owner (get owner order))
    (target-price (get target-price order))
    (amount-sntl (get amount-in order))
    (min-stx-out (get amount-out-min order))
    (fee (calculate-fee stx-amount))
    (keeper-fee (calculate-keeper-fee fee))
    (treasury-fee (- fee keeper-fee))
    (net-stx (- stx-amount fee))
  )
    ;; Validations
    (asserts! (not (var-get is-paused)) err-contract-paused)
    (asserts! (is-eq (get status order) STATUS-OPEN) err-order-not-open)
    (asserts! (is-eq (get order-type order) ORDER-TYPE-SELL) err-invalid-order-type)
    (asserts! (< stacks-block-height (get expires-at order)) err-order-not-open)
    ;; Price check: current price must be >= target price (for sell)
    (asserts! (>= current-price target-price) err-price-not-met)
    ;; Slippage check
    (asserts! (>= net-stx min-stx-out) err-slippage-exceeded)
    ;; Does keeper have enough STX?
    (asserts! (>= (stx-get-balance keeper) stx-amount) err-insufficient-balance)

    ;; Keeper sends STX to order owner (net)
    (try! (stx-transfer? net-stx keeper order-owner))
    ;; Treasury fee
    (try! (stx-transfer? treasury-fee keeper (var-get treasury-address)))

    ;; Send SNTL from contract to keeper
    (try! (as-contract (contract-call? .sentinel-token transfer
      amount-sntl tx-sender keeper none)))

    ;; Extra SNTL reward for keeper (incentive)
    ;; Could convert keeper_fee STX to SNTL but keeping it simple

    ;; Update order
    (map-set orders order-id (merge order {
      status: STATUS-FILLED,
      amount-filled: stx-amount,
      filled-at: stacks-block-height,
      filled-by: (some keeper),
      fee-paid: fee
    }))

    ;; Keeper stats
    (let ((k-stats (default-to { executions: u0, total-earned: u0, last-execution: u0 }
                   (map-get? keeper-stats keeper))))
      (map-set keeper-stats keeper {
        executions: (+ (get executions k-stats) u1),
        total-earned: (+ (get total-earned k-stats) keeper-fee),
        last-execution: stacks-block-height
      })
    )

    (var-set total-volume-stx (+ (var-get total-volume-stx) stx-amount))
    (var-set total-fees-collected (+ (var-get total-fees-collected) fee))
    (var-set open-order-count (- (var-get open-order-count) u1))
    (decrement-order-count order-owner)

    (print {
      event: "sell-order-executed",
      order-id: order-id,
      keeper: keeper,
      owner: order-owner,
      sntl-sold: amount-sntl,
      stx-received: net-stx,
      fee-paid: fee
    })

    (ok { order-id: order-id, sntl-amount: amount-sntl, stx-amount: stx-amount, fee: fee })
  )
)

;; CANCEL ORDER: Only the order owner can cancel
(define-public (cancel-order (order-id uint))
  (let (
    (order (unwrap! (map-get? orders order-id) err-order-not-found))
  )
    (asserts! (is-eq tx-sender (get owner order)) err-not-order-owner)
    (asserts! (is-eq (get status order) STATUS-OPEN) err-order-not-open)

    ;; Refund locked tokens
    (if (is-eq (get order-type order) ORDER-TYPE-BUY)
      ;; Refund STX
      (try! (as-contract (stx-transfer? (get amount-in order) tx-sender (get owner order))))
      ;; Refund SNTL
      (try! (as-contract (contract-call? .sentinel-token transfer
        (get amount-in order) tx-sender (get owner order) none)))
    )

    ;; Mark order as cancelled
    (map-set orders order-id (merge order { status: STATUS-CANCELLED }))
    (var-set open-order-count (- (var-get open-order-count) u1))
    (decrement-order-count (get owner order))

    (print {
      event: "order-cancelled",
      order-id: order-id,
      owner: (get owner order),
      refunded: (get amount-in order)
    })

    (ok true)
  )
)

;; EXPIRE INTERACTION: Clean up expired orders
(define-public (expire-order (order-id uint))
  (let (
    (order (unwrap! (map-get? orders order-id) err-order-not-found))
  )
    (asserts! (is-eq (get status order) STATUS-OPEN) err-order-not-open)
    (asserts! (>= stacks-block-height (get expires-at order)) err-order-not-open)

    ;; Refund tokens
    (if (is-eq (get order-type order) ORDER-TYPE-BUY)
      (try! (as-contract (stx-transfer? (get amount-in order) tx-sender (get owner order))))
      (try! (as-contract (contract-call? .sentinel-token transfer
        (get amount-in order) tx-sender (get owner order) none)))
    )

    (map-set orders order-id (merge order { status: STATUS-EXPIRED }))
    (var-set open-order-count (- (var-get open-order-count) u1))
    (decrement-order-count (get owner order))

    (print {
      event: "order-expired",
      order-id: order-id,
      owner: (get owner order)
    })

    (ok true)
  )
)

;; ============================================================
;; READ-ONLY FUNCTIONS
;; ============================================================

(define-read-only (get-order (order-id uint))
  (map-get? orders order-id)
)

(define-read-only (get-user-order-count (user principal))
  (default-to u0 (map-get? user-order-count user))
)

(define-read-only (get-keeper-stats (keeper principal))
  (default-to { executions: u0, total-earned: u0, last-execution: u0 }
    (map-get? keeper-stats keeper))
)

(define-read-only (get-platform-stats)
  {
    total-orders: (var-get total-orders),
    open-orders: (var-get open-order-count),
    total-volume-stx: (var-get total-volume-stx),
    total-fees-collected: (var-get total-fees-collected),
    next-order-id: (var-get next-order-id),
    is-paused: (var-get is-paused),
    fee-rate-bps: FEE-NUMERATOR
  }
)

(define-read-only (is-order-fillable (order-id uint) (current-price uint))
  (match (map-get? orders order-id)
    order (and
      (is-eq (get status order) STATUS-OPEN)
      (< stacks-block-height (get expires-at order))
      (if (is-eq (get order-type order) ORDER-TYPE-BUY)
        (<= current-price (get target-price order))
        (>= current-price (get target-price order))
      )
    )
    false
  )
)

;; ============================================================
;; ADMIN FUNCTIONS
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
    (var-set treasury-address new-treasury)
    (ok true)
  )
)
