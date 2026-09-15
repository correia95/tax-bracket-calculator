# Tax Bracket Calculator

See how progressive tax brackets actually work: marginal vs. effective rate,
with fully editable brackets.

- Add/edit/remove brackets freely; the top (uncapped) bracket is always
  protected from removal, so there's always somewhere for income above the
  highest threshold to go
- Two labeled illustrative presets (2024 US Single / Married Filing Jointly)
  to start from — not asserted as the current year's official numbers,
  since brackets are inflation-adjusted annually
- Per-bracket tax breakdown chart
- 10 currencies, shareable link (`?i=&b=&c=`); nothing is uploaded, works
  offline
- Not tax advice — a tool for understanding how marginal brackets work

## Develop

```
npm install
npm run dev
npm run build      # tsc --noEmit && vite build
node --experimental-strip-types --test src/taxbrackets.test.mjs
```

The engine (`calculateTax`) is in `src/taxbrackets.ts`, deliberately generic
over whatever bracket table is supplied — real tax brackets change every
year and by jurisdiction. 13 Node tests in `src/taxbrackets.test.mjs`.

## Deploy

Static assets on Cloudflare Workers (`wrangler.jsonc`). Live at
<https://tax-bracket-calculator.correia95.workers.dev/>.
