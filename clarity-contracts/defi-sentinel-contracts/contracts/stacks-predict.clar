;; StacksPredict - Price Prediction Game on Stacks
;; Users predict if STX price will go UP or DOWN
;; Winners share the pool proportionally

;; Constants
(define-constant CONTRACT_OWNER tx-sender)
(define-constant ERR_NOT_OWNER (err u100))
(define-constant ERR_ROUND_NOT_ACTIVE (err u101))
(define-constant ERR_ALREADY_PREDICTED (err u102))
(define-constant ERR_ROUND_NOT_ENDED (err u103))
(define-constant ERR_INVALID_PREDICTION (err u104))
(define-constant ERR_ROUND_NOT_RESOLVED (err u105))
(define-constant ERR_ALREADY_CLAIMED (err u106))
(define-constant ERR_NOT_WINNER (err u107))
(define-constant ERR_INSUFFICIENT_FUNDS (err u108))
(define-constant ERR_ROUND_ALREADY_RESOLVED (err u109))
(define-constant ERR_MIN_BET (err u110))

;; Prediction Types
(define-constant PREDICT_UP u1)
(define-constant PREDICT_DOWN u2)

;; Configuration
(define-constant MIN_BET_AMOUNT u1000000) ;; 1 STX minimum
(define-constant ROUND_DURATION u144) ;; ~24 hours in blocks (10 min/block)
(define-constant PLATFORM_FEE u300) ;; 3% fee (basis points)

;; Data Variables
(define-data-var current-round uint u0)
(define-data-var total-volume uint u0)
(define-data-var total-fees-collected uint u0)
(define-data-var is-paused bool false)

;; Round Info
(define-map rounds uint {
    start-block: uint,
    end-block: uint,
    lock-price: uint,
    close-price: uint,
    total-up-amount: uint,
    total-down-amount: uint,
    total-participants: uint,
    is-resolved: bool,
    winning-direction: uint,
    prize-pool: uint
})

;; User Predictions
(define-map user-predictions { round: uint, user: principal } {
    direction: uint,
    amount: uint,
    claimed: bool
})

;; User Stats
(define-map user-stats principal {
    total-bets: uint,
    total-wins: uint,
    total-wagered: uint,
    total-won: uint,
    current-streak: uint,
    best-streak: uint
})

;; Leaderboard Entry
(define-map leaderboard uint { user: principal, total-won: uint })
(define-data-var leaderboard-size uint u0)

;; Oracle (simplified - in production use Redstone or Pyth)
(define-map price-oracle uint uint)
(define-data-var latest-price uint u0)

;; Initialize
(define-public (initialize)
    (begin
        (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_NOT_OWNER)
        (var-set current-round u1)
        (start-new-round)
        (ok true)
    )
)

;; Start New Round
(define-private (start-new-round)
    (let (
        (round-id (var-get current-round))
        (current-price (var-get latest-price))
    )
        (map-set rounds round-id {
            start-block: stacks-block-height,
            end-block: (+ stacks-block-height ROUND_DURATION),
            lock-price: current-price,
            close-price: u0,
            total-up-amount: u0,
            total-down-amount: u0,
            total-participants: u0,
            is-resolved: false,
            winning-direction: u0,
            prize-pool: u0
        })
        true
    )
)

