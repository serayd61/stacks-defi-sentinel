;; ============================================================
;; SENTINEL YIELD FARMING - Çok Havuzlu LP Token Farming
;; ============================================================
;; LP token sahipleri havuzlara stake ederek SNTL kazanır.
;; Her havuzun kendine özel ağırlığı ve APY'si vardır.
;; Compound ödül mekanizması ile sürekli kazanç sağlanır.
;; ============================================================

;; ============================================================
;; CONSTANTS
;; ============================================================

(define-constant contract-owner tx-sender)
(define-constant err-owner-only           (err u100))
(define-constant err-pool-not-found       (err u101))
(define-constant err-pool-inactive        (err u102))
(define-constant err-zero-amount          (err u103))
(define-constant err-no-stake             (err u104))
(define-constant err-lock-period-active   (err u105))
(define-constant err-max-pools-reached    (err u106))
(define-constant err-insufficient-rewards (err u107))
(define-constant err-invalid-multiplier   (err u108))
(define-constant err-contract-paused      (err u109))
(define-constant err-already-exists       (err u110))

;; Toplam blok başına SNTL emission (tüm havuzlara dağıtılacak)
;; 100 SNTL/blok = 100_000_000 micro-SNTL
(define-constant BLOCKS-PER-DAY u144)
(define-constant SNTL-PER-BLOCK u100000000)  ;; 100 SNTL (6 decimal)
(define-constant MAX-POOLS u20)
(define-constant PRECISION u1000000)          ;; 10^6 hassasiyet çarpanı

;; Lock period multiplier (ek ödül için)
;; 0 blok lock = 1x, 1000 blok = 1.5x, 5000 blok = 2x, 10000 blok = 3x
(define-constant LOCK-MULTIPLIER-BASE u100)   ;; 1x = 100

;; ============================================================
;; DATA STRUCTURES
;; ============================================================

(define-data-var total-pools uint u0)
(define-data-var total-alloc-points uint u0)
(define-data-var is-paused bool false)
(define-data-var total-sntl-distributed uint u0)
(define-data-var last-reward-block uint stacks-block-height)

;; Farming havuzu
(define-map pools uint {
  lp-token-contract: principal,  ;; LP token contract adresi
  pool-name: (string-ascii 50),  ;; Havuz adı (ör: "SNTL-STX LP")
  alloc-points: uint,            ;; Ağırlık puanı (daha fazla = daha çok ödül)
  last-reward-block: uint,       ;; Son ödül hesaplama bloğu
  acc-sntl-per-share: uint,      ;; Birikimli SNTL/share (PRECISION ile çarpılı)
  total-staked: uint,            ;; Toplam stake edilen LP token
  total-stakers: uint,           ;; Toplam staker sayısı
  lock-required-blocks: uint,    ;; Minimum lock süresi (blok)
  is-active: bool,               ;; Havuz aktif mi?
  created-at: uint               ;; Oluşturulma bloğu
})

;; Kullanıcı pozisyonu (pool_id, user) -> pozisyon
(define-map user-positions { pool-id: uint, user: principal } {
  amount: uint,             ;; Stake edilen LP token miktarı
  reward-debt: uint,        ;; Ödül borcu (çifte sayım önlemek için)
  pending-reward: uint,     ;; Birikmiş bekleyen ödül
  staked-at: uint,          ;; Stake bloğu
  unlock-at: uint,          ;; Unlock bloğu
  lock-multiplier: uint,    ;; Ödül çarpanı (100 = 1x, 200 = 2x)
  total-earned: uint        ;; Toplam kazanılan SNTL
})

;; Kullanıcı başına toplam stake
(define-map user-total-stake principal uint)

;; ============================================================
;; PRIVATE FUNCTIONS
;; ============================================================

;; Mevcut bloğa kadar olan havuz ödüllerini hesapla
(define-private (get-pool-reward (pool-id uint))
  (match (map-get? pools pool-id)
    pool
    (let (
      (alloc-points (get alloc-points pool))
      (total-alloc (var-get total-alloc-points))
      (blocks-since (- stacks-block-height (get last-reward-block pool)))
      (total-reward (* SNTL-PER-BLOCK blocks-since))
    )
      (if (and (> total-alloc u0) (> (get total-staked pool) u0))
        (/ (* total-reward alloc-points) total-alloc)
        u0
      )
    )
    u0
  )
)

