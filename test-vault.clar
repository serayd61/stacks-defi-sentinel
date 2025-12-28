;; Test vault - fixed contract address approach
(define-constant contract-owner tx-sender)
(define-constant vault-address 'SP2PEBKJ2W1ZDDF2QQ6Y4FXKZEDPT9J9R2NKD9WJB)

(define-data-var total-deposits uint u0)

;; Deposit STX to contract owner (vault)
(define-public (deposit (amount uint))
  (begin
    (try! (stx-transfer? amount tx-sender vault-address))
    (var-set total-deposits (+ (var-get total-deposits) amount))
    (ok amount)))

(define-read-only (get-total-deposits)
  (var-get total-deposits))

