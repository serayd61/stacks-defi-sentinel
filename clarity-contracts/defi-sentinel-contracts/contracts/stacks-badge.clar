;; StacksBadge - Achievement Badge System on Stacks
;; Simple badge/achievement tracking without full NFT implementation
;; Users can claim badges based on eligibility criteria

;; Constants
(define-constant CONTRACT_OWNER tx-sender)
(define-constant ERR_NOT_OWNER (err u100))
(define-constant ERR_NOT_AUTHORIZED (err u101))
(define-constant ERR_BADGE_EXISTS (err u102))
(define-constant ERR_BADGE_NOT_FOUND (err u103))
(define-constant ERR_INVALID_BADGE_TYPE (err u105))
(define-constant ERR_ALREADY_CLAIMED (err u106))
(define-constant ERR_NOT_ELIGIBLE (err u107))

;; Badge Types
(define-constant BADGE_EARLY_ADOPTER u1)
(define-constant BADGE_DEFI_PRO u2)
(define-constant BADGE_WHALE u3)
(define-constant BADGE_STAKER u4)
(define-constant BADGE_TRADER u5)
(define-constant BADGE_CONTRIBUTOR u6)
(define-constant BADGE_DIAMOND_HANDS u7)
(define-constant BADGE_GOVERNANCE u8)

;; Data Variables
(define-data-var total-badges-minted uint u0)
(define-data-var total-unique-holders uint u0)

;; Badge Type Info
(define-map badge-type-info uint {
    name: (string-ascii 50),
    description: (string-ascii 200),
    max-supply: uint,
    current-supply: uint,
    is-active: bool
})

;; User Badge Claims (user -> badge-type -> claimed-at-block)
(define-map user-badge-claims { user: principal, badge-type: uint } uint)

;; User Stats
(define-map user-stats principal {
    total-badges: uint,
    first-badge-block: uint,
    last-badge-block: uint
})

;; Authorized Minters (for special badges)
(define-map authorized-minters principal bool)

;; Initialize Badge Types
(define-private (init-badge-types)
    (begin
        ;; Early Adopter Badge
        (map-set badge-type-info BADGE_EARLY_ADOPTER {
            name: "Early Adopter",
            description: "One of the first 1000 users to interact with StacksBadge",
            max-supply: u1000,
            current-supply: u0,
            is-active: true
        })
        ;; DeFi Pro Badge
        (map-set badge-type-info BADGE_DEFI_PRO {
            name: "DeFi Pro",
            description: "Completed 100+ DeFi transactions on Stacks",
            max-supply: u10000,
            current-supply: u0,
            is-active: true
        })
        ;; Whale Badge
        (map-set badge-type-info BADGE_WHALE {
            name: "Whale",
            description: "Holds 100,000+ STX",
            max-supply: u500,
            current-supply: u0,
            is-active: true
        })
        ;; Staker Badge
        (map-set badge-type-info BADGE_STAKER {
            name: "Staker",
            description: "Staked tokens for 30+ days",
            max-supply: u5000,
            current-supply: u0,
            is-active: true
        })
        ;; Trader Badge
        (map-set badge-type-info BADGE_TRADER {
            name: "Active Trader",
            description: "Executed 50+ swaps on Stacks DEXes",
            max-supply: u10000,
            current-supply: u0,
            is-active: true
        })
        ;; Contributor Badge
        (map-set badge-type-info BADGE_CONTRIBUTOR {
            name: "Contributor",
            description: "Made significant contributions to Stacks ecosystem",
            max-supply: u100,
            current-supply: u0,
            is-active: true
        })
        ;; Diamond Hands Badge
        (map-set badge-type-info BADGE_DIAMOND_HANDS {
            name: "Diamond Hands",
            description: "Held STX through market volatility for 1+ year",
            max-supply: u2000,
            current-supply: u0,
            is-active: true
        })
        ;; Governance Badge
        (map-set badge-type-info BADGE_GOVERNANCE {
            name: "Governance Participant",
            description: "Participated in Stacks governance voting",
            max-supply: u5000,
            current-supply: u0,
            is-active: true
        })
        true
    )
)

