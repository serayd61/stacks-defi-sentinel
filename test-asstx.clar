;; Test as-contract + stx-transfer
(define-public (withdraw-stx (amount uint) (recipient principal))
  (as-contract (stx-transfer? amount tx-sender recipient)))

