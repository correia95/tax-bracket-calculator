import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateTax,
  encodeState,
  decodeState,
  EXAMPLE_BRACKETS_SINGLE_2024,
} from './taxbrackets.ts';

test('a single flat bracket taxes all income at that one rate', () => {
  const result = calculateTax(50000, [{ ratePct: 20, upTo: null }]);
  assert.equal(result.totalTax, 10000);
  assert.equal(result.marginalRatePct, 20);
  assert.equal(result.effectiveRatePct, 20);
});

test('a two-bracket schedule taxes each slice of income at its own rate', () => {
  // 10% on the first 10,000, 22% above that. Income of 15,000:
  // 10,000 * 0.10 = 1,000; 5,000 * 0.22 = 1,100; total = 2,100.
  const brackets = [
    { ratePct: 10, upTo: 10000 },
    { ratePct: 22, upTo: null },
  ];
  const result = calculateTax(15000, brackets);
  assert.equal(result.totalTax, 2100);
  assert.equal(result.marginalRatePct, 22);
  assert.ok(Math.abs(result.effectiveRatePct - 14) < 1e-9); // 2100/15000 = 14%
});

test('income landing exactly on a bracket boundary is taxed entirely within that bracket', () => {
  const brackets = [
    { ratePct: 10, upTo: 10000 },
    { ratePct: 22, upTo: null },
  ];
  const result = calculateTax(10000, brackets);
  assert.equal(result.totalTax, 1000); // entirely in the 10% bracket
  assert.equal(result.marginalRatePct, 10);
  assert.equal(result.breakdown.length, 1);
});

test('the dollar just above a boundary is taxed at the next bracket rate', () => {
  const brackets = [
    { ratePct: 10, upTo: 10000 },
    { ratePct: 22, upTo: null },
  ];
  const result = calculateTax(10001, brackets);
  // 10,000 * 0.10 + 1 * 0.22
  assert.ok(Math.abs(result.totalTax - (1000 + 0.22)) < 1e-9);
  assert.equal(result.marginalRatePct, 22);
});

test('zero taxable income results in zero tax and a 0% effective rate, no division by zero', () => {
  const result = calculateTax(0, EXAMPLE_BRACKETS_SINGLE_2024);
  assert.equal(result.totalTax, 0);
  assert.equal(result.effectiveRatePct, 0);
});

test('a negative income is treated as zero rather than producing a negative tax', () => {
  const result = calculateTax(-5000, EXAMPLE_BRACKETS_SINGLE_2024);
  assert.equal(result.totalTax, 0);
});

test('effective rate never exceeds the marginal rate for a progressive schedule', () => {
  for (const income of [5000, 30000, 75000, 150000, 500000, 2000000]) {
    const result = calculateTax(income, EXAMPLE_BRACKETS_SINGLE_2024);
    assert.ok(
      result.effectiveRatePct <= result.marginalRatePct + 1e-9,
      `at income ${income}: effective ${result.effectiveRatePct} exceeded marginal ${result.marginalRatePct}`,
    );
  }
});

test('the breakdown only includes brackets that actually contain some income, in ascending order', () => {
  const result = calculateTax(30000, EXAMPLE_BRACKETS_SINGLE_2024);
  // 30,000 only reaches into the 10% and 12% brackets of the 2024 single example table.
  assert.equal(result.breakdown.length, 2);
  assert.equal(result.breakdown[0].ratePct, 10);
  assert.equal(result.breakdown[1].ratePct, 12);
});

test('the top (uncapped) bracket taxes all income above the last finite threshold', () => {
  const brackets = [
    { ratePct: 10, upTo: 1000 },
    { ratePct: 37, upTo: null },
  ];
  const result = calculateTax(1_000_000, brackets);
  const topPortion = result.breakdown[result.breakdown.length - 1];
  assert.equal(topPortion.ratePct, 37);
  assert.equal(topPortion.rangeEnd, null);
  assert.ok(Math.abs(topPortion.amountInBracket - (1_000_000 - 1000)) < 1e-9);
});

test('bracket order in the input array does not matter — sorting is by threshold, not input order', () => {
  const brackets = [
    { ratePct: 22, upTo: null },
    { ratePct: 10, upTo: 10000 },
  ];
  const result = calculateTax(15000, brackets);
  assert.equal(result.totalTax, 2100); // same as the ordered-input test above
});

test('a full worked example against the illustrative 2024 single-filer brackets', () => {
  // Taxable income of 100,000: fills the 10/12/22% brackets and part of the 24%... actually
  // 100,000 is below the 100,525 threshold, so it only reaches into the 22% bracket.
  // 11,600*0.10 + (47,150-11,600)*0.12 + (100,000-47,150)*0.22
  const expected = 11600 * 0.1 + (47150 - 11600) * 0.12 + (100000 - 47150) * 0.22;
  const result = calculateTax(100000, EXAMPLE_BRACKETS_SINGLE_2024);
  assert.ok(Math.abs(result.totalTax - expected) < 1e-6);
  assert.equal(result.marginalRatePct, 22);
});

test('encodeState/decodeState round-trip a full state including custom brackets', () => {
  const state = {
    taxableIncome: 85000,
    brackets: [
      { ratePct: 10, upTo: 10000 },
      { ratePct: 20, upTo: 50000 },
      { ratePct: 30, upTo: null },
    ],
    currency: 'USD',
  };
  const decoded = decodeState(encodeState(state), state);
  assert.deepEqual(decoded, state);
});

test('decodeState falls back to defaults for a malformed brackets param', () => {
  const fallback = { taxableIncome: 50000, brackets: EXAMPLE_BRACKETS_SINGLE_2024, currency: 'USD' };
  const decoded = decodeState(new URLSearchParams('b=not-valid-brackets-data'), fallback);
  assert.deepEqual(decoded.brackets, fallback.brackets);
});
