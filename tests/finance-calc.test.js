const { test, expect } = require("bun:test");
const {
  EXPENSE_CATEGORIES,
  FIXED_CATEGORIES,
  computeBalance,
  monthBudget,
  balanceSeries,
  monthlyExpenseTotals,
  monthlyIncomeTotals,
} = require("../assets/finance-calc.js");

const E = [
  { date: "2026-06-01", kind: "income", amount: 2000, category: "Einnahme" },
  { date: "2026-06-02", kind: "expense", amount: 800, category: "Miete" },
  { date: "2026-06-03", kind: "expense", amount: 50, category: "Konsum" },
  { date: "2026-06-04", kind: "expense", amount: 120, category: "Sonstiges" },
  { date: "2026-06-05", kind: "income", amount: 100, category: "Einnahme" },
];

const EJ = [
  ...E,
  { date: "2026-07-01", kind: "expense", amount: 40, category: "Konsum" },
];

test("computeBalance: Start + Einnahmen - Ausgaben", () => {
  expect(computeBalance(500, E)).toBe(500 + 2100 - 970);
});

test("computeBalance: leere Liste = Startstand", () => {
  expect(computeBalance(1234, [])).toBe(1234);
});

test("monthBudget: Konsum = nur Konsum-Kategorie", () => {
  expect(monthBudget(E, 2026, 6).konsum).toBe(50);
});

test("monthBudget: Gesamt = Konsum + Sonstiges, ohne Fixkosten", () => {
  expect(monthBudget(E, 2026, 6).gesamt).toBe(170);
});

test("monthBudget: anderer Monat zählt separat", () => {
  expect(monthBudget(EJ, 2026, 7).konsum).toBe(40);
});

test("categories: Konstanten korrekt", () => {
  expect(EXPENSE_CATEGORIES).toEqual(["Miete","Tanken","Investition","Konsum","Sonstiges"]);
  expect(FIXED_CATEGORIES).toEqual(["Miete","Tanken","Investition"]);
});

test("balanceSeries: kumulativer Endstand je Tag, sortiert", () => {
  const s = balanceSeries(0, E);
  expect(s[0]).toEqual({ date: "2026-06-01", balance: 2000 });
  expect(s[s.length - 1].balance).toBe(2100 - 970);
});

test("monthlyExpenseTotals: Summe je Monat", () => {
  const m = monthlyExpenseTotals(EJ);
  expect(m).toEqual([
    { month: "2026-06", total: 970 },
    { month: "2026-07", total: 40 },
  ]);
});

test("monthlyIncomeTotals: nur Einnahmen", () => {
  expect(monthlyIncomeTotals(E)).toEqual([{ month: "2026-06", total: 2100 }]);
});
