;; Token Vesting Contract
;; Lock tokens with time-based release

(define-constant CONTRACT-OWNER tx-sender)
(define-constant ERR-NOT-OWNER (err u100))
(define-constant ERR-NOT-UNLOCKED (err u101))
(define-constant ERR-NO-VESTING (err u102))

(define-map vestings 
  principal 
  { amount: uint, start-block: uint, duration: uint, claimed: uint })

(define-public (create-vesting (beneficiary principal) (amount uint) (duration uint))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-OWNER)
    (map-set vestings beneficiary {
      amount: amount,
      start-block: block-height,
      duration: duration,
      claimed: u0
    })
    (ok true)))

(define-read-only (get-vesting (user principal))
  (map-get? vestings user))

(define-read-only (get-unlocked-amount (user principal))
  (match (map-get? vestings user)
    vesting 
      (let (
        (elapsed (- block-height (get start-block vesting)))
        (vested (if (>= elapsed (get duration vesting))
                  (get amount vesting)
                  (/ (* (get amount vesting) elapsed) (get duration vesting))))
      )
      (- vested (get claimed vesting)))
    u0))

(define-read-only (get-owner)
  CONTRACT-OWNER)

