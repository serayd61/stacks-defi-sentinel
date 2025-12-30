;; Treasury Management Contract
;; Community treasury with multi-sig spending

(define-constant CONTRACT-OWNER tx-sender)
(define-constant ERR-NOT-OWNER (err u100))
(define-constant ERR-NOT-SIGNER (err u101))
(define-constant ERR-ALREADY-SIGNED (err u102))
(define-constant ERR-NOT-APPROVED (err u103))
(define-constant REQUIRED-SIGNATURES u2)

(define-data-var proposal-counter uint u0)
(define-data-var total-deposits uint u0)

(define-map signers principal bool)
(define-map proposals uint { recipient: principal, amount: uint, signatures: uint, executed: bool })
(define-map has-signed { proposal-id: uint, signer: principal } bool)

(define-public (add-signer (signer principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-OWNER)
    (map-set signers signer true)
    (ok true)))

(define-public (deposit (amount uint))
  (begin
    (try! (stx-transfer? amount tx-sender CONTRACT-OWNER))
    (var-set total-deposits (+ (var-get total-deposits) amount))
    (ok amount)))

(define-public (create-proposal (recipient principal) (amount uint))
  (let ((proposal-id (var-get proposal-counter)))
    (asserts! (default-to false (map-get? signers tx-sender)) ERR-NOT-SIGNER)
    (map-set proposals proposal-id { recipient: recipient, amount: amount, signatures: u0, executed: false })
    (var-set proposal-counter (+ proposal-id u1))
    (ok proposal-id)))

(define-public (sign-proposal (proposal-id uint))
  (let ((proposal (unwrap! (map-get? proposals proposal-id) ERR-NOT-OWNER)))
    (asserts! (default-to false (map-get? signers tx-sender)) ERR-NOT-SIGNER)
    (asserts! (not (default-to false (map-get? has-signed { proposal-id: proposal-id, signer: tx-sender }))) ERR-ALREADY-SIGNED)
    (map-set has-signed { proposal-id: proposal-id, signer: tx-sender } true)
    (map-set proposals proposal-id (merge proposal { signatures: (+ (get signatures proposal) u1) }))
    (ok true)))

(define-read-only (get-proposal (proposal-id uint))
  (map-get? proposals proposal-id))

(define-read-only (is-signer (address principal))
  (default-to false (map-get? signers address)))

(define-read-only (get-total-deposits)
  (var-get total-deposits))