;; Kullanıcının bekleyen ödülünü hesapla
(define-private (calculate-pending-reward (pool-id uint) (user principal))
  (match (map-get? user-positions { pool-id: pool-id, user: user })
    position
    (match (map-get? pools pool-id)
      pool
      (let (
        (acc-per-share (get acc-sntl-per-share pool))
        (pool-reward (get-pool-reward pool-id))
        (total-staked (get total-staked pool))
        (updated-acc-per-share (if (> total-staked u0)
          (+ acc-per-share (/ (* pool-reward PRECISION) total-staked))
          acc-per-share
        ))
        (base-reward (/ (* (get amount position) updated-acc-per-share) PRECISION))
        (reward-before-mult (if (> base-reward (get reward-debt position))
          (- base-reward (get reward-debt position))
          u0
        ))
        ;; Lock multiplier uygula
        (multiplied-reward (/ (* reward-before-mult (get lock-multiplier position)) LOCK-MULTIPLIER-BASE))
      )
        (+ (get pending-reward position) multiplied-reward)
      )
      u0
    )
    u0
  )
)

;; Havuz durumunu güncelle (her işlemden önce çağrılır)
(define-private (update-pool (pool-id uint))
  (match (map-get? pools pool-id)
    pool
    (let (
      (pool-reward (get-pool-reward pool-id))
      (total-staked (get total-staked pool))
    )
      (map-set pools pool-id (merge pool {
        acc-sntl-per-share: (if (> total-staked u0)
          (+ (get acc-sntl-per-share pool) (/ (* pool-reward PRECISION) total-staked))
          (get acc-sntl-per-share pool)
        ),
        last-reward-block: stacks-block-height
      }))
      true
    )
    false
  )
)

;; Lock süresine göre multiplier hesapla
(define-private (calculate-lock-multiplier (lock-blocks uint))
  (if (>= lock-blocks u10000)
    u300  ;; 3x for 10000+ blocks
    (if (>= lock-blocks u5000)
      u200  ;; 2x for 5000+ blocks
      (if (>= lock-blocks u1000)
        u150  ;; 1.5x for 1000+ blocks
        u100  ;; 1x base
      )
    )
  )
)

;; ============================================================
;; PUBLIC FUNCTIONS - POOL MANAGEMENT (OWNER)
;; ============================================================

;; Yeni farming havuzu ekle
(define-public (add-pool
  (lp-token-contract principal)
  (pool-name (string-ascii 50))
  (alloc-points uint)
  (lock-required-blocks uint))
  (let (
    (pool-id (var-get total-pools))
  )
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (asserts! (< pool-id MAX-POOLS) err-max-pools-reached)
    (asserts! (> alloc-points u0) err-zero-amount)

    (map-set pools pool-id {
      lp-token-contract: lp-token-contract,
      pool-name: pool-name,
      alloc-points: alloc-points,
      last-reward-block: stacks-block-height,
      acc-sntl-per-share: u0,
      total-staked: u0,
      total-stakers: u0,
      lock-required-blocks: lock-required-blocks,
      is-active: true,
      created-at: stacks-block-height
    })

    (var-set total-pools (+ pool-id u1))
    (var-set total-alloc-points (+ (var-get total-alloc-points) alloc-points))

    (print {
      event: "pool-added",
      pool-id: pool-id,
      name: pool-name,
      alloc-points: alloc-points,
      lock-blocks: lock-required-blocks
    })

    (ok pool-id)
  )
)

;; Havuz ağırlığını güncelle
(define-public (update-pool-alloc (pool-id uint) (new-alloc-points uint))
  (let (
    (pool (unwrap! (map-get? pools pool-id) err-pool-not-found))
  )
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (asserts! (update-pool pool-id) err-pool-not-found)

    (var-set total-alloc-points
      (+ (- (var-get total-alloc-points) (get alloc-points pool)) new-alloc-points))

    (map-set pools pool-id (merge pool { alloc-points: new-alloc-points }))

    (ok true)
  )
)

;; Havuzu aktif/pasif yap
(define-public (set-pool-active (pool-id uint) (active bool))
  (let ((pool (unwrap! (map-get? pools pool-id) err-pool-not-found)))
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (map-set pools pool-id (merge pool { is-active: active }))
    (ok true)
  )
)

;; ============================================================
;; PUBLIC FUNCTIONS - USER ACTIONS
;; ============================================================

