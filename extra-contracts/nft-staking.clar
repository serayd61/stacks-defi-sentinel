;; NFT Staking Contract
;; Stacks Builder Challenge - Week 3
;; Stake NFTs to earn rewards

(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-not-staked (err u101))
(define-constant err-already-staked (err u102))
(define-constant err-no-rewards (err u103))
(define-constant err-cooldown-active (err u104))

;; Reward configuration
(define-data-var reward-per-block uint u100) ;; microSTX per block
(define-data-var total-staked uint u0)
(define-data-var unstake-cooldown uint u144) ;; ~1 day in blocks

;; Staking data
(define-map staked-nfts 
  {owner: principal, nft-id: uint} 
  {
    staked-at: uint,
    last-claim: uint,
    accumulated-rewards: uint
  })

(define-map user-stake-count principal uint)

;; Read-only functions
(define-read-only (get-stake-info (owner principal) (nft-id uint))
  (map-get? staked-nfts {owner: owner, nft-id: nft-id}))

(define-read-only (get-user-stake-count (owner principal))
  (default-to u0 (map-get? user-stake-count owner)))

(define-read-only (get-total-staked)
  (var-get total-staked))

(define-read-only (get-reward-per-block)
  (var-get reward-per-block))

;; Calculate pending rewards
(define-read-only (calculate-rewards (owner principal) (nft-id uint))
  (match (get-stake-info owner nft-id)
    stake-info
      (let (
        (blocks-staked (- block-height (get last-claim stake-info)))
        (pending (* blocks-staked (var-get reward-per-block)))
      )
      (+ pending (get accumulated-rewards stake-info)))
    u0))

;; Stake NFT
(define-public (stake-nft (nft-id uint))
  (let (
    (existing (get-stake-info tx-sender nft-id))
  )
    (asserts! (is-none existing) err-already-staked)
    (map-set staked-nfts 
      {owner: tx-sender, nft-id: nft-id}
      {
        staked-at: block-height,
        last-claim: block-height,
        accumulated-rewards: u0
      })
    (map-set user-stake-count tx-sender (+ (get-user-stake-count tx-sender) u1))
    (var-set total-staked (+ (var-get total-staked) u1))
    (ok true)))

;; Unstake NFT
(define-public (unstake-nft (nft-id uint))
  (let (
    (stake-info (unwrap! (get-stake-info tx-sender nft-id) err-not-staked))
    (rewards (calculate-rewards tx-sender nft-id))
  )
    ;; Check cooldown
    (asserts! (>= (- block-height (get staked-at stake-info)) (var-get unstake-cooldown)) err-cooldown-active)
    ;; Transfer rewards
    (if (> rewards u0)
      (try! (as-contract (stx-transfer? rewards tx-sender contract-owner)))
      true)
    ;; Remove stake
    (map-delete staked-nfts {owner: tx-sender, nft-id: nft-id})
    (map-set user-stake-count tx-sender (- (get-user-stake-count tx-sender) u1))
    (var-set total-staked (- (var-get total-staked) u1))
    (ok rewards)))

;; Claim rewards without unstaking
(define-public (claim-rewards (nft-id uint))
  (let (
    (stake-info (unwrap! (get-stake-info tx-sender nft-id) err-not-staked))
    (rewards (calculate-rewards tx-sender nft-id))
  )
    (asserts! (> rewards u0) err-no-rewards)
    (try! (as-contract (stx-transfer? rewards tx-sender contract-owner)))
    (map-set staked-nfts 
      {owner: tx-sender, nft-id: nft-id}
      (merge stake-info {
        last-claim: block-height,
        accumulated-rewards: u0
      }))
    (ok rewards)))

;; Compound rewards (add to accumulated)
(define-public (compound-rewards (nft-id uint))
  (let (
    (stake-info (unwrap! (get-stake-info tx-sender nft-id) err-not-staked))
    (pending-rewards (calculate-rewards tx-sender nft-id))
  )
    (map-set staked-nfts 
      {owner: tx-sender, nft-id: nft-id}
      (merge stake-info {
        last-claim: block-height,
        accumulated-rewards: pending-rewards
      }))
    (ok pending-rewards)))

;; Admin functions
(define-public (set-reward-per-block (new-reward uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (var-set reward-per-block new-reward)
    (ok true)))

(define-public (set-unstake-cooldown (new-cooldown uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (var-set unstake-cooldown new-cooldown)
    (ok true)))

;; Fund contract for rewards
(define-public (fund-rewards (amount uint))
  (stx-transfer? amount tx-sender (as-contract tx-sender)))

;; Get contract balance
(define-read-only (get-contract-balance)
  (stx-get-balance (as-contract tx-sender)))

