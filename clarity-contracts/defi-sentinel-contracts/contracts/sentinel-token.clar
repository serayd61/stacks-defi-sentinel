;; SENTINEL Token - SIP-010 Fungible Token
;; The governance and utility token for DeFi Sentinel platform

;; Traits - Use local trait for development, mainnet trait for production
(impl-trait .sip-010-trait.sip-010-trait)

;; Constants
(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-not-token-owner (err u101))
(define-constant err-insufficient-balance (err u102))
(define-constant err-invalid-amount (err u103))
(define-constant err-already-claimed (err u104))
(define-constant err-claim-period-ended (err u105))

;; Token Properties
(define-fungible-token sentinel)

;; Data Variables
(define-data-var token-name (string-ascii 32) "Sentinel Token")
(define-data-var token-symbol (string-ascii 10) "SNTL")
(define-data-var token-uri (optional (string-utf8 256)) (some u"https://defi-sentinel.app/token-metadata.json"))
(define-data-var token-decimals uint u6)

;; Total supply: 100,000,000 SNTL (100M)
(define-data-var total-supply uint u100000000000000) ;; 100M * 10^6

;; Tokenomics allocation
(define-data-var team-allocation uint u15000000000000)      ;; 15% - Team (vested)
(define-data-var community-allocation uint u30000000000000)  ;; 30% - Community rewards
(define-data-var treasury-allocation uint u20000000000000)   ;; 20% - Treasury
(define-data-var airdrop-allocation uint u10000000000000)    ;; 10% - Airdrop
(define-data-var liquidity-allocation uint u25000000000000)  ;; 25% - Liquidity mining

;; Claim tracking
(define-map claimed-airdrops principal bool)
(define-data-var airdrop-per-user uint u1000000000) ;; 1000 SNTL per eligible user
(define-data-var airdrop-end-block uint u0)

;; Staking rewards tracking
(define-map staking-balances principal uint)
(define-map staking-start-block principal uint)
(define-data-var staking-reward-rate uint u100) ;; 1% per 1000 blocks

;; ==========================================
;; SIP-010 REQUIRED FUNCTIONS
;; ==========================================

;; Transfer tokens
(define-public (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34))))
  (begin
    (asserts! (is-eq tx-sender sender) err-not-token-owner)
    (asserts! (> amount u0) err-invalid-amount)
    (try! (ft-transfer? sentinel amount sender recipient))
    (match memo to-print (print to-print) 0x)
    (ok true)
  )
)

;; Get token name
(define-read-only (get-name)
  (ok (var-get token-name))
)

;; Get token symbol
(define-read-only (get-symbol)
  (ok (var-get token-symbol))
)

;; Get token decimals
(define-read-only (get-decimals)
  (ok (var-get token-decimals))
)

;; Get balance of an account
(define-read-only (get-balance (account principal))
  (ok (ft-get-balance sentinel account))
)

;; Get total supply
(define-read-only (get-total-supply)
  (ok (ft-get-supply sentinel))
)

;; Get token URI for metadata
(define-read-only (get-token-uri)
  (ok (var-get token-uri))
)

;; ==========================================
;; MINT & BURN FUNCTIONS (Owner only)
;; ==========================================

