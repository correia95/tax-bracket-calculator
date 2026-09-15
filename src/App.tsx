import { useEffect, useMemo, useState } from 'react';
import {
  EXAMPLE_BRACKETS_MFJ_2024,
  EXAMPLE_BRACKETS_SINGLE_2024,
  calculateTax,
  decodeState,
  encodeState,
  type Bracket,
  type State,
} from './taxbrackets';
import { CURRENCIES, currencySymbol, guessCurrency, money } from './intl';

function defaultState(): State {
  return {
    taxableIncome: 75000,
    brackets: EXAMPLE_BRACKETS_SINGLE_2024,
    currency: guessCurrency(),
  };
}

function readState(): State {
  try {
    return decodeState(new URLSearchParams(window.location.search), defaultState());
  } catch {
    return defaultState();
  }
}

export default function App() {
  const [state, setState] = useState<State>(readState);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const params = encodeState(state);
      const url = new URL(window.location.href);
      url.search = params.toString();
      window.history.replaceState(null, '', url.toString());
    } catch {
      /* ignore */
    }
  }, [state]);

  const result = useMemo(() => calculateTax(state.taxableIncome, state.brackets), [state.taxableIncome, state.brackets]);

  const sortedBrackets = useMemo(
    () => [...state.brackets].sort((a, b) => (a.upTo === null ? 1 : b.upTo === null ? -1 : a.upTo - b.upTo)),
    [state.brackets],
  );

  const updateBracket = (index: number, patch: Partial<Bracket>) => {
    setState((s) => ({
      ...s,
      brackets: sortedBrackets.map((b, i) => (i === index ? { ...b, ...patch } : b)),
    }));
  };

  // Invariant maintained throughout: the bracket list always has exactly one uncapped (upTo: null)
  // top bracket, sorted last. Without this, removing it would silently leave income above the
  // highest remaining finite threshold untaxed, with no way to add a new uncapped bracket back
  // (a real edge case caught while designing the add/remove logic, not just a hypothetical).
  const topBracket = sortedBrackets[sortedBrackets.length - 1];
  const finiteBrackets = sortedBrackets.slice(0, -1);

  const addBracket = () => {
    const lastFinite = finiteBrackets[finiteBrackets.length - 1];
    const newUpTo = lastFinite ? Math.round(lastFinite.upTo! * 1.5) : 100000;
    const newBracket: Bracket = { ratePct: (lastFinite?.ratePct ?? topBracket?.ratePct ?? 10) + 5, upTo: newUpTo };
    setState((s) => ({ ...s, brackets: [...finiteBrackets, newBracket, topBracket] }));
  };

  const removeBracket = (index: number) => {
    // Only finite brackets (indices before the last one) can ever be removed; the top uncapped
    // bracket is never eligible, and at least one finite bracket must remain below it.
    if (index >= finiteBrackets.length || finiteBrackets.length <= 1) return;
    setState((s) => ({ ...s, brackets: [...finiteBrackets.filter((_, i) => i !== index), topBracket] }));
  };

  const loadPreset = (brackets: Bracket[]) => setState((s) => ({ ...s, brackets }));

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const maxTax = Math.max(1, ...result.breakdown.map((b) => b.taxForBracket));

  return (
    <div className="app">
      <header>
        <h1>Tax Bracket Calculator</h1>
        <p className="tag">
          See how progressive tax brackets actually work: your marginal rate only applies to the
          slice of income within that bracket, not your whole income. Every bracket here is
          editable. Not tax advice — see the note below.
        </p>
      </header>

      <label className="f currency-picker">
        <span>Currency</span>
        <select value={state.currency} onChange={(e) => setState((s) => ({ ...s, currency: e.target.value }))}>
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c} ({currencySymbol(c)})
            </option>
          ))}
        </select>
      </label>

      <label className="f">
        <span>Taxable income</span>
        <input
          type="number"
          min={0}
          value={state.taxableIncome}
          onChange={(e) => setState((s) => ({ ...s, taxableIncome: Math.max(0, Number(e.target.value) || 0) }))}
        />
      </label>

      <div className="presets">
        <button onClick={() => loadPreset(EXAMPLE_BRACKETS_SINGLE_2024)}>Example: 2024 US Single</button>
        <button onClick={() => loadPreset(EXAMPLE_BRACKETS_MFJ_2024)}>Example: 2024 US Married Filing Jointly</button>
      </div>

      <section className="group">
        <h2>Brackets</h2>
        <div className="bracket-table">
          {sortedBrackets.map((bracket, i) => (
            <div key={i} className="bracket-row">
              <div className="f">
                <span>Rate %</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={bracket.ratePct}
                  onChange={(e) => updateBracket(i, { ratePct: Number(e.target.value) || 0 })}
                />
              </div>
              <div className="f">
                <span>Up to</span>
                {bracket.upTo === null ? (
                  <input type="text" value="No limit" disabled />
                ) : (
                  <input
                    type="number"
                    min={0}
                    value={bracket.upTo}
                    onChange={(e) => updateBracket(i, { upTo: Number(e.target.value) || 0 })}
                  />
                )}
              </div>
              <button
                className="remove"
                onClick={() => removeBracket(i)}
                disabled={bracket.upTo === null || finiteBrackets.length <= 1}
                aria-label="Remove bracket"
                title={bracket.upTo === null ? 'The top bracket always covers everything above the highest threshold, and cannot be removed' : 'Remove bracket'}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <button className="ghost" onClick={addBracket}>
          + Add bracket
        </button>
      </section>

      <div className="result">
        <div className="rates">
          <div>
            <b>{result.marginalRatePct.toFixed(1)}%</b>
            <span>marginal rate</span>
          </div>
          <div>
            <b>{result.effectiveRatePct.toFixed(1)}%</b>
            <span>effective rate</span>
          </div>
        </div>
        <p className="total-tax">{money(result.totalTax, state.currency)} total tax</p>

        <div className="chart">
          {result.breakdown.map((b, i) => (
            <div key={i} className="chart-row">
              <span className="chart-label">
                {b.ratePct}% ({money(b.rangeStart, state.currency)}{b.rangeEnd === null ? '+' : ` – ${money(b.rangeEnd, state.currency)}`})
              </span>
              <div className="chart-track">
                <div className="chart-fill" style={{ width: `${Math.max(2, (b.taxForBracket / maxTax) * 100)}%` }} />
              </div>
              <span className="chart-value">{money(b.taxForBracket, state.currency)}</span>
            </div>
          ))}
        </div>

        <button className="share" onClick={share}>{copied ? 'Link copied' : 'Copy shareable link'}</button>
      </div>

      <section className="explainer">
        <h2>Marginal vs. effective rate</h2>
        <p>
          Your marginal rate is the rate on your last dollar of income — the bracket your top
          dollar falls into. Your effective rate is your total tax divided by your total income —
          almost always lower than your marginal rate, because only the income within each bracket
          is taxed at that bracket's rate, not your entire income.
        </p>
        <h3>About the example brackets</h3>
        <p>
          The two presets are a labeled illustrative example (2024 US federal brackets for two
          filing statuses) to start from, not a guarantee of the current year's official numbers —
          tax brackets are adjusted for inflation every year. Every bracket here is editable, so you
          can enter the current figures from your tax authority, or a different country's brackets
          entirely. This tool starts from taxable income (after any deductions), matching how
          official bracket tables are themselves expressed.
        </p>
        <h3>Not tax advice</h3>
        <p>
          This is a calculator for understanding how progressive brackets work, not tax advice.
          Always verify current figures and consult a tax professional for your actual filing.
        </p>
        <h3>Is anything sent to a server?</h3>
        <p>No. Every calculation runs in your browser and is only stored in the page's own link.</p>
        <footer>Tax Bracket Calculator · no sign-up · works offline once loaded</footer>
      </section>
    </div>
  );
}
