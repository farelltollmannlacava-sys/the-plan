const { test, expect } = require("bun:test");
const { metricSeries } = require("../assets/body-calc.js");

const ROWS = [
  { date: "2026-06-20", weight: "82.5", sleep_hours: "7.5", mood: 4 },
  { date: "2026-06-18", weight: null, sleep_hours: "6", mood: null },
  { date: "2026-06-19", weight: "82.0", sleep_hours: "", mood: 3 },
];

test("metricSeries: String-numeric -> Number, sortiert nach Datum", () => {
  expect(metricSeries(ROWS, "weight")).toEqual([
    { date: "2026-06-19", value: 82 },
    { date: "2026-06-20", value: 82.5 },
  ]);
});

test("metricSeries: leere Strings/null werden übersprungen", () => {
  expect(metricSeries(ROWS, "sleep_hours")).toEqual([
    { date: "2026-06-18", value: 6 },
    { date: "2026-06-20", value: 7.5 },
  ]);
});

test("metricSeries: ganzzahlige Skala (mood)", () => {
  expect(metricSeries(ROWS, "mood")).toEqual([
    { date: "2026-06-19", value: 3 },
    { date: "2026-06-20", value: 4 },
  ]);
});

test("metricSeries: leere Eingabe -> []", () => {
  expect(metricSeries([], "weight")).toEqual([]);
});
