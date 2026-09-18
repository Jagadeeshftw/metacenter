;; metacenter risk-feed
;;
;; Publisher-gated mirror of mainnet PoX-5 risk figures, one record per
;; distribution interval. Deployed on TESTNET: its values mirror MAINNET data
;; and carry provenance "mirrored".
;;
;; The publisher posts only raw inputs (taken from the mainnet pox-5
;; calculate-rewards / bond-distribution events and a price source). The
;; contract checks they add up and derives every metric itself, so anyone can
;; recompute each figure from the stored inputs.

(impl-trait .risk-feed-trait.risk-feed-trait)

(define-constant ERR_NOT_OWNER (err u100))
(define-constant ERR_NOT_PUBLISHER (err u101))
(define-constant ERR_ALREADY_POSTED (err u102))
(define-constant ERR_INCONSISTENT_INPUTS (err u103))
(define-constant ERR_NO_DATA (err u104))

(define-constant RESERVE_RATIO u1500) ;; bps, as in pox-5

(define-data-var owner principal tx-sender)
(define-data-var publisher principal tx-sender)
(define-data-var latest-index (optional uint) none)

(define-map snapshots
    uint ;; mainnet pox-5 distribution index: (calculation-height - 666050) / 1050
    {
        ;; raw inputs (mainnet)
        stx-cycle: uint, ;; reward cycle the distribution was booked to
        calculation-height: uint, ;; pox-5 calculation-height (burn height)
        source-txid: (buff 32), ;; mainnet calculate-rewards transaction
        gross-pool-sats: uint, ;; gross-accrued-rewards
        bond-target-sats: uint, ;; sum of target-yield over bond-distribution events
        bond-paid-sats: uint, ;; total-bond-rewards
        stx-only-sats: uint, ;; total-stx-staker-rewards
        reserve-deposit-sats: uint, ;; reserve-deposit
        reserve-balance-sats: uint, ;; reserve-balance after the distribution
        stx-shares-ustx: uint, ;; cycle-staked-ustx
        price-sats-per-stx-e6: uint, ;; STX/BTC price, sats per STX * 1e6
        price-source: (string-ascii 32),
        price-timestamp: uint, ;; unix seconds
        ;; derived here
        coverage-bps: (optional uint),
        headroom-bps: (optional uint),
        shortfall-sats: uint,
        reserve-cover-cycles-x100: (optional uint),
        stx-yield-sats-per-stx-e9: (optional uint), ;; sats per STX for this interval * 1e9
        cliff-sats-per-stx-e6: (optional uint), ;; price at which pool == obligation, assuming miner bids scale with price
        posted-at: uint, ;; testnet burn height
    }
)

;; ---------------------------------------------------------------------------
;; Admin
;; ---------------------------------------------------------------------------

(define-read-only (get-owner)
    (var-get owner)
)

(define-read-only (get-publisher)
    (var-get publisher)
)

(define-public (set-publisher (new-publisher principal))
    (begin
        (asserts! (is-eq tx-sender (var-get owner)) ERR_NOT_OWNER)
        (print {
            topic: "metacenter-publisher-rotated",
            old: (var-get publisher),
            new: new-publisher,
        })
        (ok (var-set publisher new-publisher))
    )
)

(define-public (set-owner (new-owner principal))
    (begin
        (asserts! (is-eq tx-sender (var-get owner)) ERR_NOT_OWNER)
        (print {
            topic: "metacenter-owner-transferred",
            old: (var-get owner),
            new: new-owner,
        })
        (ok (var-set owner new-owner))
    )
)

;; ---------------------------------------------------------------------------
;; Derivations (pure; exposed so anyone can recompute)
;; ---------------------------------------------------------------------------

