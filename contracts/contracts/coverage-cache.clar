;; metacenter coverage-cache
;;
;; Why this exists: pox5-reader computes its figures by reading pox-5, and every contract-call?
;; into pox-5 loads that contract, about 569k of read length. Hiro's public
;; /v2/contracts/call-read allows 500,000, so those read-onlys cannot be called off-chain, even
;; though they are correct and cost nothing on-chain. A transaction has no such limit.
;;
;; So `refresh` calls pox5-reader inside a transaction and stores what it answered. Reading the
;; stored copy touches this contract only, which is cheap enough for the public API. Anyone may
;; call `refresh`; the values are pox5-reader's, not the caller's, so a caller can only choose
;; when a reading is taken, never what it says.
;;
;; The figures stay provenance "onchain": pox5-reader computed them from pox-5 state, in a
;; mainnet transaction. `updated-at` is the burn height of the refresh, so staleness is visible;
;; consumers should check it.

(define-constant READER 'SP2Q3XVGTTA4CW3E2AHFZPAGQ0HM9QPHTTBJTQGJY.pox5-reader)

(define-constant ERR_READER (err u200)) ;; pox5-reader returned an error

(define-data-var latest (optional {
    period: uint,
    period-kind: (string-ascii 8),
    pool-sats: uint,
    obligation-sats: uint,
    coverage-bps: (optional uint),
    headroom-bps: (optional uint),
    updated-at: uint,
    provenance: (string-ascii 12),
}) none)

;; Per-cycle extras the dashboard reads beside the summary.
(define-data-var extras (optional {
    cycle: uint,
    intervals-computed: uint,
    obligation-per-interval-sats: uint,
    reserve-sats: uint,
    reserve-cover-cycles-x100: (optional uint),
    reserve-can-pay-bonds: bool,
    pending-sats: uint,
    pending-balanced: bool,
    last-compute-height: uint,
    bonds: (list 6 {
        bond-index: uint,
        stx-value-ratio: uint,
        target-rate: uint,
        shares: uint,
        target-per-interval: uint,
    }),
    stacks-height: uint,
    updated-at: uint,
}) none)

;; ---------------------------------------------------------------------------
;; Reads (no pox-5 access: callable through a public node's read-only endpoint)
;; ---------------------------------------------------------------------------

;; risk-feed-trait. Errors until the first refresh.
(define-read-only (get-coverage-summary)
    (match (var-get latest)
        s (ok s)
        ERR_READER
    )
)

(define-read-only (get-extras)
    (var-get extras)
)

;; Burn height of the last refresh, for staleness checks.
(define-read-only (get-updated-at)
    (match (var-get latest)
        s (some (get updated-at s))
        none
    )
)

;; ---------------------------------------------------------------------------
;; Refresh (permissionless)
;; ---------------------------------------------------------------------------

(define-public (refresh)
    (let (
            (summary (unwrap! (contract-call? 'SP2Q3XVGTTA4CW3E2AHFZPAGQ0HM9QPHTTBJTQGJY.pox5-reader
                get-coverage-summary
            )
                ERR_READER
            ))
            (cycle (contract-call? 'SP2Q3XVGTTA4CW3E2AHFZPAGQ0HM9QPHTTBJTQGJY.pox5-reader
                get-current-cycle
            ))
            (cover (contract-call? 'SP2Q3XVGTTA4CW3E2AHFZPAGQ0HM9QPHTTBJTQGJY.pox5-reader
                get-reserve-cover-cycles cycle
            ))
            (pending (contract-call? 'SP2Q3XVGTTA4CW3E2AHFZPAGQ0HM9QPHTTBJTQGJY.pox5-reader
                get-pending-pool
            ))
            (record {
                cycle: cycle,
                intervals-computed: (contract-call? 'SP2Q3XVGTTA4CW3E2AHFZPAGQ0HM9QPHTTBJTQGJY.pox5-reader
                    get-intervals-computed cycle
                ),
                obligation-per-interval-sats: (contract-call? 'SP2Q3XVGTTA4CW3E2AHFZPAGQ0HM9QPHTTBJTQGJY.pox5-reader
                    get-obligation-per-interval cycle
                ),
                reserve-sats: (get reserve-sats cover),
                reserve-cover-cycles-x100: (get cover-cycles-x100 cover),
                reserve-can-pay-bonds: (get reserve-can-pay-bonds cover),
                pending-sats: (get pending-sats pending),
                pending-balanced: (get balanced pending),
                last-compute-height: (get last-compute-height pending),
                bonds: (contract-call? 'SP2Q3XVGTTA4CW3E2AHFZPAGQ0HM9QPHTTBJTQGJY.pox5-reader
                    get-bond-payout-order cycle
                ),
                stacks-height: stacks-block-height,
                updated-at: burn-block-height,
            })
        )
        (var-set latest (some (merge summary { updated-at: burn-block-height })))
        (var-set extras (some record))
        (print (merge { topic: "metacenter-cache-refresh", reader: READER } (merge summary record)))
        (ok record)
    )
)
