;; SENTINEL Token (SNTL) v4
;; SIP-010 Fungible Token

(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-not-token-owner (err u101))

(define-fungible-token sentinel)

(define-data-var token-name (string-ascii 32) "Sentinel Token")
(define-data-var token-symbol (string-ascii 10) "SNTL")

(define-public (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34))))
  (begin
    (asserts! (is-eq tx-sender sender) err-not-token-owner)
    (try! (ft-transfer? sentinel amount sender recipient))
    (match memo m (print m) 0x)
    (ok true)))

(define-read-only (get-name) (ok (var-get token-name)))
(define-read-only (get-symbol) (ok (var-get token-symbol)))
(define-read-only (get-decimals) (ok u6))
(define-read-only (get-balance (who principal)) (ok (ft-get-balance sentinel who)))
(define-read-only (get-total-supply) (ok (ft-get-supply sentinel)))
(define-read-only (get-token-uri) (ok none))

(define-public (mint (amount uint) (to principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (ft-mint? sentinel amount to)))

