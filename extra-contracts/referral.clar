;; Referral System Contract
;; Track referrals and rewards

(define-constant CONTRACT-OWNER tx-sender)
(define-constant ERR-NOT-OWNER (err u100))
(define-constant ERR-ALREADY-REFERRED (err u101))
(define-constant ERR-SELF-REFER (err u102))

(define-data-var referral-bonus uint u1000000) ;; 1 STX bonus
(define-data-var total-referrals uint u0)

(define-map referrers principal principal) ;; user -> referrer
(define-map referral-counts principal uint) ;; referrer -> count
(define-map referral-earnings principal uint) ;; referrer -> total earned

(define-public (register-referral (referrer principal))
  (begin
    (asserts! (not (is-eq tx-sender referrer)) ERR-SELF-REFER)
    (asserts! (is-none (map-get? referrers tx-sender)) ERR-ALREADY-REFERRED)
    (map-set referrers tx-sender referrer)
    (map-set referral-counts referrer 
      (+ (default-to u0 (map-get? referral-counts referrer)) u1))
    (map-set referral-earnings referrer 
      (+ (default-to u0 (map-get? referral-earnings referrer)) (var-get referral-bonus)))
    (var-set total-referrals (+ (var-get total-referrals) u1))
    (ok true)))

(define-public (set-bonus (new-bonus uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-OWNER)
    (var-set referral-bonus new-bonus)
    (ok new-bonus)))

(define-read-only (get-referrer (user principal))
  (map-get? referrers user))

(define-read-only (get-referral-count (referrer principal))
  (default-to u0 (map-get? referral-counts referrer)))

(define-read-only (get-earnings (referrer principal))
  (default-to u0 (map-get? referral-earnings referrer)))

(define-read-only (get-total-referrals)
  (var-get total-referrals))

(define-read-only (get-bonus)
  (var-get referral-bonus))

