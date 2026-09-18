;; metacenter pox5-reader
;;
;; Read-only risk figures for Stacks Bitcoin Staking, computed directly from
;; SP000000000000000000002Q6VF78.pox-5 state. Holds no funds and has no admin.
;; Every figure returned here carries provenance "onchain".
;;
;; Payout model reproduced from pox-5 `calculate-rewards` / `calculate-bond-rewards`:
;;   - once per distribution interval (half a reward cycle) the new sBTC pool is split
;;   - tranche 1: bonds, in descending stx-value-ratio (ties: lower bond index first),
;;     each paid min(target, remaining) where target = shares * rate / 10000 / 50
;;   - reserve: 15% of what remains after bonds
;;   - tranche 2: STX-only stakers get the other 85%
;;   - the reserve is never paid out by pox-5 (transfer-from-reserve is private and uncalled)
;;
;; This contract deliberately never calls pox-5 `get-rewards` / `get-new-rewards`:
;; they abort on uint underflow if the sBTC balance is ever below staked + reserve.

(impl-trait .risk-feed-trait.risk-feed-trait)

(define-constant PRECISION u1000000000000000000) ;; 1e18, as in pox-5
(define-constant RESERVE_RATIO u1500) ;; bps, as in pox-5
(define-constant BOND_GAP_CYCLES u2) ;; as in pox-5
(define-constant INTERVALS_PER_YEAR u50) ;; the `/ u50` in pox-5 target-yield

(define-constant ERR_SNAPSHOT_EXISTS (err u100))

;; Cumulative rewards-per-token, recorded by anyone once per distribution index.
;; Consecutive snapshots of the same `rewards-cycle` give per-interval figures.
(define-map snapshots
    uint ;; pox-5 distribution index at the time of the snapshot
    {
        burn-height: uint,
        last-compute-height: uint,
        ;; reward cycle the latest distribution was booked to (none before the first one)
        rewards-cycle: (optional uint),
        stx-rpt: uint,
        stx-shares: uint,
        reserve: uint,
        bonds: (list 6 {
            bond-index: uint,
            rpt: uint,
            shares: uint,
        }),
    }
)

;; ---------------------------------------------------------------------------
;; Cycle and bond helpers
;; ---------------------------------------------------------------------------

