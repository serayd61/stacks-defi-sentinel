;; StacksPassport - Verifiable Credentials & Reputation System
;; A decentralized identity and reputation protocol on Stacks
;; Similar to Gitcoin Passport but for Stacks ecosystem

;; Constants
(define-constant CONTRACT_OWNER tx-sender)
(define-constant ERR_NOT_OWNER (err u100))
(define-constant ERR_NOT_AUTHORIZED (err u101))
(define-constant ERR_ALREADY_REGISTERED (err u102))
(define-constant ERR_NOT_REGISTERED (err u103))
(define-constant ERR_CREDENTIAL_EXISTS (err u104))
(define-constant ERR_CREDENTIAL_NOT_FOUND (err u105))
(define-constant ERR_INVALID_CREDENTIAL (err u106))
(define-constant ERR_EXPIRED (err u107))
(define-constant ERR_INSUFFICIENT_SCORE (err u108))

;; Credential Types with Point Values
(define-constant CRED_STACKS_HOLDER u1)      ;; Holds STX - 10 points
(define-constant CRED_STACKER u2)            ;; Has stacked STX - 25 points
(define-constant CRED_NFT_HOLDER u3)         ;; Owns NFTs on Stacks - 15 points
(define-constant CRED_DEFI_USER u4)          ;; Used DeFi protocols - 20 points
(define-constant CRED_DEVELOPER u5)          ;; Deployed contracts - 50 points
(define-constant CRED_EARLY_ADOPTER u6)      ;; Early Stacks user - 30 points
(define-constant CRED_GOVERNANCE u7)         ;; Voted in governance - 20 points
(define-constant CRED_BRIDGE_USER u8)        ;; Used sBTC bridge - 25 points
(define-constant CRED_SOCIAL_VERIFIED u9)    ;; Social media verified - 15 points
(define-constant CRED_KYC_VERIFIED u10)      ;; KYC verified (off-chain) - 40 points

;; Credential Point Values
(define-map credential-points uint uint)

;; Data Variables
(define-data-var total-passports uint u0)
(define-data-var total-credentials-issued uint u0)
(define-data-var min-score-for-verified uint u50)

;; Passport Registry
(define-map passports principal {
    created-at: uint,
    last-updated: uint,
    total-score: uint,
    credential-count: uint,
    is-verified: bool,
    verification-level: uint,
    referrer: (optional principal)
})

;; User Credentials (user -> credential-type -> credential-data)
(define-map user-credentials { user: principal, credential-type: uint } {
    issued-at: uint,
    expires-at: uint,
    issuer: principal,
    points: uint,
    metadata: (string-ascii 200),
    is-valid: bool
})

;; Credential Types Info
(define-map credential-types uint {
    name: (string-ascii 50),
    description: (string-ascii 200),
    points: uint,
    is-active: bool,
    total-issued: uint,
    requires-verification: bool
})

;; Authorized Issuers (for specific credential types)
(define-map authorized-issuers { issuer: principal, credential-type: uint } bool)

;; Referral Tracking
(define-map referral-stats principal {
    total-referrals: uint,
    bonus-points: uint
})

;; Verification Levels
(define-map verification-levels uint {
    name: (string-ascii 30),
    min-score: uint,
    benefits: (string-ascii 200)
})