;; Claim Badge (public - anyone can claim if eligible)
(define-public (claim-badge (badge-type uint))
    (let (
        (user tx-sender)
        (badge-info (unwrap! (map-get? badge-type-info badge-type) ERR_INVALID_BADGE_TYPE))
        (user-current-stats (default-to {
            total-badges: u0,
            first-badge-block: u0,
            last-badge-block: u0
        } (map-get? user-stats user)))
    )
        ;; Check if badge type is active
        (asserts! (get is-active badge-info) ERR_INVALID_BADGE_TYPE)
        
        ;; Check if user already claimed this badge type
        (asserts! (is-none (map-get? user-badge-claims { user: user, badge-type: badge-type })) ERR_ALREADY_CLAIMED)
        
        ;; Check max supply
        (asserts! (< (get current-supply badge-info) (get max-supply badge-info)) ERR_BADGE_NOT_FOUND)
        
        ;; Check eligibility
        (asserts! (check-eligibility user badge-type) ERR_NOT_ELIGIBLE)
        
        ;; Record claim with block height
        (map-set user-badge-claims { user: user, badge-type: badge-type } stacks-block-height)
        
        ;; Update badge supply
        (map-set badge-type-info badge-type (merge badge-info {
            current-supply: (+ (get current-supply badge-info) u1)
        }))
        
        ;; Update user stats
        (if (is-eq (get total-badges user-current-stats) u0)
            (begin
                (map-set user-stats user {
                    total-badges: u1,
                    first-badge-block: stacks-block-height,
                    last-badge-block: stacks-block-height
                })
                (var-set total-unique-holders (+ (var-get total-unique-holders) u1))
            )
            (map-set user-stats user {
                total-badges: (+ (get total-badges user-current-stats) u1),
                first-badge-block: (get first-badge-block user-current-stats),
                last-badge-block: stacks-block-height
            })
        )
        
        ;; Update global counter
        (var-set total-badges-minted (+ (var-get total-badges-minted) u1))
        
        (ok { badge-type: badge-type, claimed-at: stacks-block-height })
    )
)

;; Admin mint (for special awards)
(define-public (admin-mint (recipient principal) (badge-type uint))
    (let (
        (badge-info (unwrap! (map-get? badge-type-info badge-type) ERR_INVALID_BADGE_TYPE))
        (user-current-stats (default-to {
            total-badges: u0,
            first-badge-block: u0,
            last-badge-block: u0
        } (map-get? user-stats recipient)))
    )
        ;; Only owner or authorized minters
        (asserts! (or (is-eq tx-sender CONTRACT_OWNER) 
                      (default-to false (map-get? authorized-minters tx-sender))) 
                  ERR_NOT_AUTHORIZED)
        
        ;; Check if user already has this badge
        (asserts! (is-none (map-get? user-badge-claims { user: recipient, badge-type: badge-type })) ERR_ALREADY_CLAIMED)
        
        ;; Record claim
        (map-set user-badge-claims { user: recipient, badge-type: badge-type } stacks-block-height)
        
        ;; Update badge supply
        (map-set badge-type-info badge-type (merge badge-info {
            current-supply: (+ (get current-supply badge-info) u1)
        }))
        
        ;; Update user stats
        (if (is-eq (get total-badges user-current-stats) u0)
            (begin
                (map-set user-stats recipient {
                    total-badges: u1,
                    first-badge-block: stacks-block-height,
                    last-badge-block: stacks-block-height
                })
                (var-set total-unique-holders (+ (var-get total-unique-holders) u1))
            )
            (map-set user-stats recipient {
                total-badges: (+ (get total-badges user-current-stats) u1),
                first-badge-block: (get first-badge-block user-current-stats),
                last-badge-block: stacks-block-height
            })
        )
        
        ;; Update global counter
        (var-set total-badges-minted (+ (var-get total-badges-minted) u1))
        
        (ok { badge-type: badge-type, recipient: recipient })
    )
)

