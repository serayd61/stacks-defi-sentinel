;; Reputation System Contract
;; On-chain reputation tracking

(define-constant CONTRACT-OWNER tx-sender)
(define-constant ERR-NOT-OWNER (err u100))
(define-constant ERR-NOT-AUTHORIZED (err u101))

(define-data-var total-users uint u0)

(define-map reputation principal int)
(define-map can-rate principal bool)
(define-map rating-history { rater: principal, rated: principal } int)

(define-public (authorize-rater (rater principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-OWNER)
    (map-set can-rate rater true)
    (ok true)))

(define-public (rate-user (user principal) (score int))
  (begin
    (asserts! (default-to false (map-get? can-rate tx-sender)) ERR-NOT-AUTHORIZED)
    (let ((current-rep (default-to 0 (map-get? reputation user))))
      (if (is-none (map-get? reputation user))
        (var-set total-users (+ (var-get total-users) u1))
        true)
      (map-set reputation user (+ current-rep score))
      (map-set rating-history { rater: tx-sender, rated: user } score)
      (ok (+ current-rep score)))))

(define-read-only (get-reputation (user principal))
  (default-to 0 (map-get? reputation user)))

(define-read-only (is-authorized-rater (rater principal))
  (default-to false (map-get? can-rate rater)))

(define-read-only (get-rating-given (rater principal) (rated principal))
  (map-get? rating-history { rater: rater, rated: rated }))

(define-read-only (get-total-users)
  (var-get total-users))