;; Initialize
(define-private (init-contract)
    (begin
        ;; Set credential point values
        (map-set credential-points CRED_STACKS_HOLDER u10)
        (map-set credential-points CRED_STACKER u25)
        (map-set credential-points CRED_NFT_HOLDER u15)
        (map-set credential-points CRED_DEFI_USER u20)
        (map-set credential-points CRED_DEVELOPER u50)
        (map-set credential-points CRED_EARLY_ADOPTER u30)
        (map-set credential-points CRED_GOVERNANCE u20)
        (map-set credential-points CRED_BRIDGE_USER u25)
        (map-set credential-points CRED_SOCIAL_VERIFIED u15)
        (map-set credential-points CRED_KYC_VERIFIED u40)
        
        ;; Initialize credential types
        (map-set credential-types CRED_STACKS_HOLDER {
            name: "STX Holder",
            description: "Verified holder of STX tokens",
            points: u10,
            is-active: true,
            total-issued: u0,
            requires-verification: false
        })
        (map-set credential-types CRED_STACKER {
            name: "Stacker",
            description: "Has participated in Stacking",
            points: u25,
            is-active: true,
            total-issued: u0,
            requires-verification: false
        })
        (map-set credential-types CRED_NFT_HOLDER {
            name: "NFT Collector",
            description: "Owns NFTs on Stacks blockchain",
            points: u15,
            is-active: true,
            total-issued: u0,
            requires-verification: false
        })
        (map-set credential-types CRED_DEFI_USER {
            name: "DeFi Power User",
            description: "Active user of DeFi protocols",
            points: u20,
            is-active: true,
            total-issued: u0,
            requires-verification: false
        })
        (map-set credential-types CRED_DEVELOPER {
            name: "Clarity Developer",
            description: "Has deployed smart contracts",
            points: u50,
            is-active: true,
            total-issued: u0,
            requires-verification: true
        })
        (map-set credential-types CRED_EARLY_ADOPTER {
            name: "Early Adopter",
            description: "Early Stacks ecosystem participant",
            points: u30,
            is-active: true,
            total-issued: u0,
            requires-verification: true
        })
        (map-set credential-types CRED_GOVERNANCE {
            name: "Governance Participant",
            description: "Participated in protocol governance",
            points: u20,
            is-active: true,
            total-issued: u0,
            requires-verification: false
        })
        (map-set credential-types CRED_BRIDGE_USER {
            name: "Bridge Pioneer",
            description: "Used sBTC or other bridges",
            points: u25,
            is-active: true,
            total-issued: u0,
            requires-verification: false
        })
        (map-set credential-types CRED_SOCIAL_VERIFIED {
            name: "Social Verified",
            description: "Verified social media accounts",
            points: u15,
            is-active: true,
            total-issued: u0,
            requires-verification: true
        })
        (map-set credential-types CRED_KYC_VERIFIED {
            name: "KYC Verified",
            description: "Completed KYC verification",
            points: u40,
            is-active: true,
            total-issued: u0,
            requires-verification: true
        })
        
        ;; Initialize verification levels
        (map-set verification-levels u1 {
            name: "Bronze",
            min-score: u25,
            benefits: "Basic access to ecosystem features"
        })
        (map-set verification-levels u2 {
            name: "Silver",
            min-score: u50,
            benefits: "Priority access, reduced fees"
        })
        (map-set verification-levels u3 {
            name: "Gold",
            min-score: u100,
            benefits: "VIP access, airdrops eligibility"
        })
        (map-set verification-levels u4 {
            name: "Platinum",
            min-score: u200,
            benefits: "Full ecosystem benefits, governance power"
        })
        (map-set verification-levels u5 {
            name: "Diamond",
            min-score: u500,
            benefits: "Elite status, exclusive opportunities"
        })
        
        true
    )
)

;; Register Passport
(define-public (register-passport (referrer (optional principal)))
    (let (
        (user tx-sender)
    )
        ;; Check not already registered
        (asserts! (is-none (map-get? passports user)) ERR_ALREADY_REGISTERED)
        
        ;; Create passport
        (map-set passports user {
            created-at: stacks-block-height,
            last-updated: stacks-block-height,
            total-score: u0,
            credential-count: u0,
            is-verified: false,
            verification-level: u0,
            referrer: referrer
        })
        
        ;; Update referrer stats if exists
        (match referrer
            ref-principal (update-referrer-stats ref-principal)
            true
        )
        
        ;; Increment total passports
        (var-set total-passports (+ (var-get total-passports) u1))
        
        (ok { passport-id: user, created-at: stacks-block-height })
    )
)

;; Update Referrer Stats
(define-private (update-referrer-stats (referrer principal))
    (let (
        (current-stats (default-to {
            total-referrals: u0,
            bonus-points: u0
        } (map-get? referral-stats referrer)))
        (referrer-passport (map-get? passports referrer))
    )
        ;; Update referral stats
        (map-set referral-stats referrer {
            total-referrals: (+ (get total-referrals current-stats) u1),
            bonus-points: (+ (get bonus-points current-stats) u5)
        })
        
        ;; Add bonus points to referrer's passport
        (match referrer-passport
            passport (map-set passports referrer (merge passport {
                total-score: (+ (get total-score passport) u5),
                last-updated: stacks-block-height
            }))
            true
        )
        
        true
    )
)

