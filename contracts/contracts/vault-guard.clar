;; metacenter vault-guard (example consumer)
;;
;; Minimal example of a contract that gates an action on a Metacenter risk feed,
;; e.g. a levered staking vault that stops taking deposits when bond coverage
;; gets thin. Not used by anything else; shown for integrators.

(use-trait risk-feed .risk-feed-trait.risk-feed-trait)

(define-constant ERR_UNTRUSTED_FEED (err u200))

;; Pause below 2.0x coverage.
(define-constant MIN_COVERAGE_BPS u20000)
;; Pause if the feed is older than two distribution intervals (mainnet 1050 blocks each).
(define-constant MAX_AGE_BLOCKS u2100)

(define-constant TRUSTED_FEED .risk-feed)

;; Returns (ok {status, ...}) where status is:
;;   "ok"     coverage >= MIN_COVERAGE_BPS, or no bonds to cover (coverage n/a)
;;   "paused" coverage below MIN_COVERAGE_BPS, or the feed is stale
;; Errors: u200 untrusted feed; feed errors (e.g. u104 no data) pass through.
(define-public (check (feed <risk-feed>))
    (begin
        (asserts! (is-eq (contract-of feed) TRUSTED_FEED) ERR_UNTRUSTED_FEED)
        (let (
                (summary (try! (contract-call? feed get-coverage-summary)))
                (age (if (> burn-block-height (get updated-at summary))
                    (- burn-block-height (get updated-at summary))
                    u0
                ))
                (stale (> age MAX_AGE_BLOCKS))
                (thin (match (get coverage-bps summary)
                    coverage (< coverage MIN_COVERAGE_BPS)
                    false
                ))
            )
            (ok {
                status: (if (or stale thin) "paused" "ok"),
                coverage-bps: (get coverage-bps summary),
                stale: stale,
                provenance: (get provenance summary),
            })
        )
    )
)