;; Place Prediction
(define-public (predict (direction uint) (amount uint))
    (let (
        (round-id (var-get current-round))
        (round (unwrap! (map-get? rounds round-id) ERR_ROUND_NOT_ACTIVE))
        (user tx-sender)
    )
        ;; Validations
        (asserts! (not (var-get is-paused)) ERR_ROUND_NOT_ACTIVE)
        (asserts! (< stacks-block-height (get end-block round)) ERR_ROUND_NOT_ACTIVE)
        (asserts! (or (is-eq direction PREDICT_UP) (is-eq direction PREDICT_DOWN)) ERR_INVALID_PREDICTION)
        (asserts! (>= amount MIN_BET_AMOUNT) ERR_MIN_BET)
        (asserts! (is-none (map-get? user-predictions { round: round-id, user: user })) ERR_ALREADY_PREDICTED)
        
        ;; Transfer STX from user
        (try! (stx-transfer? amount user (as-contract tx-sender)))
        
        ;; Record prediction
        (map-set user-predictions { round: round-id, user: user } {
            direction: direction,
            amount: amount,
            claimed: false
        })
        
        ;; Update round totals
        (if (is-eq direction PREDICT_UP)
            (map-set rounds round-id (merge round {
                total-up-amount: (+ (get total-up-amount round) amount),
                total-participants: (+ (get total-participants round) u1),
                prize-pool: (+ (get prize-pool round) amount)
            }))
            (map-set rounds round-id (merge round {
                total-down-amount: (+ (get total-down-amount round) amount),
                total-participants: (+ (get total-participants round) u1),
                prize-pool: (+ (get prize-pool round) amount)
            }))
        )
        
        ;; Update user stats
        (update-user-bet-stats user amount)
        
        ;; Update global volume
        (var-set total-volume (+ (var-get total-volume) amount))
        
        (ok { round: round-id, direction: direction, amount: amount })
    )
)

;; Resolve Round (can be called by anyone after round ends)
(define-public (resolve-round (round-id uint) (close-price uint))
    (let (
        (round (unwrap! (map-get? rounds round-id) ERR_ROUND_NOT_ACTIVE))
    )
        ;; Only owner can set price (in production, use oracle)
        (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_NOT_OWNER)
        (asserts! (>= stacks-block-height (get end-block round)) ERR_ROUND_NOT_ENDED)
        (asserts! (not (get is-resolved round)) ERR_ROUND_ALREADY_RESOLVED)
        
        (let (
            (lock-price (get lock-price round))
            (winning-dir (if (> close-price lock-price) PREDICT_UP PREDICT_DOWN))
            (fee-amount (/ (* (get prize-pool round) PLATFORM_FEE) u10000))
        )
            ;; Update round with results
            (map-set rounds round-id (merge round {
                close-price: close-price,
                is-resolved: true,
                winning-direction: winning-dir,
                prize-pool: (- (get prize-pool round) fee-amount)
            }))
            
            ;; Collect fees
            (var-set total-fees-collected (+ (var-get total-fees-collected) fee-amount))
            
            ;; Start next round
            (var-set current-round (+ round-id u1))
            (start-new-round)
            
            (ok { winning-direction: winning-dir, close-price: close-price })
        )
    )
)

;; Claim Winnings
(define-public (claim-winnings (round-id uint))
    (let (
        (round (unwrap! (map-get? rounds round-id) ERR_ROUND_NOT_ACTIVE))
        (user tx-sender)
        (prediction (unwrap! (map-get? user-predictions { round: round-id, user: user }) ERR_NOT_WINNER))
    )
        ;; Validations
        (asserts! (get is-resolved round) ERR_ROUND_NOT_RESOLVED)
        (asserts! (not (get claimed prediction)) ERR_ALREADY_CLAIMED)
        (asserts! (is-eq (get direction prediction) (get winning-direction round)) ERR_NOT_WINNER)
        
        (let (
            (user-amount (get amount prediction))
            (winning-pool (if (is-eq (get winning-direction round) PREDICT_UP)
                            (get total-up-amount round)
                            (get total-down-amount round)))
            (total-pool (get prize-pool round))
            ;; User share = (user-amount / winning-pool) * total-pool
            (winnings (/ (* user-amount total-pool) winning-pool))
        )
            ;; Mark as claimed
            (map-set user-predictions { round: round-id, user: user } (merge prediction { claimed: true }))
            
            ;; Transfer winnings
            (try! (as-contract (stx-transfer? winnings tx-sender user)))
            
            ;; Update user stats
            (update-user-win-stats user winnings)
            
            (ok winnings)
        )
    )
)

