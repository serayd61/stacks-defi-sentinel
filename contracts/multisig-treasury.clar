;; Multi-Sig Treasury Contract
;; N-of-M multisignature treasury for DeFi Sentinel protocol funds
;; Requires multiple signers to approve transactions

(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u1000))
(define-constant err-not-signer (err u1001))
(define-constant err-not-found (err u1002))
(define-constant err-already-signed (err u1003))
(define-constant err-not-enough-sigs (err u1004))
(define-constant err-already-executed (err u1005))
(define-constant err-insufficient-funds (err u1006))
(define-constant err-expired (err u1007))
(define-constant err-invalid-threshold (err u1008))

(define-constant MAX-SIGNERS u10)
(define-constant TX-EXPIRY-BLOCKS u1440) ;; ~10 days

(define-data-var required-sigs uint u2)
(define-data-var signer-count uint u0)
(define-data-var tx-count uint u0)
(define-data-var treasury-balance uint u0)

(define-map signers principal bool)
(define-map signer-list uint principal)

;; Pending transactions
(define-map pending-txs uint
  {
    proposer: principal,
    recipient: principal,
    amount: uint,
    description: (string-ascii 200),
    proposed-at: uint,
    expires-at: uint,
    sig-count: uint,
    executed: bool,
    cancelled: bool
  }
)

;; Signatures
(define-map signatures
  { tx-id: uint, signer: principal }
  { signed-at: uint }
)

;; Read-only
(define-read-only (get-pending-tx (tx-id uint))
  (map-get? pending-txs tx-id)
)

(define-read-only (has-signed (tx-id uint) (signer principal))
  (is-some (map-get? signatures { tx-id: tx-id, signer: signer }))
)

(define-read-only (is-signer (s principal))
  (default-to false (map-get? signers s))
)

(define-read-only (get-required-sigs)
  (var-get required-sigs)
)

(define-read-only (get-treasury-balance)
  (var-get treasury-balance)
)

(define-read-only (get-signer-count)
  (var-get signer-count)
)

;; Public functions
(define-public (add-signer (signer principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (asserts! (< (var-get signer-count) MAX-SIGNERS) err-invalid-threshold)
    (map-set signers signer true)
    (map-set signer-list (var-get signer-count) signer)
    (var-set signer-count (+ (var-get signer-count) u1))
    (ok signer)
  )
)

(define-public (remove-signer (signer principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (map-set signers signer false)
    (var-set signer-count (- (var-get signer-count) u1))
    (ok signer)
  )
)

(define-public (set-required-sigs (n uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (asserts! (>= n u1) err-invalid-threshold)
    (asserts! (<= n (var-get signer-count)) err-invalid-threshold)
    (var-set required-sigs n)
    (ok n)
  )
)

(define-public (deposit (amount uint))
  (begin
    (asserts! (> amount u0) err-insufficient-funds)
    (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
    (var-set treasury-balance (+ (var-get treasury-balance) amount))
    (ok { deposited: amount, balance: (var-get treasury-balance) })
  )
)

(define-public (propose-tx (recipient principal) (amount uint) (description (string-ascii 200)))
  (let ((tx-id (var-get tx-count)))
    (asserts! (is-signer tx-sender) err-not-signer)
    (asserts! (> amount u0) err-insufficient-funds)
    (asserts! (<= amount (var-get treasury-balance)) err-insufficient-funds)

    (map-set pending-txs tx-id {
      proposer: tx-sender,
      recipient: recipient,
      amount: amount,
      description: description,
      proposed-at: stacks-block-height,
      expires-at: (+ stacks-block-height TX-EXPIRY-BLOCKS),
      sig-count: u1,
      executed: false,
      cancelled: false
    })

    ;; Auto-sign by proposer
    (map-set signatures { tx-id: tx-id, signer: tx-sender } { signed-at: stacks-block-height })
    (var-set tx-count (+ tx-id u1))

    (ok { tx-id: tx-id, amount: amount, sigs-needed: (var-get required-sigs) })
  )
)

(define-public (sign-tx (tx-id uint))
  (match (map-get? pending-txs tx-id)
    tx
    (begin
      (asserts! (is-signer tx-sender) err-not-signer)
      (asserts! (not (get executed tx)) err-already-executed)
      (asserts! (not (get cancelled tx)) err-already-executed)
      (asserts! (<= stacks-block-height (get expires-at tx)) err-expired)
      (asserts! (not (has-signed tx-id tx-sender)) err-already-signed)

      (map-set signatures { tx-id: tx-id, signer: tx-sender } { signed-at: stacks-block-height })
      (map-set pending-txs tx-id (merge tx { sig-count: (+ (get sig-count tx) u1) }))

      (ok { tx-id: tx-id, sig-count: (+ (get sig-count tx) u1) })
    )
    err-not-found
  )
)

(define-public (execute-tx (tx-id uint))
  (match (map-get? pending-txs tx-id)
    tx
    (begin
      (asserts! (is-signer tx-sender) err-not-signer)
      (asserts! (not (get executed tx)) err-already-executed)
      (asserts! (<= stacks-block-height (get expires-at tx)) err-expired)
      (asserts! (>= (get sig-count tx) (var-get required-sigs)) err-not-enough-sigs)
      (asserts! (<= (get amount tx) (var-get treasury-balance)) err-insufficient-funds)

      (try! (as-contract (stx-transfer? (get amount tx) tx-sender (get recipient tx))))

      (var-set treasury-balance (- (var-get treasury-balance) (get amount tx)))
      (map-set pending-txs tx-id (merge tx { executed: true }))

      (ok { tx-id: tx-id, executed: true, amount: (get amount tx), recipient: (get recipient tx) })
    )
    err-not-found
  )
)

(define-public (cancel-tx (tx-id uint))
  (match (map-get? pending-txs tx-id)
    tx
    (begin
      (asserts! (or (is-eq tx-sender (get proposer tx)) (is-eq tx-sender contract-owner)) err-not-signer)
      (asserts! (not (get executed tx)) err-already-executed)
      (map-set pending-txs tx-id (merge tx { cancelled: true }))
      (ok tx-id)
    )
    err-not-found
  )
)