;; Check Eligibility
(define-private (check-eligibility (user principal) (badge-type uint))
    (let (
        (user-balance (stx-get-balance user))
    )
        ;; Early Adopter - first 1000 claims
        (if (is-eq badge-type BADGE_EARLY_ADOPTER)
            (let ((badge-info (unwrap! (map-get? badge-type-info badge-type) false)))
                (< (get current-supply badge-info) u1000)
            )
            ;; Whale - check STX balance (100,000 STX = 100,000,000,000 microSTX)
            (if (is-eq badge-type BADGE_WHALE)
                (>= user-balance u100000000000)
                ;; DeFi Pro - simplified (everyone eligible for now)
                (if (is-eq badge-type BADGE_DEFI_PRO)
                    true
                    ;; Staker - simplified
                    (if (is-eq badge-type BADGE_STAKER)
                        true
                        ;; Trader - simplified
                        (if (is-eq badge-type BADGE_TRADER)
                            true
                            ;; Contributor - admin only
                            (if (is-eq badge-type BADGE_CONTRIBUTOR)
                                false
                                ;; Diamond Hands - simplified
                                (if (is-eq badge-type BADGE_DIAMOND_HANDS)
                                    true
                                    ;; Governance - simplified
                                    (if (is-eq badge-type BADGE_GOVERNANCE)
                                        true
                                        false
                                    )
                                )
                            )
                        )
                    )
                )
            )
        )
    )
)

;; Read-only Functions

(define-read-only (get-badge-type-info (badge-type uint))
    (map-get? badge-type-info badge-type)
)

(define-read-only (get-user-badge-claim (user principal) (badge-type uint))
    (map-get? user-badge-claims { user: user, badge-type: badge-type })
)

(define-read-only (has-badge (user principal) (badge-type uint))
    (is-some (map-get? user-badge-claims { user: user, badge-type: badge-type }))
)

(define-read-only (get-user-stats (user principal))
    (map-get? user-stats user)
)

(define-read-only (get-total-badges-minted)
    (var-get total-badges-minted)
)

(define-read-only (get-total-unique-holders)
    (var-get total-unique-holders)
)

(define-read-only (get-user-badges (user principal))
    {
        early-adopter: (has-badge user BADGE_EARLY_ADOPTER),
        defi-pro: (has-badge user BADGE_DEFI_PRO),
        whale: (has-badge user BADGE_WHALE),
        staker: (has-badge user BADGE_STAKER),
        trader: (has-badge user BADGE_TRADER),
        contributor: (has-badge user BADGE_CONTRIBUTOR),
        diamond-hands: (has-badge user BADGE_DIAMOND_HANDS),
        governance: (has-badge user BADGE_GOVERNANCE)
    }
)

(define-read-only (is-eligible (user principal) (badge-type uint))
    (check-eligibility user badge-type)
)

(define-read-only (get-platform-stats)
    {
        total-badges-minted: (var-get total-badges-minted),
        total-unique-holders: (var-get total-unique-holders)
    }
)

;; Admin Functions

(define-public (add-authorized-minter (minter principal))
    (begin
        (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_NOT_OWNER)
        (map-set authorized-minters minter true)
        (ok true)
    )
)

(define-public (remove-authorized-minter (minter principal))
    (begin
        (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_NOT_OWNER)
        (map-delete authorized-minters minter)
        (ok true)
    )
)

(define-public (set-badge-active (badge-type uint) (is-active bool))
    (let ((badge-info (unwrap! (map-get? badge-type-info badge-type) ERR_INVALID_BADGE_TYPE)))
        (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_NOT_OWNER)
        (map-set badge-type-info badge-type (merge badge-info { is-active: is-active }))
        (ok true)
    )
)

;; Initialize on deploy
(init-badge-types)
