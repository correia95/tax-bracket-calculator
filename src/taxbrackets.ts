// Progressive (marginal) tax bracket calculation. Pure, dependency-free, and deliberately generic
// — the bracket table itself is just data the caller supplies, not baked into the engine, since
// real tax brackets change every year and by jurisdiction/filing status.

export interface Bracket {
  ratePct: number; // marginal rate applied to income in this bracket, e.g. 22 for 22%
  upTo: number | null; // this bracket covers income up to and including this amount; null = no ceiling (the top bracket)
}

export interface BracketPortion {
  ratePct: number;
  rangeStart: number;
  rangeEnd: number | null;
  amountInBracket: number;
  taxForBracket: number;
}

export interface TaxResult {
  totalTax: number;
  marginalRatePct: number; // the rate applied to the last dollar of income
  effectiveRatePct: number; // totalTax / taxableIncome * 100, 0 if income is 0
  breakdown: BracketPortion[]; // only brackets that actually contain some of the income
}

function sortedBrackets(brackets: Bracket[]): Bracket[] {
  return [...brackets].sort((a, b) => {
    if (a.upTo === null) return 1;
    if (b.upTo === null) return -1;
    return a.upTo - b.upTo;
  });
}

// Each bracket taxes the slice of income in (previousUpTo, thisUpTo] — the previous bracket's
// ceiling is the last dollar taxed at the previous (lower) rate, and this bracket picks up from
// the next dollar. A null upTo (the top bracket) has no ceiling.
export function calculateTax(taxableIncome: number, brackets: Bracket[]): TaxResult {
  const income = Math.max(0, taxableIncome);
  const sorted = sortedBrackets(brackets);

  let totalTax = 0;
  let marginalRatePct = sorted.length > 0 ? sorted[0].ratePct : 0;
  const breakdown: BracketPortion[] = [];
  let previousUpTo = 0;

  for (const bracket of sorted) {
    if (income <= previousUpTo) break;

    const rangeEnd = bracket.upTo;
    const amountInBracket = rangeEnd === null ? income - previousUpTo : Math.min(income, rangeEnd) - previousUpTo;

    if (amountInBracket > 0) {
      const taxForBracket = (amountInBracket * bracket.ratePct) / 100;
      totalTax += taxForBracket;
      marginalRatePct = bracket.ratePct;
      breakdown.push({
        ratePct: bracket.ratePct,
        rangeStart: previousUpTo,
        rangeEnd,
        amountInBracket,
        taxForBracket,
      });
    }

    previousUpTo = rangeEnd ?? income;
  }

  const effectiveRatePct = income > 0 ? (totalTax / income) * 100 : 0;

  return { totalTax, marginalRatePct, effectiveRatePct, breakdown };
}

// Illustrative example bracket sets. Federal tax brackets change annually with inflation
// adjustments — these are a labeled reference point for the calculator to start from, not an
// assertion of the current year's official numbers. Every bracket is user-editable in the UI.
export const EXAMPLE_BRACKETS_SINGLE_2024: Bracket[] = [
  { ratePct: 10, upTo: 11600 },
  { ratePct: 12, upTo: 47150 },
  { ratePct: 22, upTo: 100525 },
  { ratePct: 24, upTo: 191950 },
  { ratePct: 32, upTo: 243725 },
  { ratePct: 35, upTo: 609350 },
  { ratePct: 37, upTo: null },
];

export const EXAMPLE_BRACKETS_MFJ_2024: Bracket[] = [
  { ratePct: 10, upTo: 23200 },
  { ratePct: 12, upTo: 94300 },
  { ratePct: 22, upTo: 201050 },
  { ratePct: 24, upTo: 383900 },
  { ratePct: 32, upTo: 487450 },
  { ratePct: 35, upTo: 731200 },
  { ratePct: 37, upTo: null },
];

// --- URL state -----------------------------------------------------------

export interface State {
  taxableIncome: number;
  brackets: Bracket[];
  currency: string;
}

function encodeBrackets(brackets: Bracket[]): string {
  return brackets.map((b) => `${b.ratePct}:${b.upTo ?? ''}`).join(',');
}

function decodeBrackets(s: string): Bracket[] | null {
  if (!s) return null;
  try {
    const brackets = s.split(',').map((part) => {
      const [rateStr, upToStr] = part.split(':');
      const ratePct = Number(rateStr);
      const upTo = upToStr === '' || upToStr === undefined ? null : Number(upToStr);
      if (!Number.isFinite(ratePct)) throw new Error('bad rate');
      if (upTo !== null && !Number.isFinite(upTo)) throw new Error('bad upTo');
      return { ratePct, upTo };
    });
    return brackets;
  } catch {
    return null;
  }
}

export function encodeState(s: State): URLSearchParams {
  const p = new URLSearchParams();
  p.set('i', String(s.taxableIncome));
  p.set('b', encodeBrackets(s.brackets));
  p.set('c', s.currency);
  return p;
}

export function decodeState(params: URLSearchParams, fallback: State): State {
  const incomeRaw = Number(params.get('i'));
  const taxableIncome = params.has('i') && Number.isFinite(incomeRaw) ? incomeRaw : fallback.taxableIncome;
  const brackets = decodeBrackets(params.get('b') ?? '') ?? fallback.brackets;
  const currency = params.get('c') ?? fallback.currency;
  return { taxableIncome, brackets, currency };
}
