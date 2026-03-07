;; Test as-contract + contract-call combo
(define-public (transfer-from-contract (amount uint) (recipient principal))
  (as-contract 
    (contract-call? 'SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.sentinel-token 
      transfer amount tx-sender recipient none)))

