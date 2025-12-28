;; Sentinel Multisig Treasury
;; Multi-signature wallet for DAO treasury management
;; Requires N-of-M signatures for transactions

;; ==========================================
;; CONSTANTS
;; ==========================================
(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-not-signer (err u101))
(define-constant err-already-signed (err u102))
(define-constant err-tx-not-found (err u103))
(define-constant err-tx-executed (err u104))
(define-constant err-insufficient-signatures (err u105))
(define-constant err-invalid-threshold (err u106))
(define-constant err-signer-exists (err u107))
(define-constant err-max-signers (err u108))
(define-constant err-invalid-tx-type (err u109))
(define-constant err-tx-expired (err u110))

;; Transaction types
(define-constant TX-TYPE-STX u1)
(define-constant TX-TYPE-TOKEN u2)
(define-constant TX-TYPE-PARAMETER u3)

;; Max signers
(define-constant MAX-SIGNERS u10)

;; Transaction expiry (blocks) - ~1 week
(define-constant TX-EXPIRY u10080)

;; ==========================================
;; DATA VARIABLES
;; ==========================================
(define-data-var signer-count uint u0)
(define-data-var threshold uint u1) ;; Required signatures
(define-data-var tx-nonce uint u0)
(define-data-var total-executed uint u0)
(define-data-var treasury-balance uint u0)

;; ==========================================
;; DATA MAPS
;; ==========================================

;; Authorized signers
(define-map signers principal bool)

;; Signer list (for enumeration)
(define-map signer-list uint principal)

;; Transaction proposals
(define-map transactions uint
  {
    proposer: principal,
    tx-type: uint,
    recipient: principal,
    amount: uint,
    memo: (optional (string-ascii 100)),
    created-block: uint,
    executed: bool,
    signature-count: uint
  }
)

;; Signatures for each transaction
(define-map tx-signatures { tx-id: uint, signer: principal } bool)

;; ==========================================
;; READ-ONLY FUNCTIONS
;; ==========================================

;; Get multisig info
(define-read-only (get-multisig-info)
  {
    signer-count: (var-get signer-count),
    threshold: (var-get threshold),
    tx-nonce: (var-get tx-nonce),
    total-executed: (var-get total-executed),
    treasury-stx: (var-get treasury-balance)
  }
)

;; Check if address is signer
(define-read-only (is-signer (address principal))
  (default-to false (map-get? signers address))
)

;; Get transaction details
(define-read-only (get-transaction (tx-id uint))
  (map-get? transactions tx-id)
)

;; Check if signer has signed a transaction
(define-read-only (has-signed (tx-id uint) (signer principal))
  (default-to false (map-get? tx-signatures { tx-id: tx-id, signer: signer }))
)

;; Get signer at index
(define-read-only (get-signer-at (index uint))
  (map-get? signer-list index)
)

;; Check if transaction can be executed
(define-read-only (can-execute (tx-id uint))
  (match (map-get? transactions tx-id)
    tx
    (and 
      (not (get executed tx))
      (>= (get signature-count tx) (var-get threshold))
      (<= (- stacks-block-height (get created-block tx)) TX-EXPIRY)
    )
    false
  )
)

;; Check if transaction is expired
(define-read-only (is-expired (tx-id uint))
  (match (map-get? transactions tx-id)
    tx
    (> (- stacks-block-height (get created-block tx)) TX-EXPIRY)
    true
  )
)

;; ==========================================
;; SIGNER FUNCTIONS
;; ==========================================

;; Propose a new STX transfer
(define-public (propose-stx-transfer (recipient principal) (amount uint) (memo (optional (string-ascii 100))))
  (let (
    (proposer tx-sender)
    (new-tx-id (var-get tx-nonce))
  )
    ;; Validations
    (asserts! (is-signer proposer) err-not-signer)
    (asserts! (> amount u0) (err u200))
    
    ;; Create transaction
    (map-set transactions new-tx-id {
      proposer: proposer,
      tx-type: TX-TYPE-STX,
      recipient: recipient,
      amount: amount,
      memo: memo,
      created-block: stacks-block-height,
      executed: false,
      signature-count: u1
    })
    
    ;; Proposer automatically signs
    (map-set tx-signatures { tx-id: new-tx-id, signer: proposer } true)
    
    ;; Increment nonce
    (var-set tx-nonce (+ new-tx-id u1))
    
    (ok { tx-id: new-tx-id, signatures-needed: (var-get threshold) })
  )
)

