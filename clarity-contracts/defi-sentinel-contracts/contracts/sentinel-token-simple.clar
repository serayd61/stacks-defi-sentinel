;; SENTINEL Token (SNTL) - Simple Version
;; Governance and utility token for DeFi Sentinel

;; Constants
(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-not-token-owner (err u101))
(define-constant err-insufficient-balance (err u102))

;; Token
(define-fungible-token sentinel)

;; Data Variables
(define-data-var token-name (string-ascii 32) "Sentinel Token")
(define-data-var token-symbol (string-ascii 10) "SNTL")
(define-data-var token-uri (optional (string-utf8 256)) (some u"https://defi-sentinel.app/token.json"))

;; Team Vesting
(define-data-var vesting-start uint u0)
(define-data-var team-total uint u15000000000000) ;; 15M SNTL
(define-data-var team-claimed uint u0)
(define-data-var cliff-blocks uint u52560) ;; ~6 months
(define-data-var vesting-blocks uint u105120) ;; ~12 months

;; SIP-010 Functions
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
(define-read-only (get-token-uri) (ok (var-get token-uri)))

;; Mint (owner only)
(define-public (mint (amount uint) (to principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (ft-mint? sentinel amount to)))

;; Initialize team vesting
(define-public (init-vesting)
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (asserts! (is-eq (var-get vesting-start) u0) (err u200))
    (var-set vesting-start stacks-block-height)
    (ok stacks-block-height)))

;; Get vested amount
(define-read-only (get-vested)
  (let ((start (var-get vesting-start))
        (cliff (var-get cliff-blocks))
        (total-v (var-get vesting-blocks))
        (team (var-get team-total))
        (claimed (var-get team-claimed))
        (elapsed (if (> stacks-block-height start) (- stacks-block-height start) u0)))
    (if (is-eq start u0)
      {vested: u0, claimable: u0, claimed: u0}
      (if (< elapsed cliff)
        {vested: u0, claimable: u0, claimed: claimed}
        (if (>= elapsed total-v)
          {vested: team, claimable: (- team claimed), claimed: claimed}
          (let ((vested (/ (* team (- elapsed cliff)) (- total-v cliff))))
            {vested: vested, claimable: (if (> vested claimed) (- vested claimed) u0), claimed: claimed}))))))

;; Claim vested tokens
(define-public (claim-vested)
  (let ((info (get-vested))
        (claimable (get claimable info)))
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (asserts! (> claimable u0) err-insufficient-balance)
    (var-set team-claimed (+ (var-get team-claimed) claimable))
    (ft-mint? sentinel claimable tx-sender)))

;; Contract info
(define-read-only (get-info)
  {name: (var-get token-name), symbol: (var-get token-symbol), owner: contract-owner})

