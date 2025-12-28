;; Simple STX Donation/Contribution Contract
;; Users can donate STX to support the project

(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))

(define-data-var total-donations uint u0)
(define-data-var donor-count uint u0)
(define-map donations principal uint)

;; Donate STX
(define-public (donate (amount uint))
  (begin
    (asserts! (> amount u0) (err u101))
    (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
    (var-set total-donations (+ (var-get total-donations) amount))
    (match (map-get? donations tx-sender)
      existing (map-set donations tx-sender (+ existing amount))
      (begin
        (var-set donor-count (+ (var-get donor-count) u1))
        (map-set donations tx-sender amount)))
    (ok {donated: amount, total: (var-get total-donations)})))

;; Get donation info
(define-read-only (get-info)
  {total: (var-get total-donations), donors: (var-get donor-count)})

;; Get user donation
(define-read-only (get-donation (user principal))
  (default-to u0 (map-get? donations user)))

;; Withdraw (owner only)
(define-public (withdraw (amount uint) (to principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (try! (as-contract (stx-transfer? amount (as-contract tx-sender) to)))
    (ok true)))

