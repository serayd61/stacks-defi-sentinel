;; Test vault - fixed contract address approach
(define-constant contract-owner tx-sender)
(define-constant vault-address 'SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W)

(define-data-var total-deposits uint u0)

;; Deposit STX to contract owner (vault)
(define-public (deposit (amount uint))
  (begin
    (try! (stx-transfer? amount tx-sender vault-address))
    (var-set total-deposits (+ (var-get total-deposits) amount))
    (ok amount)))

(define-read-only (get-total-deposits)
  (var-get total-deposits))

