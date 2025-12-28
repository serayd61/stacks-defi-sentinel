;; Test STX transfer
(define-constant contract-owner tx-sender)

(define-public (donate (amount uint))
  (stx-transfer? amount tx-sender contract-owner))

(define-read-only (get-owner)
  contract-owner)