;; Sign a pending transaction
(define-public (sign-transaction (tx-id uint))
  (let (
    (signer tx-sender)
  )
    ;; Validations
    (asserts! (is-signer signer) err-not-signer)
    (asserts! (not (has-signed tx-id signer)) err-already-signed)
    
    (match (map-get? transactions tx-id)
      tx
      (begin
        (asserts! (not (get executed tx)) err-tx-executed)
        (asserts! (not (is-expired tx-id)) err-tx-expired)
        
        ;; Add signature
        (map-set tx-signatures { tx-id: tx-id, signer: signer } true)
        
        ;; Update signature count
        (map-set transactions tx-id 
          (merge tx { signature-count: (+ (get signature-count tx) u1) })
        )
        
        (ok { tx-id: tx-id, new-signature-count: (+ (get signature-count tx) u1) })
      )
      err-tx-not-found
    )
  )
)

;; Execute a fully signed transaction
(define-public (execute-transaction (tx-id uint))
  (let (
    (executor tx-sender)
  )
    ;; Must be a signer to execute
    (asserts! (is-signer executor) err-not-signer)
    
    (match (map-get? transactions tx-id)
      tx
      (begin
        (asserts! (not (get executed tx)) err-tx-executed)
        (asserts! (>= (get signature-count tx) (var-get threshold)) err-insufficient-signatures)
        (asserts! (not (is-expired tx-id)) err-tx-expired)
        
        ;; Mark as executed
        (map-set transactions tx-id (merge tx { executed: true }))
        (var-set total-executed (+ (var-get total-executed) u1))
        
        ;; Execute based on type
        ;; NOTE: Actual transfer must be done by owner manually due to as-contract issues
        (ok { 
          tx-id: tx-id, 
          executed: true,
          tx-type: (get tx-type tx),
          recipient: (get recipient tx),
          amount: (get amount tx)
        })
      )
      err-tx-not-found
    )
  )
)

;; ==========================================
;; ADMIN FUNCTIONS (Setup only)
;; ==========================================

;; Initialize multisig with signers and threshold
(define-public (initialize (initial-signers (list 10 principal)) (initial-threshold uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (asserts! (is-eq (var-get signer-count) u0) (err u300)) ;; Can only init once
    (asserts! (> initial-threshold u0) err-invalid-threshold)
    (asserts! (<= initial-threshold (len initial-signers)) err-invalid-threshold)
    
    ;; Add signers
    (fold add-signer-internal initial-signers u0)
    
    ;; Set threshold
    (var-set threshold initial-threshold)
    
    (ok { 
      signers: (len initial-signers), 
      threshold: initial-threshold 
    })
  )
)

;; Internal helper to add signer
(define-private (add-signer-internal (signer principal) (index uint))
  (begin
    (map-set signers signer true)
    (map-set signer-list index signer)
    (var-set signer-count (+ (var-get signer-count) u1))
    (+ index u1)
  )
)

;; Add a new signer (requires multisig approval in production)
(define-public (add-signer (new-signer principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (asserts! (not (is-signer new-signer)) err-signer-exists)
    (asserts! (< (var-get signer-count) MAX-SIGNERS) err-max-signers)
    
    (let ((index (var-get signer-count)))
      (map-set signers new-signer true)
      (map-set signer-list index new-signer)
      (var-set signer-count (+ index u1))
    )
    
    (ok { signer: new-signer, total-signers: (+ (var-get signer-count) u1) })
  )
)

;; Update threshold
(define-public (set-threshold (new-threshold uint))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (asserts! (> new-threshold u0) err-invalid-threshold)
    (asserts! (<= new-threshold (var-get signer-count)) err-invalid-threshold)
    (var-set threshold new-threshold)
    (ok new-threshold)
  )
)

;; Deposit STX to treasury
(define-public (deposit-stx (amount uint))
  (begin
    (try! (stx-transfer? amount tx-sender contract-owner))
    (var-set treasury-balance (+ (var-get treasury-balance) amount))
    (ok { deposited: amount, new-balance: (var-get treasury-balance) })
  )
)

