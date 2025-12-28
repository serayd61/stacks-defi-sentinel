;; Test as-contract
(define-constant contract-owner tx-sender)

(define-public (deposit (amount uint))
  (stx-transfer? amount tx-sender (as-contract tx-sender)))

(define-public (withdraw-to-owner (amount uint))
  (as-contract (stx-transfer? amount tx-sender contract-owner)))

(define-read-only (get-balance)
  (stx-get-balance (as-contract tx-sender)))

