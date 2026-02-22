;; ============================================================
;; SENTINEL PORTFOLIO VAULT - Otomatik Portföy Yönetimi
;; ============================================================
;; Kullanıcılar hedef token dağılımı belirler. Vault otomatik
;; rebalancing yapar. Herkes kendi vault'unu oluşturabilir.
;; Sosyal vault özelliği ile başarılı portföylere yatırım yapılır.
;; ============================================================

;; ============================================================
;; CONSTANTS
;; ============================================================

(define-constant contract-owner tx-sender)
(define-constant err-owner-only           (err u100))
(define-constant err-vault-not-found      (err u101))
(define-constant err-not-vault-owner      (err u102))
(define-constant err-vault-locked         (err u103))
(define-constant err-invalid-allocation   (err u104))
(define-constant err-insufficient-balance (err u105))
(define-constant err-max-tokens-reached   (err u106))
(define-constant err-token-not-in-vault   (err u107))
(define-constant err-rebalance-not-needed (err u108))
(define-constant err-invalid-amount       (err u109))
(define-constant err-contract-paused      (err u110))
(define-constant err-vault-exists         (err u111))
(define-constant err-follower-exists      (err u112))
(define-constant err-not-following        (err u113))
(define-constant err-vault-not-public     (err u114))
(define-constant err-zero-deposit         (err u115))

