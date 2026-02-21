;; Token Registry Contract
;; SIP-010 compliant token registry for Stacks ecosystem
;; Tracks verified tokens, metadata, and security status

(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u700))
(define-constant err-not-authorized (err u701))
(define-constant err-not-found (err u702))
(define-constant err-already-registered (err u703))
(define-constant err-blacklisted (err u704))

(define-data-var token-count uint u0)
(define-data-var verified-count uint u0)

(define-map verifiers principal bool)

;; Token registry
(define-map tokens principal
  {
    name: (string-ascii 50),
    symbol: (string-ascii 10),
    decimals: uint,
    total-supply: uint,
    deployer: principal,
    registered-at: uint,
    verified: bool,
    blacklisted: bool,
    audit-score: uint,
    website: (string-ascii 100),
    description: (string-ascii 200)
  }
)

;; Token metadata
(define-map token-metadata principal
  {
    logo-url: (string-ascii 200),
    coingecko-id: (optional (string-ascii 50)),
    category: (string-ascii 30),
    tags: (list 5 (string-ascii 20))
  }
)

;; Verified token list
(define-map verified-tokens uint principal)

;; Read-only
(define-read-only (get-token (token principal))
  (map-get? tokens token)
)

(define-read-only (get-token-metadata (token principal))
  (map-get? token-metadata token)
)

(define-read-only (is-verified (token principal))
  (match (map-get? tokens token)
    t (get verified t)
    false
  )
)

(define-read-only (is-blacklisted (token principal))
  (match (map-get? tokens token)
    t (get blacklisted t)
    false
  )
)

(define-read-only (get-token-count)
  (var-get token-count)
)

(define-read-only (is-verifier (v principal))
  (default-to false (map-get? verifiers v))
)

;; Public functions
(define-public (add-verifier (verifier principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (map-set verifiers verifier true)
    (ok verifier)
  )
)

(define-public (register-token
    (token principal)
    (name (string-ascii 50))
    (symbol (string-ascii 10))
    (decimals uint)
    (total-supply uint)
    (website (string-ascii 100))
    (description (string-ascii 200)))
  (begin
    (asserts! (is-none (map-get? tokens token)) err-already-registered)
    (map-set tokens token {
      name: name,
      symbol: symbol,
      decimals: decimals,
      total-supply: total-supply,
      deployer: tx-sender,
      registered-at: stacks-block-height,
      verified: false,
      blacklisted: false,
      audit-score: u0,
      website: website,
      description: description
    })
    (var-set token-count (+ (var-get token-count) u1))
    (ok { token: token, name: name, symbol: symbol })
  )
)

(define-public (verify-token (token principal) (audit-score uint))
  (match (map-get? tokens token)
    t
    (begin
      (asserts! (is-verifier tx-sender) err-not-authorized)
      (asserts! (not (get blacklisted t)) err-blacklisted)
      (map-set tokens token (merge t { verified: true, audit-score: audit-score }))
      (map-set verified-tokens (var-get verified-count) token)
      (var-set verified-count (+ (var-get verified-count) u1))
      (ok { token: token, verified: true, audit-score: audit-score })
    )
    err-not-found
  )
)

(define-public (blacklist-token (token principal) (reason (string-ascii 100)))
  (match (map-get? tokens token)
    t
    (begin
      (asserts! (is-verifier tx-sender) err-not-authorized)
      (map-set tokens token (merge t { blacklisted: true, verified: false }))
      (ok { token: token, blacklisted: true })
    )
    err-not-found
  )
)

(define-public (set-token-metadata
    (token principal)
    (logo-url (string-ascii 200))
    (coingecko-id (optional (string-ascii 50)))
    (category (string-ascii 30))
    (tags (list 5 (string-ascii 20))))
  (begin
    (asserts! (is-some (map-get? tokens token)) err-not-found)
    (map-set token-metadata token {
      logo-url: logo-url,
      coingecko-id: coingecko-id,
      category: category,
      tags: tags
    })
    (ok token)
  )
)