;; Update User Bet Stats
(define-private (update-user-bet-stats (user principal) (amount uint))
    (let (
        (current-stats (default-to {
            total-bets: u0,
            total-wins: u0,
            total-wagered: u0,
            total-won: u0,
            current-streak: u0,
            best-streak: u0
        } (map-get? user-stats user)))
    )
        (map-set user-stats user (merge current-stats {
            total-bets: (+ (get total-bets current-stats) u1),
            total-wagered: (+ (get total-wagered current-stats) amount)
        }))
        true
    )
)

;; Update User Win Stats
(define-private (update-user-win-stats (user principal) (amount uint))
    (let (
        (current-stats (default-to {
            total-bets: u0,
            total-wins: u0,
            total-wagered: u0,
            total-won: u0,
            current-streak: u0,
            best-streak: u0
        } (map-get? user-stats user)))
        (new-streak (+ (get current-streak current-stats) u1))
    )
        (map-set user-stats user (merge current-stats {
            total-wins: (+ (get total-wins current-stats) u1),
            total-won: (+ (get total-won current-stats) amount),
            current-streak: new-streak,
            best-streak: (if (> new-streak (get best-streak current-stats)) new-streak (get best-streak current-stats))
        }))
        true
    )
)

;; Read-only Functions

(define-read-only (get-current-round)
    (var-get current-round)
)

(define-read-only (get-round-info (round-id uint))
    (map-get? rounds round-id)
)

(define-read-only (get-user-prediction (round-id uint) (user principal))
    (map-get? user-predictions { round: round-id, user: user })
)

(define-read-only (get-user-stats (user principal))
    (map-get? user-stats user)
)

(define-read-only (get-total-volume)
    (var-get total-volume)
)

(define-read-only (get-platform-stats)
    {
        current-round: (var-get current-round),
        total-volume: (var-get total-volume),
        total-fees: (var-get total-fees-collected),
        is-paused: (var-get is-paused)
    }
)

(define-read-only (get-current-round-info)
    (map-get? rounds (var-get current-round))
)

(define-read-only (calculate-potential-winnings (direction uint) (amount uint))
    (let (
        (round (unwrap! (map-get? rounds (var-get current-round)) u0))
        (total-pool (+ (get prize-pool round) amount))
        (winning-pool (if (is-eq direction PREDICT_UP)
                        (+ (get total-up-amount round) amount)
                        (+ (get total-down-amount round) amount)))
    )
        (if (is-eq winning-pool u0)
            total-pool
            (/ (* amount (- total-pool (/ (* total-pool PLATFORM_FEE) u10000))) winning-pool)
        )
    )
)

(define-read-only (get-round-odds)
    (let (
        (round (unwrap! (map-get? rounds (var-get current-round)) { up-odds: u0, down-odds: u0 }))
        (up-amount (get total-up-amount round))
        (down-amount (get total-down-amount round))
        (total (+ up-amount down-amount))
    )
        (if (is-eq total u0)
            { up-odds: u5000, down-odds: u5000 } ;; 50/50 default
            {
                up-odds: (/ (* up-amount u10000) total),
                down-odds: (/ (* down-amount u10000) total)
            }
        )
    )
)

;; Admin Functions

(define-public (set-price (price uint))
    (begin
        (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_NOT_OWNER)
        (var-set latest-price price)
        (map-set price-oracle stacks-block-height price)
        (ok price)
    )
)

(define-public (pause-contract (paused bool))
    (begin
        (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_NOT_OWNER)
        (var-set is-paused paused)
        (ok paused)
    )
)

(define-public (withdraw-fees (amount uint))
    (begin
        (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_NOT_OWNER)
        (try! (as-contract (stx-transfer? amount tx-sender CONTRACT_OWNER)))
        (ok amount)
    )
)

(define-public (emergency-withdraw)
    (let ((balance (stx-get-balance (as-contract tx-sender))))
        (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_NOT_OWNER)
        (try! (as-contract (stx-transfer? balance tx-sender CONTRACT_OWNER)))
        (ok balance)
    )
)

