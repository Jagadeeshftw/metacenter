;; metacenter risk-feed-trait
;;
;; Common read interface for Metacenter risk feeds. Implemented by:
;;   - pox5-reader (mainnet): computed from pox-5 state, provenance "onchain"
;;   - risk-feed   (testnet): publisher-posted mirror of mainnet, provenance "mirrored"
;;
;; Units:
;;   pool-sats, obligation-sats: sBTC sats accrued / owed to bonds over `period`
;;   coverage-bps:  pool / obligation * 10000 (none when there are no bonds)
;;   headroom-bps:  how far the pool can fall before bond yield is impaired,
;;                  (1 - obligation / pool) * 10000 (none when there are no bonds)
;;   period-kind:   "cycle" (a PoX reward cycle) or "interval" (a distribution interval)
;;   updated-at:    burn block height at which the figures were read or posted

(define-trait risk-feed-trait (
    (get-coverage-summary () (response {
        period: uint,
        period-kind: (string-ascii 8),
        pool-sats: uint,
        obligation-sats: uint,
        coverage-bps: (optional uint),
        headroom-bps: (optional uint),
        updated-at: uint,
        provenance: (string-ascii 12),
    } uint))
))
