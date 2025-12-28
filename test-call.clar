;; Test contract-call
(define-read-only (get-token-name)
  (contract-call? 'SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB.sentinel-token get-name))

