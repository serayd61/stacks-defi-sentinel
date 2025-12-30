;; Token Burn Registry Contract
;; Track token burns for deflationary mechanics

(define-constant CONTRACT-OWNER tx-sender)
(define-constant ERR-NOT-OWNER (err u100))

(define-data-var total-burned uint u0)
(define-data-var burn-count uint u0)

(define-map burn-records uint { burner: principal, amount: uint, block: uint })
(define-map user-burns principal uint)

(define-public (record-burn (amount uint))
  (let ((burn-id (var-get burn-count)))
    (map-set burn-records burn-id {
      burner: tx-sender,
      amount: amount,
      block: block-height
    })
    (map-set user-burns tx-sender 
      (+ (default-to u0 (map-get? user-burns tx-sender)) amount))
    (var-set total-burned (+ (var-get total-burned) amount))
    (var-set burn-count (+ burn-id u1))
    (ok burn-id)))

(define-read-only (get-burn (burn-id uint))
  (map-get? burn-records burn-id))

(define-read-only (get-user-total-burned (user principal))
  (default-to u0 (map-get? user-burns user)))

(define-read-only (get-total-burned)
  (var-get total-burned))

(define-read-only (get-burn-count)
  (var-get burn-count))

(define-read-only (get-burn-stats)
  { total-burned: (var-get total-burned), burn-count: (var-get burn-count) })

