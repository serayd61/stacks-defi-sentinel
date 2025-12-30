;; Staking Rewards Contract
;; Distribute rewards to stakers

(define-constant CONTRACT-OWNER tx-sender)
(define-constant ERR-NOT-OWNER (err u100))
(define-constant ERR-NO-STAKE (err u101))

(define-data-var total-staked uint u0)
(define-data-var reward-rate uint u100) ;; 1% per cycle

(define-map stakes principal uint)
(define-map rewards principal uint)

(define-public (stake (amount uint))
  (begin
    (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
    (map-set stakes tx-sender (+ (default-to u0 (map-get? stakes tx-sender)) amount))
    (var-set total-staked (+ (var-get total-staked) amount))
    (ok amount)))

(define-public (claim-rewards)
  (let ((reward (default-to u0 (map-get? rewards tx-sender))))
    (asserts! (> reward u0) ERR-NO-STAKE)
    (map-delete rewards tx-sender)
    (try! (as-contract (stx-transfer? reward tx-sender tx-sender)))
    (ok reward)))

(define-read-only (get-stake (user principal))
  (default-to u0 (map-get? stakes user)))

(define-read-only (get-pending-rewards (user principal))
  (default-to u0 (map-get? rewards user)))

(define-read-only (get-total-staked)
  (var-get total-staked))

