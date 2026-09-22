# Contributing

Thanks for looking. This is a risk feed, so the bar is less about style than about whether a
number can be checked.

## The rule that matters

**No number ships without a traceable source.** Every figure the site publishes carries a
provenance label and the Bitcoin block it was read at:

| Label | Meaning |
|---|---|
| `onchain` | computed by `pox5-reader` from `pox-5` state |
| `mirrored` | posted by the indexer from mainnet events, the Hiro API or a price source, including anything price-based |
| `hypothetical` | a stress test or what-if, always shown with its assumption |

If a figure cannot be produced honestly, leave it out and say why. "n/a" with a reason is better
than a number nobody can reproduce.

## Before you open a pull request

```sh
npm run verify                              # headline figures still match public data
cd indexer && npm test                      # 28 tests, including the /api/health byte contract
cd contracts && npx vitest run              # 36 simnet tests
cd contracts && npx vitest run --config vitest.fork.config.ts   # 11 mainnet-fork tests, pinned
cd web && npx tsc --noEmit && npx next build
```

`cd contracts && node scripts/verify-at-tip.mjs` additionally checks the deployed contracts
against live mainnet state at the current chain tip. It needs network access, not keys.

## Things worth knowing

- **Deployed contracts are immutable.** `contracts/contracts/*.clar` for anything already on
  mainnet must stay byte-identical to what is deployed; `verify-at-tip.mjs` checks this. A change
  means a new contract, not an edit.
- **`/api/health`'s exact bytes are a contract** with the uptime monitor, which matches the string
  `"status":"ok"`. `indexer/src/health.test.ts` fails if the field is renamed, moved or
  pretty-printed. See [docs/RUNBOOK.md](docs/RUNBOOK.md).
- **Secrets live outside the repository.** Deployer and keeper keys are in `~/.metacenter/`; the
  Telegram token and database URL are environment variables on the deployment. Nothing secret
  belongs in a commit, a log or an error message.
- **Wording about PoX-5 is held to the same standard as numbers.** Cite what a source actually
  says. The 2.0× coverage figure, for example, is discussed in the SIP thread; the SIP draft
  itself sets no coverage target, and the docs say so.

## Reporting a wrong number

That is the most useful issue you can file. Include the figure, where you saw it, what you
computed instead, and the block height you read at — the
[wrong number](.github/ISSUE_TEMPLATE/wrong-number.md) template asks for exactly that. The output
of `npm run verify` is ideal.

## Security

For anything exploitable, please do not open a public issue; use GitHub's private vulnerability
reporting on this repository. The contracts hold no funds and the keeper's key carries only fees,
but a wrong figure that a vault trusts is still a real risk.

## Licence

By contributing you agree that your contribution is licensed under the [MIT licence](LICENSE).
