const { test, expect } = require("bun:test");
const { bestMonthIncome, goalPct } = require("../assets/goals-calc.js");

const ENTRIES = [
  { date: "2026-05-10", kind: "income", amount: "2000" },
  { date: "2026-05-20", kind: "income", amount: "1500" },
  { date: "2026-06-01", kind: "income", amount: "5200" },
  { date: "2026-06-02", kind: "expense", amount: "300" },
  { date: "2026-06-15", kind: "income", amount: "100" },
];

test("bestMonthIncome: bester Kalendermonat (Strings -> Zahl)", () => {
  // Mai = 3500, Juni = 5300 -> 5300
  expect(bestMonthIncome(ENTRIES)).toBe(5300);
});

test("bestMonthIncome: Ausgaben zählen nicht", () => {
  expect(bestMonthIncome([{ date: "2026-06-01", kind: "expense", amount: "9999" }])).toBe(0);
});

test("bestMonthIncome: leere Liste -> 0", () => {
  expect(bestMonthIncome([])).toBe(0);
});

test("goalPct: gedeckelt auf 100", () => {
  expect(goalPct(1200, 1000)).toBe(100);
  expect(goalPct(250, 1000)).toBe(25);
});

test("goalPct: robust bei 0/fehlendem Ziel", () => {
  expect(goalPct(5, 0)).toBe(0);
  expect(goalPct(0, 500)).toBe(0);
});
