;; Test deposit only - STX to contract
(define-public (deposit (amount uint))
  (stx-transfer? amount tx-sender (as-contract tx-sender)))

