;; Achievement Badge Contract
;; Issue and track achievement badges

(define-constant CONTRACT-OWNER tx-sender)
(define-constant ERR-NOT-OWNER (err u100))
(define-constant ERR-ALREADY-HAS-BADGE (err u101))
(define-constant ERR-BADGE-NOT-FOUND (err u102))

(define-data-var badge-counter uint u0)
(define-data-var total-issued uint u0)

(define-map badge-types uint { name: (string-ascii 50), description: (string-ascii 200), points: uint })
(define-map user-badges { user: principal, badge-id: uint } { earned-at: uint })
(define-map user-badge-count principal uint)
(define-map user-total-points principal uint)

(define-public (create-badge (name (string-ascii 50)) (description (string-ascii 200)) (points uint))
  (let ((badge-id (var-get badge-counter)))
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-OWNER)
    (map-set badge-types badge-id { name: name, description: description, points: points })
    (var-set badge-counter (+ badge-id u1))
    (ok badge-id)))

(define-public (award-badge (user principal) (badge-id uint))
  (let ((badge (unwrap! (map-get? badge-types badge-id) ERR-BADGE-NOT-FOUND)))
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-OWNER)
    (asserts! (is-none (map-get? user-badges { user: user, badge-id: badge-id })) ERR-ALREADY-HAS-BADGE)
    (map-set user-badges { user: user, badge-id: badge-id } { earned-at: block-height })
    (map-set user-badge-count user (+ (default-to u0 (map-get? user-badge-count user)) u1))
    (map-set user-total-points user (+ (default-to u0 (map-get? user-total-points user)) (get points badge)))
    (var-set total-issued (+ (var-get total-issued) u1))
    (ok true)))

(define-read-only (get-badge-type (badge-id uint))
  (map-get? badge-types badge-id))

(define-read-only (has-badge (user principal) (badge-id uint))
  (is-some (map-get? user-badges { user: user, badge-id: badge-id })))

(define-read-only (get-user-badge-count (user principal))
  (default-to u0 (map-get? user-badge-count user)))

(define-read-only (get-user-points (user principal))
  (default-to u0 (map-get? user-total-points user)))

(define-read-only (get-total-badges-created)
  (var-get badge-counter))

(define-read-only (get-total-issued)
  (var-get total-issued))

