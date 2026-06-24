const { test, expect } = require("bun:test");
const {
  weekKey, dailyCompletion, weeklyCompletion, weeklyKiHours, currentStreak, longestStreak,
} = require("../assets/trends-calc.js");

// Zwei ISO-Wochen, kalendarisch lückenlos (Mo 15.06. – Mo 22.06.2026)
const DAYS = [
  { date: "2026-06-15", pct: 1.0, kiHours: 2 },
  { date: "2026-06-16", pct: 0.5, kiHours: 2.25 },
  { date: "2026-06-17", pct: 0.9, kiHours: 2.25 },
  { date: "2026-06-18", pct: 0.8, kiHours: 2 },
  { date: "2026-06-19", pct: 1.0, kiHours: 2 },
  { date: "2026-06-20", pct: 0.0, kiHours: 0 },
  { date: "2026-06-21", pct: 1.0, kiHours: 4 },
  { date: "2026-06-22", pct: 0.6, kiHours: 2.25 },
];

test("weekKey: Montag der Woche", () => {
  expect(weekKey("2026-06-15")).toBe("2026-06-15"); // Montag selbst
  expect(weekKey("2026-06-21")).toBe("2026-06-15"); // Sonntag -> Montag davor
  expect(weekKey("2026-06-22")).toBe("2026-06-22"); // nächster Montag
});

test("dailyCompletion: pct als ganze Prozent", () => {
  const dc = dailyCompletion(DAYS);
  expect(dc[0]).toEqual({ date: "2026-06-15", pct: 100 });
  expect(dc[1]).toEqual({ date: "2026-06-16", pct: 50 });
  expect(dc.length).toBe(8);
});

test("weeklyCompletion: Wochendurchschnitt in Prozent", () => {
  expect(weeklyCompletion(DAYS)).toEqual([
    { week: "2026-06-15", pct: 74 }, // (1+0.5+0.9+0.8+1+0+1)/7 = 0.742857 -> 74
    { week: "2026-06-22", pct: 60 },
  ]);
});

test("weeklyKiHours: Wochensumme KI-Stunden", () => {
  expect(weeklyKiHours(DAYS)).toEqual([
    { week: "2026-06-15", hours: 14.5 },
    { week: "2026-06-22", hours: 2.3 }, // 2.25 -> 2.3
  ]);
});

test("longestStreak: längste Strähne >= 0.8", () => {
  expect(longestStreak(DAYS)).toBe(3); // 17,18,19
});

test("currentStreak: letzter Tag (0.6) wird übersprungen", () => {
  expect(currentStreak(DAYS)).toBe(1); // 21 zählt, 20 bricht ab
});

test("currentStreak: zählt bis zum Ende, wenn letzter Tag erfüllt", () => {
  const d = [
    { date: "2026-06-19", pct: 1.0, kiHours: 0 },
    { date: "2026-06-20", pct: 0.9, kiHours: 0 },
    { date: "2026-06-21", pct: 1.0, kiHours: 0 },
  ];
  expect(currentStreak(d)).toBe(3);
});

test("leere Eingabe ist robust", () => {
  expect(weeklyCompletion([])).toEqual([]);
  expect(currentStreak([])).toBe(0);
  expect(longestStreak([])).toBe(0);
});
