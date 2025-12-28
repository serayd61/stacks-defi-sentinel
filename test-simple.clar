;; Simplest possible contract
(define-constant greeting "Hello Stacks!")

(define-read-only (say-hello)
  greeting)

(define-public (do-nothing)
  (ok true))