;; Mint tokens (owner only)
(define-public (mint (amount uint) (recipient principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (ft-mint? sentinel amount recipient)
  )
)

;; Burn tokens from own balance
(define-public (burn (amount uint))
  (begin
    (asserts! (> amount u0) err-invalid-amount)
    (ft-burn? sentinel amount tx-sender)
  )
)

;; ==========================================
;; AIRDROP FUNCTIONS
;; ==========================================

;; Initialize airdrop (owner only)
(define-public (initialize-airdrop (end-block uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (var-set airdrop-end-block end-block)
    (ok true)
  )
)

;; Claim airdrop tokens
(define-public (claim-airdrop)
  (let
    (
      (claimer tx-sender)
      (amount (var-get airdrop-per-user))
    )
    ;; Check claim period
    (asserts! (> (var-get airdrop-end-block) stacks-block-height) err-claim-period-ended)
    ;; Check not already claimed
    (asserts! (is-none (map-get? claimed-airdrops claimer)) err-already-claimed)
    ;; Check airdrop allocation remaining
    (asserts! (>= (var-get airdrop-allocation) amount) err-insufficient-balance)
    
    ;; Mark as claimed
    (map-set claimed-airdrops claimer true)
    ;; Update allocation
    (var-set airdrop-allocation (- (var-get airdrop-allocation) amount))
    ;; Mint tokens
    (ft-mint? sentinel amount claimer)
  )
)

;; Check if address has claimed
(define-read-only (has-claimed (user principal))
  (is-some (map-get? claimed-airdrops user))
)

;; Get remaining airdrop allocation
(define-read-only (get-airdrop-remaining)
  (ok (var-get airdrop-allocation))
)

;; ==========================================
;; STAKING FUNCTIONS
;; ==========================================

;; Stake SNTL tokens
(define-public (stake (amount uint))
  (begin
    (asserts! (> amount u0) err-invalid-amount)
    (asserts! (>= (ft-get-balance sentinel tx-sender) amount) err-insufficient-balance)
    
    ;; Transfer tokens to contract
    (try! (ft-transfer? sentinel amount tx-sender (as-contract tx-sender)))
    
    ;; Update staking balance
    (map-set staking-balances tx-sender 
      (+ (default-to u0 (map-get? staking-balances tx-sender)) amount))
    (map-set staking-start-block tx-sender stacks-block-height)
    
    (ok true)
  )
)

;; Unstake SNTL tokens with rewards
(define-public (unstake)
  (let
    (
      (staker tx-sender)
      (staked-amount (default-to u0 (map-get? staking-balances staker)))
      (start-block (default-to stacks-block-height (map-get? staking-start-block staker)))
      (blocks-staked (- stacks-block-height start-block))
      (reward (/ (* staked-amount blocks-staked (var-get staking-reward-rate)) u100000))
    )
    (asserts! (> staked-amount u0) err-insufficient-balance)
    
    ;; Clear staking data
    (map-delete staking-balances staker)
    (map-delete staking-start-block staker)
    
    ;; Return staked tokens + rewards from community allocation
    (try! (as-contract (ft-transfer? sentinel staked-amount tx-sender staker)))
    
    ;; Mint rewards if community allocation allows
    (if (>= (var-get community-allocation) reward)
      (begin
        (var-set community-allocation (- (var-get community-allocation) reward))
        (try! (ft-mint? sentinel reward staker))
        (ok { staked: staked-amount, reward: reward })
      )
      (ok { staked: staked-amount, reward: u0 })
    )
  )
)

;; Get staking info for user
(define-read-only (get-staking-info (user principal))
  (let
    (
      (staked-amount (default-to u0 (map-get? staking-balances user)))
      (start-block (default-to stacks-block-height (map-get? staking-start-block user)))
      (blocks-staked (- stacks-block-height start-block))
      (pending-reward (/ (* staked-amount blocks-staked (var-get staking-reward-rate)) u100000))
    )
    {
      staked: staked-amount,
      start-block: start-block,
      blocks-staked: blocks-staked,
      pending-reward: pending-reward
    }
  )
)

;; ==========================================
;; GOVERNANCE FUNCTIONS
;; ==========================================

;; Update token URI (owner only)
(define-public (set-token-uri (new-uri (optional (string-utf8 256))))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (var-set token-uri new-uri)
    (ok true)
  )
)

;; Update staking reward rate (owner only)
(define-public (set-staking-reward-rate (new-rate uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (var-set staking-reward-rate new-rate)
    (ok true)
  )
)

;; ==========================================
;; UTILITY FUNCTIONS
;; ==========================================

;; Get all tokenomics info
(define-read-only (get-tokenomics)
  {
    total-supply: (var-get total-supply),
    team: (var-get team-allocation),
    community: (var-get community-allocation),
    treasury: (var-get treasury-allocation),
    airdrop: (var-get airdrop-allocation),
    liquidity: (var-get liquidity-allocation)
  }
)

;; Get contract info
(define-read-only (get-contract-info)
  {
    name: (var-get token-name),
    symbol: (var-get token-symbol),
    decimals: (var-get token-decimals),
    owner: contract-owner
  }
)