;; Claim Self-Verifiable Credential
(define-public (claim-credential (credential-type uint))
    (let (
        (user tx-sender)
        (passport (unwrap! (map-get? passports user) ERR_NOT_REGISTERED))
        (cred-info (unwrap! (map-get? credential-types credential-type) ERR_INVALID_CREDENTIAL))
        (points (default-to u0 (map-get? credential-points credential-type)))
    )
        ;; Check credential is active
        (asserts! (get is-active cred-info) ERR_INVALID_CREDENTIAL)
        
        ;; Check not requiring verification
        (asserts! (not (get requires-verification cred-info)) ERR_NOT_AUTHORIZED)
        
        ;; Check not already claimed
        (asserts! (is-none (map-get? user-credentials { user: user, credential-type: credential-type })) ERR_CREDENTIAL_EXISTS)
        
        ;; Verify eligibility based on credential type
        (asserts! (check-credential-eligibility user credential-type) ERR_INVALID_CREDENTIAL)
        
        ;; Issue credential
        (map-set user-credentials { user: user, credential-type: credential-type } {
            issued-at: stacks-block-height,
            expires-at: (+ stacks-block-height u52560), ;; ~1 year
            issuer: (as-contract tx-sender),
            points: points,
            metadata: "",
            is-valid: true
        })
        
        ;; Update passport
        (let (
            (new-score (+ (get total-score passport) points))
            (new-level (calculate-verification-level new-score))
        )
            (map-set passports user (merge passport {
                total-score: new-score,
                credential-count: (+ (get credential-count passport) u1),
                last-updated: stacks-block-height,
                is-verified: (>= new-score (var-get min-score-for-verified)),
                verification-level: new-level
            }))
        )
        
        ;; Update credential type stats
        (map-set credential-types credential-type (merge cred-info {
            total-issued: (+ (get total-issued cred-info) u1)
        }))
        
        ;; Increment total credentials
        (var-set total-credentials-issued (+ (var-get total-credentials-issued) u1))
        
        (ok { credential-type: credential-type, points: points })
    )
)

;; Issue Credential (Authorized Issuers Only)
(define-public (issue-credential (recipient principal) (credential-type uint) (metadata (string-ascii 200)))
    (let (
        (issuer tx-sender)
        (passport (unwrap! (map-get? passports recipient) ERR_NOT_REGISTERED))
        (cred-info (unwrap! (map-get? credential-types credential-type) ERR_INVALID_CREDENTIAL))
        (points (default-to u0 (map-get? credential-points credential-type)))
    )
        ;; Check authorization
        (asserts! (or 
            (is-eq issuer CONTRACT_OWNER)
            (default-to false (map-get? authorized-issuers { issuer: issuer, credential-type: credential-type }))
        ) ERR_NOT_AUTHORIZED)
        
        ;; Check not already issued
        (asserts! (is-none (map-get? user-credentials { user: recipient, credential-type: credential-type })) ERR_CREDENTIAL_EXISTS)
        
        ;; Issue credential
        (map-set user-credentials { user: recipient, credential-type: credential-type } {
            issued-at: stacks-block-height,
            expires-at: (+ stacks-block-height u52560),
            issuer: issuer,
            points: points,
            metadata: metadata,
            is-valid: true
        })
        
        ;; Update passport
        (let (
            (new-score (+ (get total-score passport) points))
            (new-level (calculate-verification-level new-score))
        )
            (map-set passports recipient (merge passport {
                total-score: new-score,
                credential-count: (+ (get credential-count passport) u1),
                last-updated: stacks-block-height,
                is-verified: (>= new-score (var-get min-score-for-verified)),
                verification-level: new-level
            }))
        )
        
        ;; Update credential type stats
        (map-set credential-types credential-type (merge cred-info {
            total-issued: (+ (get total-issued cred-info) u1)
        }))
        
        (var-set total-credentials-issued (+ (var-get total-credentials-issued) u1))
        
        (ok { recipient: recipient, credential-type: credential-type, points: points })
    )
)

;; Check Credential Eligibility (simplified - can be extended)
(define-private (check-credential-eligibility (user principal) (credential-type uint))
    (let (
        (user-balance (stx-get-balance user))
    )
        ;; STX Holder - must have at least 10 STX
        (if (is-eq credential-type CRED_STACKS_HOLDER)
            (>= user-balance u10000000)
            ;; DeFi User - simplified (always true for now)
            (if (is-eq credential-type CRED_DEFI_USER)
                true
                ;; NFT Holder - simplified
                (if (is-eq credential-type CRED_NFT_HOLDER)
                    true
                    ;; Governance - simplified
                    (if (is-eq credential-type CRED_GOVERNANCE)
                        true
                        ;; Bridge User - simplified
                        (if (is-eq credential-type CRED_BRIDGE_USER)
                            true
                            ;; Stacker - must have significant STX
                            (if (is-eq credential-type CRED_STACKER)
                                (>= user-balance u100000000)
                                false
                            )
                        )
                    )
                )
            )
        )
    )
)

;; Calculate Verification Level
(define-private (calculate-verification-level (score uint))
    (if (>= score u500)
        u5 ;; Diamond
        (if (>= score u200)
            u4 ;; Platinum
            (if (>= score u100)
                u3 ;; Gold
                (if (>= score u50)
                    u2 ;; Silver
                    (if (>= score u25)
                        u1 ;; Bronze
                        u0 ;; None
                    )
                )
            )
        )
    )
)

