;; DeFi Index Fund v1 Contract
;; Weighted index of DeFi protocols with rebalancing,
;; share tracking (deposit/withdraw), and NAV calculation
;; Part of the Stacks DeFi Sentinel suite

(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u800))
(define-constant err-not-authorized (err u801))
(define-constant err-not-found (err u802))
(define-constant err-invalid-weight (err u803))
(define-constant err-invalid-amount (err u804))
(define-constant err-insufficient-shares (err u805))
(define-constant err-index-full (err u806))

;; Max 20 protocols in the index
(define-constant MAX-COMPONENTS u20)
;; Weight must sum to 10000 bps (100%)
(define-constant TOTAL-WEIGHT-BPS u10000)
;; Min deposit: 1 STX
(define-constant MIN-DEPOSIT u1000000)

;; --- Data Variables ---
(define-data-var index-name (string-ascii 50) "DeFi Sentinel Index")
(define-data-var total-assets uint u0)
(define-data-var total-shares uint u0)
(define-data-var component-count uint u0)
(define-data-var nav-per-share uint u1000000) ;; 1:1 initial ratio (microSTX)
(define-data-var last-rebalance uint u0)
(define-data-var rebalance-interval uint u4320) ;; ~30 days in blocks
(define-data-var deposit-count uint u0)
(define-data-var index-paused bool false)

(define-map authorized-managers principal bool)

;; --- Index Components ---
(define-map index-components uint
  {
    protocol: principal,
    protocol-name: (string-ascii 50),
    target-weight-bps: uint,
    current-weight-bps: uint,
    allocated-value: uint,
    last-price: uint,
    active: bool
  }
)

(define-map component-by-protocol principal uint)

;; --- Shareholder Registry ---
(define-map shareholders principal
  {
    shares: uint,
    cost-basis: uint,
    deposit-block: uint,
    last-action-block: uint
  }
)

;; --- Deposit History ---
(define-map deposit-history uint
  {
    depositor: principal,
    action: (string-ascii 10),
    amount: uint,
    shares: uint,
    nav-at-action: uint,
    block-height: uint
  }
)

;; --- NAV Snapshots ---
(define-map nav-history uint
  {
    nav-per-share: uint,
    total-assets: uint,
    total-shares: uint,
    block-height: uint
  }
)

(define-data-var nav-snapshot-count uint u0)

;; --- Read-only Functions ---

(define-read-only (get-index-info)
  {
    name: (var-get index-name),
    total-assets: (var-get total-assets),
    total-shares: (var-get total-shares),
    nav-per-share: (var-get nav-per-share),
    component-count: (var-get component-count),
    last-rebalance: (var-get last-rebalance),
    paused: (var-get index-paused)
  }
)

(define-read-only (get-component (component-id uint))
  (map-get? index-components component-id)
)

(define-read-only (get-shareholder (holder principal))
  (map-get? shareholders holder)
)

(define-read-only (get-share-value (holder principal))
  (match (map-get? shareholders holder)
    holder-data
    (ok (/ (* (get shares holder-data) (var-get nav-per-share)) u1000000))
    err-not-found
  )
)

(define-read-only (get-deposit-record (record-id uint))
  (map-get? deposit-history record-id)
)

(define-read-only (get-nav-snapshot (snapshot-id uint))
  (map-get? nav-history snapshot-id)
)

(define-read-only (is-manager (mgr principal))
  (default-to false (map-get? authorized-managers mgr))
)

(define-read-only (calculate-shares-for-deposit (amount uint))
  (let ((nav (var-get nav-per-share)))
    (if (> nav u0)
      (/ (* amount u1000000) nav)
      amount
    )
  )
)

;; --- Public Functions ---

