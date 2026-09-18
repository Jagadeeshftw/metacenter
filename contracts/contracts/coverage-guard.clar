;; metacenter coverage-guard (example consumer)
;;
;; Minimal example of a contract that gates an action on a Metacenter risk feed,
;; e.g. a levered staking vault that stops taking deposits when bond coverage
;; gets thin. Not used by anything else; shown for integrators.

(use-trait risk-feed .risk-feed-trait.risk-feed-trait)

(define-constant ERR_UNTRUSTED_FEED (err u200))
(define-constant ERR_NOT_OWNER (err u201))

;; Pause below 2.0x coverage.
(define-constant MIN_COVERAGE_BPS u20000)
;; Pause if the feed is older than this many blocks of the HOST chain. Default: two
;; mainnet distribution intervals (2 x 1050). On testnet, Bitcoin blocks come about
;; every 4 minutes, so the owner sets it to cover two intervals of wall-clock time.
(define-constant OWNER tx-sender)
(define-data-var max-age-blocks uint u2100)

(define-read-only (get-max-age-blocks)
    (var-get max-age-blocks)
)

(define-public (set-max-age-blocks (blocks uint))
    (begin
        (asserts! (is-eq tx-sender OWNER) ERR_NOT_OWNER)
        (ok (var-set max-age-blocks blocks))
    )
)

(define-constant TRUSTED_FEED .risk-feed)

;; Returns (ok {status, ...}) where status is:
;;   "ok"     coverage >= MIN_COVERAGE_BPS, or no bonds to cover (coverage n/a)
;;   "paused" coverage below MIN_COVERAGE_BPS, or the feed is stale
;; Errors: u200 untrusted feed; u201 not owner (set-max-age-blocks);
;; feed errors (e.g. u104 no data) pass through.
(define-public (check (feed <risk-feed>))
    (begin
        (asserts! (is-eq (contract-of feed) TRUSTED_FEED) ERR_UNTRUSTED_FEED)
        (let (
                (summary (try! (contract-call? feed get-coverage-summary)))
                (age (if (> burn-block-height (get updated-at summary))
                    (- burn-block-height (get updated-at summary))
                    u0
                ))
                (stale (> age (var-get max-age-blocks)))
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
