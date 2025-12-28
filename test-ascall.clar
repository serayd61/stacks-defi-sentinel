;; Test as-contract + contract-call combo
(define-public (transfer-from-contract (amount uint) (recipient principal))
  (as-contract 
    (contract-call? 'SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB.sentinel-token 
      transfer amount tx-sender recipient none)))

