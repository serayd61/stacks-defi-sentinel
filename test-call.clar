;; Test contract-call
(define-read-only (get-token-name)
  (contract-call? 'SP387HJN7F2HR9KQ4250YGFCA4815T1F9X7N74C5W.sentinel-token get-name))