(define-read-only (derive
        (gross uint)
        (target uint)
        (paid uint)
        (stx-only uint)
        (reserve-balance uint)
        (stx-shares uint)
        (price-e6 uint)
    )
    {
        coverage-bps: (if (is-eq target u0) none (some (/ (* gross u10000) target))),
        headroom-bps: (if (or (is-eq target u0) (is-eq gross u0))
            none
            (some (if (>= gross target) (/ (* (- gross target) u10000) gross) u0))
        ),
        shortfall-sats: (if (> target paid) (- target paid) u0),
        ;; two intervals per cycle
        reserve-cover-cycles-x100: (if (is-eq target u0)
            none
            (some (/ (* reserve-balance u100) (* u2 target)))
        ),
        ;; stx-shares is in uSTX: sats per STX = stx-only * 1e6 / shares
        stx-yield-sats-per-stx-e9: (if (is-eq stx-shares u0)
            none
            (some (/ (* stx-only u1000000000000000) stx-shares))
        ),
        cliff-sats-per-stx-e6: (if (or (is-eq target u0) (is-eq gross u0))
            none
            (some (/ (* price-e6 target) gross))
        ),
    }
)

;; ---------------------------------------------------------------------------
;; Publishing
;; ---------------------------------------------------------------------------

(define-public (post-snapshot
        (index uint)
        (inputs {
            stx-cycle: uint,
            calculation-height: uint,
            source-txid: (buff 32),
            gross-pool-sats: uint,
            bond-target-sats: uint,
            bond-paid-sats: uint,
            stx-only-sats: uint,
            reserve-deposit-sats: uint,
            reserve-balance-sats: uint,
            stx-shares-ustx: uint,
            price-sats-per-stx-e6: uint,
            price-source: (string-ascii 32),
            price-timestamp: uint,
        })
    )
    (let (
            (gross (get gross-pool-sats inputs))
            (target (get bond-target-sats inputs))
            (paid (get bond-paid-sats inputs))
            (remainder (if (>= gross paid) (- gross paid) u0))
            (derived (derive gross target paid (get stx-only-sats inputs)
                (get reserve-balance-sats inputs) (get stx-shares-ustx inputs)
                (get price-sats-per-stx-e6 inputs)
            ))
            (record (merge inputs (merge derived { posted-at: burn-block-height })))
        )
        (asserts! (is-eq tx-sender (var-get publisher)) ERR_NOT_PUBLISHER)
        ;; the waterfall must add up the way pox-5 splits it
        (asserts! (<= paid gross) ERR_INCONSISTENT_INPUTS)
        (asserts! (is-eq paid (if (< gross target) gross target)) ERR_INCONSISTENT_INPUTS)
        (asserts!
            (is-eq (get reserve-deposit-sats inputs)
                (if (is-eq (get stx-shares-ustx inputs) u0)
                    remainder
                    (/ (* remainder RESERVE_RATIO) u10000)
                ))
            ERR_INCONSISTENT_INPUTS
        )
        (asserts!
            (is-eq (+ paid (get stx-only-sats inputs) (get reserve-deposit-sats inputs))
                gross
            )
            ERR_INCONSISTENT_INPUTS
        )
        (asserts! (map-insert snapshots index record) ERR_ALREADY_POSTED)
        (var-set latest-index (some (match (var-get latest-index)
            latest (if (> index latest) index latest)
            index
        )))
        (print (merge {
            topic: "metacenter-snapshot",
            index: index,
        }
            record
        ))
        (ok index)
    )
)

;; ---------------------------------------------------------------------------
;; Getters
;; ---------------------------------------------------------------------------

(define-read-only (get-snapshot (index uint))
    (map-get? snapshots index)
)

(define-read-only (get-latest-index)
    (var-get latest-index)
)

(define-read-only (get-latest-snapshot)
    (match (var-get latest-index)
        index (map-get? snapshots index)
        none
    )
)

(define-read-only (get-coverage-summary)
    (let (
            (index (unwrap! (var-get latest-index) ERR_NO_DATA))
            (s (unwrap! (map-get? snapshots index) ERR_NO_DATA))
        )
        (ok {
            period: index,
            period-kind: "interval",
            pool-sats: (get gross-pool-sats s),
            obligation-sats: (get bond-target-sats s),
            coverage-bps: (get coverage-bps s),
            headroom-bps: (get headroom-bps s),
            updated-at: (get posted-at s),
            provenance: "mirrored",
        })
    )
)
