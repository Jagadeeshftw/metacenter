---
name: A number looks wrong
about: The most useful report there is. Tell us what you computed and where.
title: "Wrong number: "
labels: wrong-number
---

**Which figure, and where you saw it**
e.g. coverage on https://metacenter.0xo.in/dashboard, or `coverage` from `/api/metrics/current`.

**What the site showed**
Value, its provenance label, and the Bitcoin block height shown beside it.

**What you computed instead**
Your value and how you got it. Pasting the output of `npm run verify` is ideal:

```
npm run verify
```

**Anything else**
Time of day, whether the "Data as of block N · refreshing" marker was showing, anything unusual.
