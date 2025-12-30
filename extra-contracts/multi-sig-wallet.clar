;; Multi-Signature Wallet Contract
;; Stacks Builder Challenge - Week 3
;; Requires multiple signatures for transactions

(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-not-signer (err u101))
(define-constant err-already-signed (err u102))
(define-constant err-insufficient-signatures (err u103))
(define-constant err-tx-not-found (err u104))
(define-constant err-tx-executed (err u105))
(define-constant err-invalid-threshold (err u106))

;; Data vars
(define-data-var tx-nonce uint u0)
(define-data-var required-signatures uint u2)
(define-data-var total-signers uint u0)

;; Data maps
(define-map signers principal bool)
(define-map transactions uint {
  to: principal,
  amount: uint,
  memo: (string-utf8 256),
  executed: bool,
  signature-count: uint,
  created-at: uint
})
(define-map tx-signatures {tx-id: uint, signer: principal} bool)

;; Read-only functions
(define-read-only (get-transaction (tx-id uint))
  (map-get? transactions tx-id))

(define-read-only (is-signer (account principal))
  (default-to false (map-get? signers account)))

(define-read-only (has-signed (tx-id uint) (signer principal))
  (default-to false (map-get? tx-signatures {tx-id: tx-id, signer: signer})))

(define-read-only (get-required-signatures)
  (var-get required-signatures))

(define-read-only (get-tx-nonce)
  (var-get tx-nonce))

(define-read-only (get-total-signers)
  (var-get total-signers))

;; Add signer
(define-public (add-signer (new-signer principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (map-set signers new-signer true)
    (var-set total-signers (+ (var-get total-signers) u1))
    (ok true)))

;; Remove signer
(define-public (remove-signer (signer principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (map-delete signers signer)
    (var-set total-signers (- (var-get total-signers) u1))
    (ok true)))

;; Set required signatures
(define-public (set-required-signatures (threshold uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (asserts! (<= threshold (var-get total-signers)) err-invalid-threshold)
    (var-set required-signatures threshold)
    (ok true)))

;; Submit transaction
(define-public (submit-transaction (to principal) (amount uint) (memo (string-utf8 256)))
  (let ((tx-id (var-get tx-nonce)))
    (asserts! (is-signer tx-sender) err-not-signer)
    (map-set transactions tx-id {
      to: to,
      amount: amount,
      memo: memo,
      executed: false,
      signature-count: u1,
      created-at: block-height
    })
    (map-set tx-signatures {tx-id: tx-id, signer: tx-sender} true)
    (var-set tx-nonce (+ tx-id u1))
    (ok tx-id)))

;; Sign transaction
(define-public (sign-transaction (tx-id uint))
  (let ((tx (unwrap! (get-transaction tx-id) err-tx-not-found)))
    (asserts! (is-signer tx-sender) err-not-signer)
    (asserts! (not (get executed tx)) err-tx-executed)
    (asserts! (not (has-signed tx-id tx-sender)) err-already-signed)
    (map-set tx-signatures {tx-id: tx-id, signer: tx-sender} true)
    (map-set transactions tx-id (merge tx {signature-count: (+ (get signature-count tx) u1)}))
    (ok true)))

;; Execute transaction
(define-public (execute-transaction (tx-id uint))
  (let ((tx (unwrap! (get-transaction tx-id) err-tx-not-found)))
    (asserts! (not (get executed tx)) err-tx-executed)
    (asserts! (>= (get signature-count tx) (var-get required-signatures)) err-insufficient-signatures)
    (try! (stx-transfer? (get amount tx) (as-contract tx-sender) (get to tx)))
    (map-set transactions tx-id (merge tx {executed: true}))
    (ok true)))

;; Deposit STX
(define-public (deposit (amount uint))
  (stx-transfer? amount tx-sender (as-contract tx-sender)))

;; Get wallet balance
(define-read-only (get-balance)
  (stx-get-balance (as-contract tx-sender)))