(define-public (add-manager (mgr principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (map-set authorized-managers mgr true)
    (ok mgr)
  )
)

(define-public (add-component
    (protocol principal)
    (protocol-name (string-ascii 50))
    (target-weight-bps uint)
    (initial-price uint))
  (let (
    (cid (var-get component-count))
  )
    (asserts! (or (is-eq tx-sender contract-owner) (is-manager tx-sender)) err-not-authorized)
    (asserts! (< cid MAX-COMPONENTS) err-index-full)
    (asserts! (and (> target-weight-bps u0) (<= target-weight-bps TOTAL-WEIGHT-BPS)) err-invalid-weight)

    (map-set index-components cid {
      protocol: protocol,
      protocol-name: protocol-name,
      target-weight-bps: target-weight-bps,
      current-weight-bps: u0,
      allocated-value: u0,
      last-price: initial-price,
      active: true
    })
    (map-set component-by-protocol protocol cid)
    (var-set component-count (+ cid u1))

    (ok { component-id: cid, protocol-name: protocol-name, weight-bps: target-weight-bps })
  )
)

(define-public (deposit (amount uint))
  (let (
    (shares-to-mint (calculate-shares-for-deposit amount))
    (did (var-get deposit-count))
    (existing (map-get? shareholders tx-sender))
  )
    (asserts! (not (var-get index-paused)) err-not-authorized)
    (asserts! (>= amount MIN-DEPOSIT) err-invalid-amount)

    ;; Transfer STX to contract
    (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))

    ;; Update or create shareholder record
    (match existing
      holder-data
      (map-set shareholders tx-sender {
        shares: (+ (get shares holder-data) shares-to-mint),
        cost-basis: (+ (get cost-basis holder-data) amount),
        deposit-block: (get deposit-block holder-data),
        last-action-block: stacks-block-height
      })
      (map-set shareholders tx-sender {
        shares: shares-to-mint,
        cost-basis: amount,
        deposit-block: stacks-block-height,
        last-action-block: stacks-block-height
      })
    )

    ;; Record deposit event
    (map-set deposit-history did {
      depositor: tx-sender,
      action: "deposit",
      amount: amount,
      shares: shares-to-mint,
      nav-at-action: (var-get nav-per-share),
      block-height: stacks-block-height
    })

    (var-set total-assets (+ (var-get total-assets) amount))
    (var-set total-shares (+ (var-get total-shares) shares-to-mint))
    (var-set deposit-count (+ did u1))

    (ok { shares-minted: shares-to-mint, total-shares-held: shares-to-mint })
  )
)

(define-public (withdraw (shares-to-burn uint))
  (match (map-get? shareholders tx-sender)
    holder-data
    (let (
      (current-shares (get shares holder-data))
      (payout (/ (* shares-to-burn (var-get nav-per-share)) u1000000))
      (did (var-get deposit-count))
    )
      (asserts! (not (var-get index-paused)) err-not-authorized)
      (asserts! (<= shares-to-burn current-shares) err-insufficient-shares)
      (asserts! (> payout u0) err-invalid-amount)

      ;; Transfer STX back to user
      (try! (as-contract (stx-transfer? payout tx-sender tx-sender)))

      ;; Update shareholder
      (map-set shareholders tx-sender {
        shares: (- current-shares shares-to-burn),
        cost-basis: (get cost-basis holder-data),
        deposit-block: (get deposit-block holder-data),
        last-action-block: stacks-block-height
      })

      ;; Record withdrawal
      (map-set deposit-history did {
        depositor: tx-sender,
        action: "withdraw",
        amount: payout,
        shares: shares-to-burn,
        nav-at-action: (var-get nav-per-share),
        block-height: stacks-block-height
      })

      (var-set total-assets (- (var-get total-assets) payout))
      (var-set total-shares (- (var-get total-shares) shares-to-burn))
      (var-set deposit-count (+ did u1))

      (ok { payout: payout, remaining-shares: (- current-shares shares-to-burn) })
    )
    err-not-found
  )
)

(define-public (update-nav (new-total-assets uint))
  (let (
    (shares (var-get total-shares))
    (sid (var-get nav-snapshot-count))
  )
    (asserts! (or (is-eq tx-sender contract-owner) (is-manager tx-sender)) err-not-authorized)
    (asserts! (> shares u0) err-invalid-amount)

    (let ((new-nav (/ (* new-total-assets u1000000) shares)))
      (var-set nav-per-share new-nav)
      (var-set total-assets new-total-assets)

      (map-set nav-history sid {
        nav-per-share: new-nav,
        total-assets: new-total-assets,
        total-shares: shares,
        block-height: stacks-block-height
      })

      (var-set nav-snapshot-count (+ sid u1))
      (ok { nav-per-share: new-nav, total-assets: new-total-assets })
    )
  )
)

(define-public (rebalance-component (component-id uint) (new-allocated-value uint))
  (match (map-get? index-components component-id)
    comp
    (let (
      (ta (var-get total-assets))
      (new-weight (if (> ta u0) (/ (* new-allocated-value u10000) ta) u0))
    )
      (asserts! (or (is-eq tx-sender contract-owner) (is-manager tx-sender)) err-not-authorized)
      (asserts! (get active comp) err-not-found)

      (map-set index-components component-id (merge comp {
        allocated-value: new-allocated-value,
        current-weight-bps: new-weight
      }))

      (var-set last-rebalance stacks-block-height)
      (ok { component-id: component-id, new-weight-bps: new-weight })
    )
    err-not-found
  )
)

;; --- Admin ---

(define-public (set-index-paused (paused bool))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (var-set index-paused paused)
    (ok paused)
  )
)