(define-read-only (get-current-cycle)
    (contract-call? 'SP000000000000000000002Q6VF78.pox-5 current-pox-reward-cycle)
)

;; Calculation heights whose distributions are booked to `cycle`:
;; the last block of each of the cycle's two distribution intervals.
(define-read-only (get-cycle-calc-heights (cycle uint))
    (let (
            (start (contract-call? 'SP000000000000000000002Q6VF78.pox-5
                reward-cycle-to-burn-height cycle
            ))
            (first-dist (contract-call? 'SP000000000000000000002Q6VF78.pox-5
                burn-height-to-distribution-index start
            ))
        )
        {
            mid: (- (contract-call? 'SP000000000000000000002Q6VF78.pox-5
                distribution-cycle-to-burn-height (+ first-dist u1)
            )
                u1
            ),
            end: (- (contract-call? 'SP000000000000000000002Q6VF78.pox-5
                distribution-cycle-to-burn-height (+ first-dist u2)
            )
                u1
            ),
        }
    )
)

;; How many of the cycle's two distributions pox-5 has computed so far.
;; Assumes no interval was skipped (calculate-rewards is permissionless and
;; has been called every interval since cycle 141; the indexer cross-checks
;; this against calculate-rewards events).
(define-read-only (get-intervals-computed (cycle uint))
    (let (
            (heights (get-cycle-calc-heights cycle))
            (last-calc (contract-call? 'SP000000000000000000002Q6VF78.pox-5
                get-last-reward-compute-height
            ))
        )
        (+ (if (>= last-calc (get mid heights)) u1 u0)
            (if (>= last-calc (get end heights)) u1 u0)
        )
    )
)

;; Target yield for one bond over one interval, exactly as pox-5 L2266.
(define-read-only (bond-target-per-interval
        (shares uint)
        (target-rate uint)
    )
    (/ (/ (* shares target-rate) u10000) INTERVALS_PER_YEAR)
)

;; One active bond, with everything needed to price its claim on the pool.
(define-private (bond-entry
        (bond-index uint)
        (cycle uint)
    )
    (match (contract-call? 'SP000000000000000000002Q6VF78.pox-5 get-protocol-bond bond-index)
        bond (let ((shares (contract-call? 'SP000000000000000000002Q6VF78.pox-5
                get-total-shares-staked-for-cycle cycle (some bond-index)
            )))
            (some {
                bond-index: bond-index,
                stx-value-ratio: (get stx-value-ratio bond),
                target-rate: (get target-rate bond),
                shares: shares,
                target-per-interval: (bond-target-per-interval shares (get target-rate bond)),
            })
        )
        none
    )
)

;; Collect bonds active at `height`, mirroring pox-5 assert-all-active-bonds-included.
(define-private (collect-active-bond
        (offset uint)
        (acc {
            latest: uint,
            height: uint,
            cycle: uint,
            out: (list 6 {
                bond-index: uint,
                stx-value-ratio: uint,
                target-rate: uint,
                shares: uint,
                target-per-interval: uint,
            }),
        })
    )
    (if (> offset (get latest acc))
        acc
        (let ((bond-index (- (get latest acc) offset)))
            (if (contract-call? 'SP000000000000000000002Q6VF78.pox-5
                    is-bond-active-at-height bond-index (get height acc)
                )
                (match (bond-entry bond-index (get cycle acc))
                    entry (merge acc { out: (unwrap-panic (as-max-len? (append (get out acc) entry) u6)) })
                    acc
                )
                acc
            )
        )
    )
)

;; Insert one bond into a list kept in pox-5 payout order.
(define-private (pays-before
        (a {
            bond-index: uint,
            stx-value-ratio: uint,
            target-rate: uint,
            shares: uint,
            target-per-interval: uint,
        })
        (b {
            bond-index: uint,
            stx-value-ratio: uint,
            target-rate: uint,
            shares: uint,
            target-per-interval: uint,
        })
    )
    (or
        (> (get stx-value-ratio a) (get stx-value-ratio b))
        (and
            (is-eq (get stx-value-ratio a) (get stx-value-ratio b))
            (< (get bond-index a) (get bond-index b))
        )
    )
)

(define-private (insert-step
        (x {
            bond-index: uint,
            stx-value-ratio: uint,
            target-rate: uint,
            shares: uint,
            target-per-interval: uint,
        })
        (acc {
            item: {
                bond-index: uint,
                stx-value-ratio: uint,
                target-rate: uint,
                shares: uint,
                target-per-interval: uint,
            },
            placed: bool,
            out: (list 6 {
                bond-index: uint,
                stx-value-ratio: uint,
                target-rate: uint,
                shares: uint,
                target-per-interval: uint,
            }),
        })
    )
    (if (and (not (get placed acc)) (pays-before (get item acc) x))
        (merge acc {
            placed: true,
            out: (unwrap-panic (as-max-len?
                (append (unwrap-panic (as-max-len? (append (get out acc) (get item acc)) u6)) x)
                u6
            )),
        })
        (merge acc { out: (unwrap-panic (as-max-len? (append (get out acc) x) u6)) })
    )
)

(define-private (insert-sorted
        (item {
            bond-index: uint,
            stx-value-ratio: uint,
            target-rate: uint,
            shares: uint,
            target-per-interval: uint,
        })
        (sorted (list 6 {
            bond-index: uint,
            stx-value-ratio: uint,
            target-rate: uint,
            shares: uint,
            target-per-interval: uint,
        }))
    )
    (let ((res (fold insert-step sorted {
            item: item,
            placed: false,
            out: (list),
        })))
        (if (get placed res)
            (get out res)
            (unwrap-panic (as-max-len? (append (get out res) item) u6))
        )
    )
)

;; Bonds active in `cycle`, in the order pox-5 pays them:
;; descending stx-value-ratio, ties to the lower bond index.
(define-read-only (get-bond-payout-order (cycle uint))
    (let (
            (height (get mid (get-cycle-calc-heights cycle)))
            (first-bond-cycle (contract-call? 'SP000000000000000000002Q6VF78.pox-5
                bond-period-to-reward-cycle u0
            ))
            (latest (if (<= cycle first-bond-cycle)
                u0
                (/ (- cycle first-bond-cycle) BOND_GAP_CYCLES)
            ))
            (active (get out (fold collect-active-bond (list u0 u1 u2 u3 u4 u5) {
                latest: latest,
                height: height,
                cycle: cycle,
                out: (list),
            })))
        )
        (fold insert-sorted active (list))
    )
)

(define-private (sum-target
        (b { bond-index: uint, stx-value-ratio: uint, target-rate: uint, shares: uint, target-per-interval: uint })
        (acc uint)
    )
    (+ acc (get target-per-interval b))
)

;; Tranche-1 obligation for one distribution interval of `cycle`, in sats:
;; sum over active bonds of shares * rate / 10000 / 50.
(define-read-only (get-obligation-per-interval (cycle uint))
    (fold sum-target (get-bond-payout-order cycle) u0)
)

;; ---------------------------------------------------------------------------
;; Reserve
;; ---------------------------------------------------------------------------

(define-read-only (get-reserve)
    (contract-call? 'SP000000000000000000002Q6VF78.pox-5 get-reserve-balance)
)

;; Hypothetical cover: how many cycles of bond obligation the reserve equals.
;; pox-5 cannot pay bonds from the reserve (requires a SIP), so this is a
;; size comparison, not a payout schedule. cover-x100 is none when there are no bonds.
(define-read-only (get-reserve-cover-cycles (cycle uint))
    (let (
            (reserve (get-reserve))
            (per-cycle (* u2 (get-obligation-per-interval cycle)))
        )
        {
            reserve-sats: reserve,
            obligation-per-cycle-sats: per-cycle,
            cover-cycles-x100: (if (is-eq per-cycle u0)
                none
                (some (/ (* reserve u100) per-cycle))
            ),
            reserve-can-pay-bonds: false,
        }
    )
)

;; ---------------------------------------------------------------------------
;; Coverage from cumulative rewards-per-token
;; ---------------------------------------------------------------------------

(define-private (bond-paid-step
        (b { bond-index: uint, stx-value-ratio: uint, target-rate: uint, shares: uint, target-per-interval: uint })
        (acc { cycle: uint, intervals: uint, paid: uint, obligation: uint, bonds: uint })
    )
    (let ((rpt (contract-call? 'SP000000000000000000002Q6VF78.pox-5
            get-rewards-per-token-for-cycle (get cycle acc) (some (get bond-index b))
        )))
        (merge acc {
            paid: (+ (get paid acc) (/ (* rpt (get shares b)) PRECISION)),
            obligation: (+ (get obligation acc) (* (get intervals acc) (get target-per-interval b))),
            bonds: (+ (get bonds acc) u1),
        })
    )
)

;; Realised coverage for `cycle` over the distributions computed so far.
;;   bond-paid-sats  = sum_i rpt(cycle, i) * shares(cycle, i) / 1e18
;;   stx-paid-sats   = rpt(cycle, none) * shares(cycle, none) / 1e18
;;   remainder-sats  = stx-paid / 0.85   (the pre-reserve remainder)
;;   pool-sats       = bond-paid + remainder
;;   obligation-sats = intervals-computed * sum_i target-per-interval(i)
;; Integer truncation makes pool-sats accurate to within +-2 sats per computed
;; interval, and each bond's reconstructed payout can read up to 1 sat under what
;; pox-5 paid, so shortfall-sats ignores gaps of up to 1 sat per bond. When the cycle has no STX-only shares, the 85% goes to the reserve
;; and is invisible here: stx-visible is false and pool-sats is a lower bound.
(define-read-only (get-coverage-for-cycle (cycle uint))
    (let (
            (intervals (get-intervals-computed cycle))
            (bonds (fold bond-paid-step (get-bond-payout-order cycle) {
                cycle: cycle,
                intervals: intervals,
                paid: u0,
                obligation: u0,
                bonds: u0,
            }))
            (stx-shares (contract-call? 'SP000000000000000000002Q6VF78.pox-5
                get-total-shares-staked-for-cycle cycle none
            ))
            (stx-rpt (contract-call? 'SP000000000000000000002Q6VF78.pox-5
                get-rewards-per-token-for-cycle cycle none
            ))
            (stx-paid (/ (* stx-rpt stx-shares) PRECISION))
            (remainder (/ (* stx-paid u10000) (- u10000 RESERVE_RATIO)))
            (pool (+ (get paid bonds) remainder))
            (obligation (get obligation bonds))
        )
        {
            cycle: cycle,
            intervals-computed: intervals,
            pool-sats: pool,
            bond-paid-sats: (get paid bonds),
            stx-paid-sats: stx-paid,
            obligation-sats: obligation,
            shortfall-sats: (if (> obligation (+ (get paid bonds) (get bonds bonds)))
                (- obligation (get paid bonds))
                u0
            ),
            coverage-bps: (if (is-eq obligation u0) none (some (/ (* pool u10000) obligation))),
            headroom-bps: (if (or (is-eq obligation u0) (is-eq pool u0))
                none
                (some (if (>= pool obligation)
                    (/ (* (- pool obligation) u10000) pool)
                    u0
                ))
            ),
            stx-visible: (> stx-shares u0),
        }
    )
)

;; ---------------------------------------------------------------------------
;; Pending pool (safe re-implementation of pox-5 get-new-rewards)
;; ---------------------------------------------------------------------------

;; sBTC that has reached pox-5 since the last distribution, not yet split.
;; Same formula as pox-5 get-new-rewards, but returns u0 with balanced: false
;; instead of aborting if the balance is ever below the accounted amounts.
(define-read-only (get-pending-pool)
    (let (
            (balance (unwrap-panic (contract-call? 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token
                get-balance 'SP000000000000000000002Q6VF78.pox-5
            )))
            (accounted (+
                (contract-call? 'SP000000000000000000002Q6VF78.pox-5 get-total-sbtc-staked)
                (contract-call? 'SP000000000000000000002Q6VF78.pox-5 get-reserve-balance)
                (contract-call? 'SP000000000000000000002Q6VF78.pox-5 get-last-accounted-rewards-only)
            ))
        )
        {
            pending-sats: (if (>= balance accounted) (- balance accounted) u0),
            balanced: (>= balance accounted),
            last-compute-height: (contract-call? 'SP000000000000000000002Q6VF78.pox-5
                get-last-reward-compute-height
            ),
        }
    )
)

;; ---------------------------------------------------------------------------
;; Hypothetical waterfall (stress tests)
;; ---------------------------------------------------------------------------

(define-private (waterfall-step
        (b { bond-index: uint, stx-value-ratio: uint, target-rate: uint, shares: uint, target-per-interval: uint })
        (acc {
            remaining: uint,
            out: (list 6 { bond-index: uint, target-sats: uint, paid-sats: uint, status: (string-ascii 7) }),
        })
    )
    (let (
            (target (get target-per-interval b))
            (paid (if (>= (get remaining acc) target) target (get remaining acc)))
        )
        {
            remaining: (- (get remaining acc) paid),
            out: (unwrap-panic (as-max-len? (append (get out acc) {
                bond-index: (get bond-index b),
                target-sats: target,
                paid-sats: paid,
                status: (if (is-eq paid target) "full" (if (is-eq paid u0) "none" "partial")),
            }) u6)),
        }
    )
)

;; Split a hypothetical interval pool of `pool-sats` over the bonds active in
;; `cycle`, in pox-5 order. Provenance "hypothetical".
(define-read-only (simulate-waterfall
        (pool-sats uint)
        (cycle uint)
    )
    (let (
            (res (fold waterfall-step (get-bond-payout-order cycle) {
                remaining: pool-sats,
                out: (list),
            }))
            (remaining (get remaining res))
            (reserve-cut (/ (* remaining RESERVE_RATIO) u10000))
        )
        {
            bonds: (get out res),
            reserve-deposit-sats: reserve-cut,
            stx-only-sats: (- remaining reserve-cut),
        }
    )
)

;; ---------------------------------------------------------------------------
;; Snapshots (permissionless, once per distribution index)
;; ---------------------------------------------------------------------------

(define-private (snapshot-bond
        (b { bond-index: uint, stx-value-ratio: uint, target-rate: uint, shares: uint, target-per-interval: uint })
        (acc { cycle: uint, out: (list 6 { bond-index: uint, rpt: uint, shares: uint }) })
    )
    (merge acc {
        out: (unwrap-panic (as-max-len? (append (get out acc) {
            bond-index: (get bond-index b),
            rpt: (contract-call? 'SP000000000000000000002Q6VF78.pox-5
                get-rewards-per-token-for-cycle (get cycle acc) (some (get bond-index b))
            ),
            shares: (get shares b),
        }) u6)),
    })
)

(define-read-only (get-snapshot (distribution-index uint))
    (map-get? snapshots distribution-index)
)

;; Record cumulative rewards-per-token for the cycle of the latest distribution.
;; Anyone may call it; it can only be recorded once per distribution index.
(define-public (snapshot)
    (let (
            (index (contract-call? 'SP000000000000000000002Q6VF78.pox-5 current-distribution-cycle))
            (last-calc (contract-call? 'SP000000000000000000002Q6VF78.pox-5
                get-last-reward-compute-height
            ))
            (first-burn (contract-call? 'SP000000000000000000002Q6VF78.pox-5
                reward-cycle-to-burn-height u0
            ))
            (rewards-cycle (if (and (> last-calc u0) (>= last-calc first-burn))
                (some (contract-call? 'SP000000000000000000002Q6VF78.pox-5
                    burn-height-to-reward-cycle last-calc
                ))
                none
            ))
            (cycle (default-to u0 rewards-cycle))
            (record {
                burn-height: burn-block-height,
                last-compute-height: last-calc,
                rewards-cycle: rewards-cycle,
                stx-rpt: (contract-call? 'SP000000000000000000002Q6VF78.pox-5
                    get-rewards-per-token-for-cycle cycle none
                ),
                stx-shares: (contract-call? 'SP000000000000000000002Q6VF78.pox-5
                    get-total-shares-staked-for-cycle cycle none
                ),
                reserve: (get-reserve),
                bonds: (if (is-some rewards-cycle)
                    (get out (fold snapshot-bond (get-bond-payout-order cycle) {
                        cycle: cycle,
                        out: (list),
                    }))
                    (list)
                ),
            })
        )
        (asserts! (map-insert snapshots index record) ERR_SNAPSHOT_EXISTS)
        (print (merge { topic: "metacenter-snapshot", distribution-index: index } record))
        (ok index)
    )
)

;; ---------------------------------------------------------------------------
;; risk-feed-trait
;; ---------------------------------------------------------------------------

;; Coverage for the current reward cycle, realised so far. If no distribution
;; has been booked to the current cycle yet, reports the previous cycle.
(define-read-only (get-coverage-summary)
    (let (
            (current (get-current-cycle))
            (cycle (if (and (> current u0) (is-eq (get-intervals-computed current) u0))
                (- current u1)
                current
            ))
            (c (get-coverage-for-cycle cycle))
        )
        (ok {
            period: cycle,
            period-kind: "cycle",
            pool-sats: (get pool-sats c),
            obligation-sats: (get obligation-sats c),
            coverage-bps: (get coverage-bps c),
            headroom-bps: (get headroom-bps c),
            updated-at: burn-block-height,
            provenance: "onchain",
        })
    )
)
