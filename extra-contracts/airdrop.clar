;; Airdrop Registry Contract
;; Track airdrop claims

(define-constant CONTRACT-OWNER tx-sender)
(define-constant ERR-NOT-OWNER (err u100))
(define-constant ERR-ALREADY-CLAIMED (err u101))
(define-constant ERR-NOT-ELIGIBLE (err u102))

(define-data-var airdrop-active bool true)
(define-data-var claim-amount uint u1000000)

(define-map eligible-addresses principal bool)
(define-map claimed principal bool)

(define-public (add-eligible (address principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-OWNER)
    (map-set eligible-addresses address true)
    (ok true)))

(define-public (claim)
  (begin
    (asserts! (is-some (map-get? eligible-addresses tx-sender)) ERR-NOT-ELIGIBLE)
    (asserts! (is-none (map-get? claimed tx-sender)) ERR-ALREADY-CLAIMED)
    (map-set claimed tx-sender true)
    (ok (var-get claim-amount))))

(define-public (toggle-airdrop)
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-OWNER)
    (var-set airdrop-active (not (var-get airdrop-active)))
    (ok (var-get airdrop-active))))

(define-read-only (is-eligible (address principal))
  (default-to false (map-get? eligible-addresses address)))

(define-read-only (has-claimed (address principal))
  (default-to false (map-get? claimed address)))

(define-read-only (get-claim-amount)
  (var-get claim-amount))

(define-read-only (is-active)
  (var-get airdrop-active))