;; Revoke Credential
(define-public (revoke-credential (user principal) (credential-type uint))
    (let (
        (credential (unwrap! (map-get? user-credentials { user: user, credential-type: credential-type }) ERR_CREDENTIAL_NOT_FOUND))
        (passport (unwrap! (map-get? passports user) ERR_NOT_REGISTERED))
    )
        ;; Only issuer or owner can revoke
        (asserts! (or 
            (is-eq tx-sender CONTRACT_OWNER)
            (is-eq tx-sender (get issuer credential))
        ) ERR_NOT_AUTHORIZED)
        
        ;; Mark as invalid
        (map-set user-credentials { user: user, credential-type: credential-type } 
            (merge credential { is-valid: false })
        )
        
        ;; Update passport score
        (let (
            (new-score (if (> (get total-score passport) (get points credential))
                          (- (get total-score passport) (get points credential))
                          u0))
            (new-level (calculate-verification-level new-score))
        )
            (map-set passports user (merge passport {
                total-score: new-score,
                last-updated: stacks-block-height,
                is-verified: (>= new-score (var-get min-score-for-verified)),
                verification-level: new-level
            }))
        )
        
        (ok true)
    )
)

;; Read-only Functions

(define-read-only (get-passport (user principal))
    (map-get? passports user)
)

(define-read-only (get-credential (user principal) (credential-type uint))
    (map-get? user-credentials { user: user, credential-type: credential-type })
)

(define-read-only (has-credential (user principal) (credential-type uint))
    (match (map-get? user-credentials { user: user, credential-type: credential-type })
        cred (get is-valid cred)
        false
    )
)

(define-read-only (get-reputation-score (user principal))
    (match (map-get? passports user)
        passport (get total-score passport)
        u0
    )
)

(define-read-only (get-verification-level (user principal))
    (match (map-get? passports user)
        passport (get verification-level passport)
        u0
    )
)

(define-read-only (is-verified (user principal))
    (match (map-get? passports user)
        passport (get is-verified passport)
        false
    )
)

(define-read-only (get-credential-type-info (credential-type uint))
    (map-get? credential-types credential-type)
)

(define-read-only (get-verification-level-info (level uint))
    (map-get? verification-levels level)
)

(define-read-only (get-referral-stats (user principal))
    (map-get? referral-stats user)
)

(define-read-only (get-platform-stats)
    {
        total-passports: (var-get total-passports),
        total-credentials-issued: (var-get total-credentials-issued),
        min-score-for-verified: (var-get min-score-for-verified)
    }
)

(define-read-only (get-user-credentials (user principal))
    {
        stx-holder: (has-credential user CRED_STACKS_HOLDER),
        stacker: (has-credential user CRED_STACKER),
        nft-holder: (has-credential user CRED_NFT_HOLDER),
        defi-user: (has-credential user CRED_DEFI_USER),
        developer: (has-credential user CRED_DEVELOPER),
        early-adopter: (has-credential user CRED_EARLY_ADOPTER),
        governance: (has-credential user CRED_GOVERNANCE),
        bridge-user: (has-credential user CRED_BRIDGE_USER),
        social-verified: (has-credential user CRED_SOCIAL_VERIFIED),
        kyc-verified: (has-credential user CRED_KYC_VERIFIED)
    }
)

(define-read-only (check-eligibility (user principal) (credential-type uint))
    (check-credential-eligibility user credential-type)
)

;; Admin Functions

(define-public (add-authorized-issuer (issuer principal) (credential-type uint))
    (begin
        (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_NOT_OWNER)
        (map-set authorized-issuers { issuer: issuer, credential-type: credential-type } true)
        (ok true)
    )
)

(define-public (remove-authorized-issuer (issuer principal) (credential-type uint))
    (begin
        (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_NOT_OWNER)
        (map-delete authorized-issuers { issuer: issuer, credential-type: credential-type })
        (ok true)
    )
)

(define-public (set-min-score-for-verified (new-min uint))
    (begin
        (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_NOT_OWNER)
        (var-set min-score-for-verified new-min)
        (ok new-min)
    )
)

(define-public (set-credential-type-active (credential-type uint) (is-active bool))
    (let ((cred-info (unwrap! (map-get? credential-types credential-type) ERR_INVALID_CREDENTIAL)))
        (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_NOT_OWNER)
        (map-set credential-types credential-type (merge cred-info { is-active: is-active }))
        (ok true)
    )
)

;; Initialize on deploy
(init-contract)



