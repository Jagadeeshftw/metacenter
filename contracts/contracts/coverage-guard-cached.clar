;; metacenter coverage-guard-cached (example consumer, mainnet)
;;
;; The same guard as coverage-guard, reading the mainnet feed: coverage-cache, which holds
;; pox5-reader's own answers, computed from pox-5 state in a transaction. Provenance stays
;; "onchain". Copy this contract, change the threshold, and a vault has its own circuit breaker.
;;
;; It holds no funds, owns nothing, and can move nothing: `check` is read-only in effect and
;; returns a verdict its caller acts on.

(use-trait risk-feed .risk-feed-trait.risk-feed-trait)

(define-constant ERR_UNTRUSTED_FEED (err u200))
(define-constant ERR_NOT_OWNER (err u201))

;; Pause below 2.0x coverage: the target discussed in the Bitcoin Staking SIP thread.
(define-constant MIN_COVERAGE_BPS u20000)

;; Pause when the feed's reading is older than this many Bitcoin blocks. pox-5 computes a
;; distribution every 1,050 blocks and the keeper refreshes coverage-cache at least every 1,100,
;; so 1,300 leaves about 200 blocks (roughly a day and a half) of slack before a feed that has
;; stopped being refreshed pauses the caller.
(define-data-var max-age-blocks uint u1300)

(define-constant OWNER tx-sender)
(define-constant TRUSTED_FEED .coverage-cache)

(define-read-only (get-max-age-blocks)
    (var-get max-age-blocks)
)

(define-read-only (get-min-coverage-bps)
    MIN_COVERAGE_BPS
)

(define-read-only (get-trusted-feed)
    TRUSTED_FEED
)

(define-public (set-max-age-blocks (blocks uint))
    (begin
        (asserts! (is-eq tx-sender OWNER) ERR_NOT_OWNER)
        (ok (var-set max-age-blocks blocks))
    )
)

;; Returns (ok {status, ...}) where status is:
;;   "ok"     coverage >= MIN_COVERAGE_BPS, or there are no bonds to cover (coverage n/a)
;;   "paused" coverage below MIN_COVERAGE_BPS, or the reading is stale
;; Errors: u200 untrusted feed; u201 not owner (set-max-age-blocks); feed errors pass through
;; (coverage-cache answers u200 until its first refresh).
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
                age-blocks: age,
                stale: stale,
                provenance: (get provenance summary),
            })
        )
    )
)
