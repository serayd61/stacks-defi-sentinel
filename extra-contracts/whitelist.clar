;; Whitelist Registry Contract
;; Manage access control lists

(define-constant CONTRACT-OWNER tx-sender)
(define-constant ERR-NOT-OWNER (err u100))
(define-constant ERR-ALREADY-WHITELISTED (err u101))
(define-constant ERR-NOT-WHITELISTED (err u102))

(define-data-var whitelist-count uint u0)

(define-map whitelist principal bool)
(define-map whitelist-tier principal uint) ;; tier levels

(define-public (add-to-whitelist (address principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-OWNER)
    (asserts! (is-none (map-get? whitelist address)) ERR-ALREADY-WHITELISTED)
    (map-set whitelist address true)
    (map-set whitelist-tier address u1)
    (var-set whitelist-count (+ (var-get whitelist-count) u1))
    (ok true)))

(define-public (remove-from-whitelist (address principal))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-OWNER)
    (asserts! (is-some (map-get? whitelist address)) ERR-NOT-WHITELISTED)
    (map-delete whitelist address)
    (map-delete whitelist-tier address)
    (var-set whitelist-count (- (var-get whitelist-count) u1))
    (ok true)))

(define-public (set-tier (address principal) (tier uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-OWNER)
    (asserts! (is-some (map-get? whitelist address)) ERR-NOT-WHITELISTED)
    (map-set whitelist-tier address tier)
    (ok tier)))

(define-read-only (is-whitelisted (address principal))
  (default-to false (map-get? whitelist address)))

(define-read-only (get-tier (address principal))
  (default-to u0 (map-get? whitelist-tier address)))

(define-read-only (get-whitelist-count)
  (var-get whitelist-count))

