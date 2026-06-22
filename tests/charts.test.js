const { test, expect } = require("bun:test");
const { svgBarChart, svgLineChart } = require("../assets/charts.js");

const data = [
  { label: "Jun", value: 100 },
  { label: "Jul", value: 250 },
];

test("svgBarChart: liefert svg-String", () => {
  const s = svgBarChart(data);
  expect(s.startsWith("<svg")).toBe(true);
  expect(s).toContain("</svg>");
});

test("svgBarChart: leere Daten -> leerer Hinweis-svg", () => {
  expect(svgBarChart([]).startsWith("<svg")).toBe(true);
});

test("svgLineChart: liefert svg-String mit polyline", () => {
  const s = svgLineChart(data);
  expect(s.startsWith("<svg")).toBe(true);
  expect(s).toContain("polyline");
});