;; Vault parametreleri
(define-constant MAX-TOKENS-PER-VAULT u10)      ;; Vault başına max token
(define-constant ALLOCATION-PRECISION u10000)    ;; %100 = 10000 basis points
(define-constant MAX-VAULTS u1000)               ;; Toplam max vault
(define-constant REBALANCE-THRESHOLD u500)       ;; %5 sapma = rebalancing tetikle
(define-constant MIN-DEPOSIT-STX u5000000)       ;; Min 5 STX deposit
(define-constant SOCIAL-VAULT-FEE u200)          ;; %2 social vault management fee
(define-constant PROTOCOL-FEE-RATE u50)          ;; %0.5 protocol fee (rebalancing'de)
(define-constant VAULT-LOCK-BLOCKS u144)         ;; Deposit sonrası 1 günlük lock

;; Desteklenen tokenlar (indeks)
(define-constant TOKEN-STX   u0)
(define-constant TOKEN-SNTL  u1)
(define-constant TOKEN-SBTC  u2)
(define-constant TOKEN-ALEX  u3)
(define-constant TOKEN-VELAR u4)

;; Rebalancing stratejileri
(define-constant STRATEGY-MANUAL     u0)  ;; Sadece manuel rebalancing
(define-constant STRATEGY-AUTO-5PCT  u1)  ;; %5 sapma = otomatik rebalancing
(define-constant STRATEGY-AUTO-10PCT u2)  ;; %10 sapma = otomatik rebalancing
(define-constant STRATEGY-TIME-BASED u3)  ;; Her 1000 blokta rebalancing

;; ============================================================
;; DATA STRUCTURES
;; ============================================================

(define-data-var next-vault-id uint u1)
(define-data-var total-vaults uint u0)
(define-data-var total-tvl-stx uint u0)          ;; Tüm vault'lardaki toplam STX
(define-data-var total-rebalances uint u0)
(define-data-var is-paused bool false)
(define-data-var treasury principal contract-owner)

;; Ana vault yapısı
(define-map vaults uint {
  owner: principal,
  name: (string-ascii 50),
  description: (string-utf8 200),
  strategy: uint,               ;; 0=manual, 1=auto5%, 2=auto10%, 3=time
  is-public: bool,              ;; Social vault özelliği
  management-fee: uint,         ;; Social vault için yönetim ücreti (bps)
  total-value-stx: uint,        ;; Toplam vault değeri (STX cinsinden)
  total-deposits: uint,         ;; Toplam yatırılan STX
  total-withdrawals: uint,      ;; Toplam çekilen STX
  total-rebalances: uint,
  created-at: uint,
  last-rebalanced-at: uint,
  follower-count: uint,         ;; Social vault takipçi sayısı
  is-active: bool
})

;; Vault token hedef dağılımı
;; (vault-id, token) -> hedef yüzde (basis points)
(define-map vault-allocations { vault-id: uint, token-index: uint } {
  target-pct: uint,             ;; Hedef oran (basis points, 10000 = %100)
  current-value-stx: uint,      ;; Şu anki STX değeri
  amount: uint,                 ;; Token miktarı
  last-updated: uint
})

;; Vault'taki token listesi
(define-map vault-token-count uint uint)  ;; vault-id -> token sayısı

;; Kullanıcı pozisyonu (tek vault başına)
(define-map user-vault-positions { vault-id: uint, user: principal } {
  deposited-stx: uint,          ;; Yatırılan STX
  vault-shares: uint,           ;; Vault share'i
  joined-at: uint,
  unlock-at: uint,
  accumulated-fees-paid: uint,
  last-harvest: uint
})

;; Social vault takibi
(define-map vault-followers { vault-id: uint, follower: principal } {
  copy-amount-stx: uint,        ;; Kopyalanan miktar
  joined-at: uint,
  total-gained-stx: uint
})

;; Vault toplam share'i
(define-map vault-total-shares uint uint)

;; Kullanıcı vault'u (her kullanıcı 1 vault sahibi olabilir)
(define-map user-owned-vault principal uint)

;; Rebalancing geçmişi
(define-map rebalance-history { vault-id: uint, index: uint } {
  before-allocations: (list 10 uint),  ;; Önceki dağılımlar
  after-allocations: (list 10 uint),   ;; Sonraki dağılımlar
  rebalanced-at: uint,
  triggered-by: principal,
  gas-cost: uint
})

(define-map vault-rebalance-count uint uint)

;; ============================================================
;; PRIVATE FUNCTIONS
;; ============================================================

(define-private (calculate-shares (deposit-stx uint) (total-value uint) (total-shares uint))
  (if (or (is-eq total-value u0) (is-eq total-shares u0))
    deposit-stx  ;; İlk deposit: 1 share = 1 micro-STX
    (/ (* deposit-stx total-shares) total-value)
  )
)

(define-private (calculate-value (shares uint) (total-value uint) (total-shares uint))
  (if (is-eq total-shares u0)
    u0
    (/ (* shares total-value) total-shares)
  )
)

(define-private (is-rebalance-needed (vault-id uint))
  ;; Herhangi bir token %5'ten fazla sapıyorsa true döner (basitleştirilmiş)
  ;; Gerçekte her token'ın mevcut ve hedef dağılımı kıyaslanır
  (match (map-get? vaults vault-id)
    vault (and
      (get is-active vault)
      (> stacks-block-height (+ (get last-rebalanced-at vault) u144))
    )
    false
  )
)

;; ============================================================
;; PUBLIC FUNCTIONS - VAULT OLUŞTURMA
;; ============================================================

;; YENİ VAULT OLUŞTUR
;; name: Vault adı
;; description: Açıklama
;; strategy: Rebalancing stratejisi
;; is-public: Social vault mı?
;; management-fee: Social vault yönetim ücreti (0-500 bps = 0-5%)
(define-public (create-vault
  (name (string-ascii 50))
  (description (string-utf8 200))
  (strategy uint)
  (is-public bool)
  (management-fee uint))
  (let (
    (user tx-sender)
    (vault-id (var-get next-vault-id))
  )
    (asserts! (not (var-get is-paused)) err-contract-paused)
    (asserts! (is-none (map-get? user-owned-vault user)) err-vault-exists)
    (asserts! (< vault-id MAX-VAULTS) err-vault-not-found)
    (asserts! (<= strategy u3) err-invalid-allocation)
    (asserts! (<= management-fee u500) err-invalid-allocation)  ;; Max %5

    (map-set vaults vault-id {
      owner: user,
      name: name,
      description: description,
      strategy: strategy,
      is-public: is-public,
      management-fee: management-fee,
      total-value-stx: u0,
      total-deposits: u0,
      total-withdrawals: u0,
      total-rebalances: u0,
      created-at: stacks-block-height,
      last-rebalanced-at: stacks-block-height,
      follower-count: u0,
      is-active: true
    })

    (map-set vault-token-count vault-id u0)
    (map-set vault-total-shares vault-id u0)
    (map-set vault-rebalance-count vault-id u0)
    (map-set user-owned-vault user vault-id)

    (var-set next-vault-id (+ vault-id u1))
    (var-set total-vaults (+ (var-get total-vaults) u1))

    (print {
      event: "vault-created",
      vault-id: vault-id,
      owner: user,
      name: name,
      strategy: strategy,
      is-public: is-public
    })

    (ok vault-id)
  )
)

;; TOKEN DAĞILIMI AYARLA (sadece vault sahibi)
;; Toplam dağılım = 10000 (100%) olmalı
(define-public (set-allocation
  (vault-id uint)
  (token-index uint)
  (target-pct uint))
  (let (
    (vault (unwrap! (map-get? vaults vault-id) err-vault-not-found))
    (token-count (default-to u0 (map-get? vault-token-count vault-id)))
    (existing (map-get? vault-allocations { vault-id: vault-id, token-index: token-index }))
  )
    (asserts! (is-eq tx-sender (get owner vault)) err-not-vault-owner)
    (asserts! (<= token-index u4) err-invalid-allocation)
    (asserts! (> target-pct u0) err-invalid-allocation)

    ;; Yeni token mu?
    (if (is-none existing)
      (begin
        (asserts! (< token-count MAX-TOKENS-PER-VAULT) err-max-tokens-reached)
        (map-set vault-token-count vault-id (+ token-count u1))
      )
      true
    )

    (map-set vault-allocations { vault-id: vault-id, token-index: token-index } {
      target-pct: target-pct,
      current-value-stx: (match existing e (get current-value-stx e) u0),
      amount: (match existing e (get amount e) u0),
      last-updated: stacks-block-height
    })

    (print {
      event: "allocation-set",
      vault-id: vault-id,
      token-index: token-index,
      target-pct: target-pct
    })

    (ok true)
  )
)

;; ============================================================
;; PUBLIC FUNCTIONS - DEPOSIT & WITHDRAW
;; ============================================================

;; VAULT'A DEPOSIT YAP
(define-public (deposit (vault-id uint) (amount-stx uint))
  (let (
    (user tx-sender)
    (vault (unwrap! (map-get? vaults vault-id) err-vault-not-found))
    (total-shares (default-to u0 (map-get? vault-total-shares vault-id)))
    (new-shares (calculate-shares amount-stx (get total-value-stx vault) total-shares))
    (existing-pos (map-get? user-vault-positions { vault-id: vault-id, user: user }))
    (current-shares (match existing-pos p (get vault-shares p) u0))
  )
    (asserts! (not (var-get is-paused)) err-contract-paused)
    (asserts! (get is-active vault) err-vault-not-found)
    (asserts! (>= amount-stx MIN-DEPOSIT-STX) err-invalid-amount)
    (asserts! (>= (stx-get-balance user) amount-stx) err-insufficient-balance)

    ;; STX'i vault'a kilitle
    (try! (stx-transfer? amount-stx user (as-contract tx-sender)))

    ;; Pozisyonu güncelle
    (map-set user-vault-positions { vault-id: vault-id, user: user } {
      deposited-stx: (+ (match existing-pos p (get deposited-stx p) u0) amount-stx),
      vault-shares: (+ current-shares new-shares),
      joined-at: (match existing-pos p (get joined-at p) stacks-block-height),
      unlock-at: (+ stacks-block-height VAULT-LOCK-BLOCKS),
      accumulated-fees-paid: (match existing-pos p (get accumulated-fees-paid p) u0),
      last-harvest: stacks-block-height
    })

    ;; Vault'u güncelle
    (map-set vaults vault-id (merge vault {
      total-value-stx: (+ (get total-value-stx vault) amount-stx),
      total-deposits: (+ (get total-deposits vault) amount-stx)
    }))

    ;; Toplam share güncelle
    (map-set vault-total-shares vault-id (+ total-shares new-shares))

    ;; Global TVL güncelle
    (var-set total-tvl-stx (+ (var-get total-tvl-stx) amount-stx))

    (print {
      event: "vault-deposit",
      vault-id: vault-id,
      user: user,
      amount: amount-stx,
      shares-received: new-shares
    })

    (ok { deposited: amount-stx, shares: new-shares })
  )
)

;; VAULT'TAN ÇEKME
(define-public (withdraw (vault-id uint) (shares-to-withdraw uint))
  (let (
    (user tx-sender)
    (vault (unwrap! (map-get? vaults vault-id) err-vault-not-found))
    (position (unwrap! (map-get? user-vault-positions { vault-id: vault-id, user: user })
               err-vault-not-found))
    (total-shares (default-to u1 (map-get? vault-total-shares vault-id)))
    (withdrawal-value (calculate-value shares-to-withdraw (get total-value-stx vault) total-shares))
    (management-fee-amount (if (and (get is-public vault) (not (is-eq (get owner vault) user)))
      (/ (* withdrawal-value (get management-fee vault)) ALLOCATION-PRECISION)
      u0
    ))
    (protocol-fee (/ (* withdrawal-value PROTOCOL-FEE-RATE) ALLOCATION-PRECISION))
    (net-withdrawal (- withdrawal-value (+ management-fee-amount protocol-fee)))
  )
    (asserts! (not (var-get is-paused)) err-contract-paused)
    (asserts! (<= shares-to-withdraw (get vault-shares position)) err-insufficient-balance)
    (asserts! (>= stacks-block-height (get unlock-at position)) err-vault-locked)
    (asserts! (> withdrawal-value u0) err-invalid-amount)

    ;; STX ödemeleri
    (try! (as-contract (stx-transfer? net-withdrawal tx-sender user)))
    (if (> protocol-fee u0)
      (try! (as-contract (stx-transfer? protocol-fee tx-sender (var-get treasury))))
      true
    )
    (if (> management-fee-amount u0)
      (try! (as-contract (stx-transfer? management-fee-amount tx-sender (get owner vault))))
      true
    )

    ;; Pozisyonu güncelle
    (let ((new-shares (- (get vault-shares position) shares-to-withdraw)))
      (if (is-eq new-shares u0)
        (map-delete user-vault-positions { vault-id: vault-id, user: user })
        (map-set user-vault-positions { vault-id: vault-id, user: user }
          (merge position {
            vault-shares: new-shares,
            deposited-stx: (if (>= (get deposited-stx position) withdrawal-value)
              (- (get deposited-stx position) withdrawal-value)
              u0
            )
          })
        )
      )
    )

    ;; Vault güncelle
    (map-set vaults vault-id (merge vault {
      total-value-stx: (if (>= (get total-value-stx vault) withdrawal-value)
        (- (get total-value-stx vault) withdrawal-value) u0),
      total-withdrawals: (+ (get total-withdrawals vault) withdrawal-value)
    }))

    (map-set vault-total-shares vault-id
      (if (>= total-shares shares-to-withdraw)
        (- total-shares shares-to-withdraw) u0))

    (var-set total-tvl-stx
      (if (>= (var-get total-tvl-stx) withdrawal-value)
        (- (var-get total-tvl-stx) withdrawal-value) u0))

    (print {
      event: "vault-withdrawal",
      vault-id: vault-id,
      user: user,
      shares: shares-to-withdraw,
      stx-received: net-withdrawal,
      fees-paid: (+ management-fee-amount protocol-fee)
    })

    (ok { withdrawn-stx: net-withdrawal, fees: (+ management-fee-amount protocol-fee) })
  )
)

;; ============================================================
;; PUBLIC FUNCTIONS - REBALANCING
;; ============================================================

;; MANUEL REBALANCING (Vault sahibi veya keeper)
;; new-allocations: Her token için güncel STX değerleri (en fazla 10 eleman)
(define-public (rebalance
  (vault-id uint)
  (token-values (list 10 { token-index: uint, new-value-stx: uint })))
  (let (
    (caller tx-sender)
    (vault (unwrap! (map-get? vaults vault-id) err-vault-not-found))
    (rebalance-index (default-to u0 (map-get? vault-rebalance-count vault-id)))
  )
    (asserts! (not (var-get is-paused)) err-contract-paused)
    (asserts! (get is-active vault) err-vault-not-found)
    ;; Sadece vault sahibi veya auto stratejide herkes rebalance edebilir
    (asserts! (or
      (is-eq caller (get owner vault))
      (> (get strategy vault) STRATEGY-MANUAL)
    ) err-not-vault-owner)

    ;; Her token değerini güncelle
    (map (lambda (item)
      (match (map-get? vault-allocations { vault-id: vault-id, token-index: (get token-index item) })
        alloc (map-set vault-allocations
          { vault-id: vault-id, token-index: (get token-index item) }
          (merge alloc {
            current-value-stx: (get new-value-stx item),
            last-updated: stacks-block-height
          }))
        false
      )
    ) token-values)

    ;; Vault'u güncelle
    (map-set vaults vault-id (merge vault {
      last-rebalanced-at: stacks-block-height,
      total-rebalances: (+ (get total-rebalances vault) u1)
    }))

    (map-set vault-rebalance-count vault-id (+ rebalance-index u1))
    (var-set total-rebalances (+ (var-get total-rebalances) u1))

    (print {
      event: "vault-rebalanced",
      vault-id: vault-id,
      triggered-by: caller,
      rebalance-index: rebalance-index
    })

    (ok { vault-id: vault-id, rebalances: (+ rebalance-index u1) })
  )
)

;; ============================================================
;; PUBLIC FUNCTIONS - SOCIAL VAULT
;; ============================================================

;; SOCIAL VAULT TAKİP ET
(define-public (follow-vault (vault-id uint) (copy-amount-stx uint))
  (let (
    (follower tx-sender)
    (vault (unwrap! (map-get? vaults vault-id) err-vault-not-found))
  )
    (asserts! (not (var-get is-paused)) err-contract-paused)
    (asserts! (get is-public vault) err-vault-not-public)
    (asserts! (is-none (map-get? vault-followers { vault-id: vault-id, follower: follower }))
      err-follower-exists)
    (asserts! (>= copy-amount-stx MIN-DEPOSIT-STX) err-invalid-amount)
    (asserts! (not (is-eq follower (get owner vault))) err-not-vault-owner)

    ;; Deposit yap
    (try! (deposit vault-id copy-amount-stx))

    ;; Takibi kaydet
    (map-set vault-followers { vault-id: vault-id, follower: follower } {
      copy-amount-stx: copy-amount-stx,
      joined-at: stacks-block-height,
      total-gained-stx: u0
    })

    ;; Vault takipçi sayısını güncelle
    (map-set vaults vault-id (merge vault {
      follower-count: (+ (get follower-count vault) u1)
    }))

    (print {
      event: "vault-followed",
      vault-id: vault-id,
      follower: follower,
      amount: copy-amount-stx
    })

    (ok true)
  )
)

;; SOCIAL VAULT TAKİBİNİ BIRAK
(define-public (unfollow-vault (vault-id uint) (shares-amount uint))
  (let (
    (follower tx-sender)
    (vault (unwrap! (map-get? vaults vault-id) err-vault-not-found))
    (follow-info (unwrap! (map-get? vault-followers { vault-id: vault-id, follower: follower })
                  err-not-following))
  )
    ;; Withdraw
    (try! (withdraw vault-id shares-amount))

    ;; Takibi kaldır
    (map-delete vault-followers { vault-id: vault-id, follower: follower })

    (map-set vaults vault-id (merge vault {
      follower-count: (if (> (get follower-count vault) u0)
        (- (get follower-count vault) u1)
        u0
      )
    }))

    (print { event: "vault-unfollowed", vault-id: vault-id, follower: follower })

    (ok true)
  )
)

;; ============================================================
;; READ-ONLY FUNCTIONS
;; ============================================================

(define-read-only (get-vault (vault-id uint))
  (map-get? vaults vault-id)
)

(define-read-only (get-user-position (vault-id uint) (user principal))
  (map-get? user-vault-positions { vault-id: vault-id, user: user })
)

(define-read-only (get-vault-allocation (vault-id uint) (token-index uint))
  (map-get? vault-allocations { vault-id: vault-id, token-index: token-index })
)

(define-read-only (get-user-vault (user principal))
  (match (map-get? user-owned-vault user)
    vault-id (map-get? vaults vault-id)
    none
  )
)

(define-read-only (get-user-share-value (vault-id uint) (user principal))
  (match (map-get? user-vault-positions { vault-id: vault-id, user: user })
    position
    (match (map-get? vaults vault-id)
      vault
      (let (
        (total-shares (default-to u1 (map-get? vault-total-shares vault-id)))
      )
        (ok (calculate-value (get vault-shares position) (get total-value-stx vault) total-shares))
      )
      (err err-vault-not-found)
    )
    (err err-vault-not-found)
  )
)

(define-read-only (get-platform-stats)
  {
    total-vaults: (var-get total-vaults),
    total-tvl-stx: (var-get total-tvl-stx),
    total-rebalances: (var-get total-rebalances),
    is-paused: (var-get is-paused)
  }
)

(define-read-only (get-follow-info (vault-id uint) (follower principal))
  (map-get? vault-followers { vault-id: vault-id, follower: follower })
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

(define-public (set-treasury (new-treasury principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (var-set treasury new-treasury)
    (ok true)
  )
)

(define-public (deactivate-vault (vault-id uint))
  (let ((vault (unwrap! (map-get? vaults vault-id) err-vault-not-found)))
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (map-set vaults vault-id (merge vault { is-active: false }))
    (ok true)
  )
)