;; LP TOKEN STAKE ET
;; pool-id: Hangi havuza stake yapılacak
;; amount: Kaç LP token
;; lock-blocks: Ne kadar kilitlensin (min: pool'un lock_required_blocks'u)
(define-public (deposit (pool-id uint) (amount uint) (lock-blocks uint))
  (let (
    (pool (unwrap! (map-get? pools pool-id) err-pool-not-found))
    (user tx-sender)
    (lock-mult (calculate-lock-multiplier lock-blocks))
    (unlock-block (+ stacks-block-height lock-blocks))
    (existing-pos (map-get? user-positions { pool-id: pool-id, user: user }))
  )
    (asserts! (not (var-get is-paused)) err-contract-paused)
    (asserts! (get is-active pool) err-pool-inactive)
    (asserts! (> amount u0) err-zero-amount)
    (asserts! (>= lock-blocks (get lock-required-blocks pool)) err-lock-period-active)

    ;; Havuzu güncelle
    (update-pool pool-id)

    (let (
      (updated-pool (unwrap! (map-get? pools pool-id) err-pool-not-found))
      (acc-per-share (get acc-sntl-per-share updated-pool))
    )
      ;; Eğer mevcut pozisyon varsa bekleyen ödülü topla
      (let (
        (pending (match existing-pos
          pos (let (
            (base-reward (if (> (/ (* (get amount pos) acc-per-share) PRECISION)
                              (get reward-debt pos))
              (- (/ (* (get amount pos) acc-per-share) PRECISION) (get reward-debt pos))
              u0
            ))
          )
            (/ (* base-reward (get lock-multiplier pos)) LOCK-MULTIPLIER-BASE)
          )
          u0
        ))
        (current-amount (match existing-pos pos (get amount pos) u0))
        (current-pending (match existing-pos pos (get pending-reward pos) u0))
        (current-earned (match existing-pos pos (get total-earned pos) u0))
        (new-amount (+ current-amount amount))
        (new-reward-debt (/ (* new-amount acc-per-share) PRECISION))
      )
        ;; LP token'ı contract'a transfer et (mock - gerçekte lp-token-contract'a call yapılır)
        ;; (try! (contract-call? (get lp-token-contract pool) transfer amount user (as-contract tx-sender) none))

        ;; Pozisyonu güncelle veya oluştur
        (map-set user-positions { pool-id: pool-id, user: user } {
          amount: new-amount,
          reward-debt: new-reward-debt,
          pending-reward: (+ current-pending pending),
          staked-at: stacks-block-height,
          unlock-at: unlock-block,
          lock-multiplier: lock-mult,
          total-earned: current-earned
        })

        ;; Havuz toplam stake güncelle
        (map-set pools pool-id (merge updated-pool {
          total-staked: (+ (get total-staked updated-pool) amount),
          total-stakers: (if (is-none existing-pos)
            (+ (get total-stakers updated-pool) u1)
            (get total-stakers updated-pool)
          )
        }))

        ;; Kullanıcı toplam stake güncelle
        (map-set user-total-stake user
          (+ (default-to u0 (map-get? user-total-stake user)) amount))

        (print {
          event: "deposit",
          pool-id: pool-id,
          user: user,
          amount: amount,
          lock-blocks: lock-blocks,
          multiplier: lock-mult,
          pending-collected: pending
        })

        (ok { deposited: amount, pending-collected: pending, multiplier: lock-mult })
      )
    )
  )
)

;; ÖDÜL TOPLA (withdraw yapmadan)
(define-public (harvest (pool-id uint))
  (let (
    (user tx-sender)
    (position (unwrap! (map-get? user-positions { pool-id: pool-id, user: user }) err-no-stake))
  )
    (asserts! (not (var-get is-paused)) err-contract-paused)

    ;; Havuzu güncelle
    (update-pool pool-id)

    (let (
      (updated-pool (unwrap! (map-get? pools pool-id) err-pool-not-found))
      (acc-per-share (get acc-sntl-per-share updated-pool))
      (base-reward (let ((gross (/ (* (get amount position) acc-per-share) PRECISION)))
        (if (> gross (get reward-debt position))
          (- gross (get reward-debt position))
          u0
        )
      ))
      (new-reward (/ (* base-reward (get lock-multiplier position)) LOCK-MULTIPLIER-BASE))
      (total-pending (+ (get pending-reward position) new-reward))
    )
      (asserts! (> total-pending u0) err-insufficient-rewards)

      ;; SNTL ödülünü mint et
      (try! (contract-call? .sentinel-token mint total-pending user))

      ;; Pozisyonu güncelle
      (map-set user-positions { pool-id: pool-id, user: user }
        (merge position {
          reward-debt: (/ (* (get amount position) acc-per-share) PRECISION),
          pending-reward: u0,
          total-earned: (+ (get total-earned position) total-pending)
        })
      )

      (var-set total-sntl-distributed (+ (var-get total-sntl-distributed) total-pending))

      (print {
        event: "harvest",
        pool-id: pool-id,
        user: user,
        amount: total-pending
      })

      (ok total-pending)
    )
  )
)

;; LP TOKEN ÇEKME
;; amount: Çekilecek LP token miktarı (0 = sadece ödül topla)
(define-public (withdraw (pool-id uint) (amount uint))
  (let (
    (user tx-sender)
    (position (unwrap! (map-get? user-positions { pool-id: pool-id, user: user }) err-no-stake))
    (pool (unwrap! (map-get? pools pool-id) err-pool-not-found))
  )
    (asserts! (not (var-get is-paused)) err-contract-paused)
    (asserts! (<= amount (get amount position)) err-zero-amount)
    ;; Lock kontrolü
    (asserts! (>= stacks-block-height (get unlock-at position)) err-lock-period-active)

    ;; Havuzu güncelle
    (update-pool pool-id)

    (let (
      (updated-pool (unwrap! (map-get? pools pool-id) err-pool-not-found))
      (acc-per-share (get acc-sntl-per-share updated-pool))
      (base-reward (let ((gross (/ (* (get amount position) acc-per-share) PRECISION)))
        (if (> gross (get reward-debt position)) (- gross (get reward-debt position)) u0)
      ))
      (multiplied-reward (/ (* base-reward (get lock-multiplier position)) LOCK-MULTIPLIER-BASE))
      (total-pending (+ (get pending-reward position) multiplied-reward))
      (new-amount (- (get amount position) amount))
    )
      ;; Ödülü dağıt
      (if (> total-pending u0)
        (try! (contract-call? .sentinel-token mint total-pending user))
        true
      )

      ;; LP tokenı iade et
      ;; (try! (as-contract (contract-call? (get lp-token-contract pool) transfer amount tx-sender user none)))

      ;; Pozisyonu güncelle veya sil
      (if (is-eq new-amount u0)
        (map-delete user-positions { pool-id: pool-id, user: user })
        (map-set user-positions { pool-id: pool-id, user: user }
          (merge position {
            amount: new-amount,
            reward-debt: (/ (* new-amount acc-per-share) PRECISION),
            pending-reward: u0,
            total-earned: (+ (get total-earned position) total-pending)
          })
        )
      )

      ;; Havuz toplam güncelle
      (map-set pools pool-id (merge updated-pool {
        total-staked: (- (get total-staked updated-pool) amount),
        total-stakers: (if (is-eq new-amount u0)
          (- (get total-stakers updated-pool) u1)
          (get total-stakers updated-pool)
        )
      }))

      (map-set user-total-stake user
        (- (default-to amount (map-get? user-total-stake user)) amount))

      (if (> total-pending u0)
        (var-set total-sntl-distributed (+ (var-get total-sntl-distributed) total-pending))
        true
      )

      (print {
        event: "withdraw",
        pool-id: pool-id,
        user: user,
        withdrawn: amount,
        rewards: total-pending
      })

      (ok { withdrawn: amount, rewards: total-pending })
    )
  )
)

;; ============================================================
;; READ-ONLY FUNCTIONS
;; ============================================================

(define-read-only (get-pool (pool-id uint))
  (map-get? pools pool-id)
)

(define-read-only (get-user-position (pool-id uint) (user principal))
  (map-get? user-positions { pool-id: pool-id, user: user })
)

(define-read-only (get-pending-reward (pool-id uint) (user principal))
  (ok (calculate-pending-reward pool-id user))
)

(define-read-only (get-farming-stats)
  {
    total-pools: (var-get total-pools),
    total-alloc-points: (var-get total-alloc-points),
    sntl-per-block: SNTL-PER-BLOCK,
    total-sntl-distributed: (var-get total-sntl-distributed),
    is-paused: (var-get is-paused)
  }
)

(define-read-only (get-user-total-stake (user principal))
  (default-to u0 (map-get? user-total-stake user))
)

(define-read-only (get-pool-apy-basis (pool-id uint))
  (match (map-get? pools pool-id)
    pool
    (let (
      (pool-reward-per-block (if (> (var-get total-alloc-points) u0)
        (/ (* SNTL-PER-BLOCK (get alloc-points pool)) (var-get total-alloc-points))
        u0
      ))
      (pool-reward-per-year (* pool-reward-per-block (* BLOCKS-PER-DAY u365)))
    )
      (ok { pool-id: pool-id, reward-per-block: pool-reward-per-block,
            reward-per-year: pool-reward-per-year, total-staked: (get total-staked pool) })
    )
    (err err-pool-not-found)
  )
)

;; ============================================================
;; ADMIN
;; ============================================================

(define-public (set-paused (paused bool))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (var-set is-paused paused)
    (ok true)
  )
)
