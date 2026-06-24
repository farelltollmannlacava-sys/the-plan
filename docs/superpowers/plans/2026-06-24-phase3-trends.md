# Phase 3: Trends — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Einen „Trends"-Tab bauen, der Langzeit-Auswertungen aus den vorhandenen Abhak-Daten zeigt: Erfüllungs-Linie der letzten 90 Tage, Erfüllung pro Woche, KI-Stunden pro Woche und Streak-Statistik (aktuell + längste).

**Architecture:** Bestehendes statisches Vanilla-JS-Cockpit (GitHub Pages + Supabase). Reine Aggregationslogik in `trends-calc.js` (mit `bun test`), DOM/Supabase-Rendering in `trends.js`, Diagramme über das vorhandene `assets/charts.js` (svgLineChart/svgBarChart, aus Phase 1). Keine Körper-Kurven in dieser Runde (Körper-Daten existieren noch nicht).

**Tech Stack:** HTML, Vanilla JS (klassische Scripts), Supabase JS v2 (CDN), SVG via charts.js, `bun test`. Kein Build, kein Framework.

## Global Constraints

- Kein Build, kein npm/node — Tests mit `/opt/homebrew/bin/bun` (`bun test`). Keine `package.json`.
- Neue Frontend-Dateien sind klassische Scripts (kein `type="module"`); `trends-calc.js` endet mit `if (typeof module !== "undefined" && module.exports) { module.exports = { ... }; }` für bun-Tests (im Browser übersprungen).
- Datumsformat `YYYY-MM-DD`, lokale Browser-Zeit (vorhandener `iso()`-Helfer in `app.js`).
- Wiederverwenden statt duplizieren: `svgLineChart`/`svgBarChart` aus `assets/charts.js`; `iso`, `typeForDate`, `pctForDate` sind globale Funktionen aus `assets/app.js`; Block-/Stunden-Daten aus `window.PLAN_DATA` (`assets/plan-data.js`).
- KI-Stunden eines Tages = Summe `h` der erledigten, trackbaren Blöcke mit `cat === "ki"`.
- Erfüllungs-Schwelle für Streaks: **0.8** (≥ 80 % der trackbaren Blöcke erledigt) — konsistent mit der bestehenden `computeStreak`-Logik.
- Tab-Reihenfolge: `Heute · Kalender · Woche · Finanzen · Trends · Verbote · Sonntag` (Trends direkt nach Finanzen).

---

### Task 1: Reine Aggregationslogik `trends-calc.js` (TDD)

**Files:**
- Create: `assets/trends-calc.js`
- Test: `tests/trends-calc.test.js`

**Interfaces:**
- `Day` = `{date: 'YYYY-MM-DD', pct: number /* 0..1 */, kiHours: number}`
- Produces (alle pur):
  - `weekKey(dateStr: string): string` — Montag (ISO-Wochenstart) der Woche als `YYYY-MM-DD`.
  - `dailyCompletion(days: Day[]): {date: string, pct: number}[]` — `pct` als ganzzahlige Prozent (0..100).
  - `weeklyCompletion(days: Day[]): {week: string, pct: number}[]` — Durchschnitts-Erfüllung je Woche in Prozent (gerundet), nach Woche sortiert.
  - `weeklyKiHours(days: Day[]): {week: string, hours: number}[]` — Summe KI-Stunden je Woche (auf 1 Nachkommastelle), sortiert.
  - `currentStreak(days: Day[], threshold?: number): number` — Länge der aktuellen Streak am Ende; ist der letzte Tag < Schwelle (heute evtl. unfertig), wird er übersprungen. Default `threshold = 0.8`.
  - `longestStreak(days: Day[], threshold?: number): number` — längste zusammenhängende Strähne mit `pct >= threshold` (days gelten als kalendarisch lückenlos).

- [ ] **Step 1: Failing test schreiben**

Create `tests/trends-calc.test.js`:

```js
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
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `cd /Users/farell.ceo/the-plan && /opt/homebrew/bin/bun test tests/trends-calc.test.js`
Expected: FAIL — `Cannot find module '../assets/trends-calc.js'`.

- [ ] **Step 3: Implementierung schreiben**

Create `assets/trends-calc.js`:

```js
/* The Plan — Trends-Aggregationslogik (pur, ohne DOM/Supabase) */
function weekKey(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const wd = (dt.getUTCDay() + 6) % 7; // Mo=0
  dt.setUTCDate(dt.getUTCDate() - wd);
  return dt.toISOString().slice(0, 10);
}

function dailyCompletion(days) {
  return days.map((d) => ({ date: d.date, pct: Math.round(d.pct * 100) }));
}

function weeklyCompletion(days) {
  const w = {};
  days.forEach((d) => { (w[weekKey(d.date)] = w[weekKey(d.date)] || []).push(d.pct); });
  return Object.keys(w).sort().map((k) => ({
    week: k,
    pct: Math.round((w[k].reduce((a, b) => a + b, 0) / w[k].length) * 100),
  }));
}

function weeklyKiHours(days) {
  const w = {};
  days.forEach((d) => { w[weekKey(d.date)] = (w[weekKey(d.date)] || 0) + (d.kiHours || 0); });
  return Object.keys(w).sort().map((k) => ({ week: k, hours: Math.round(w[k] * 10) / 10 }));
}

function currentStreak(days, threshold = 0.8) {
  let arr = days.slice();
  if (arr.length && arr[arr.length - 1].pct < threshold) arr = arr.slice(0, -1);
  let s = 0;
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i].pct >= threshold) s++;
    else break;
  }
  return s;
}

function longestStreak(days, threshold = 0.8) {
  let best = 0, run = 0;
  days.forEach((d) => {
    if (d.pct >= threshold) { run++; best = Math.max(best, run); }
    else run = 0;
  });
  return best;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { weekKey, dailyCompletion, weeklyCompletion, weeklyKiHours, currentStreak, longestStreak };
}
```

- [ ] **Step 4: Test laufen lassen, Erfolg bestätigen**

Run: `cd /Users/farell.ceo/the-plan && /opt/homebrew/bin/bun test tests/trends-calc.test.js`
Expected: PASS — 8 pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add assets/trends-calc.js tests/trends-calc.test.js
git commit -m "feat(trends): reine Aggregationslogik trends-calc + Tests"
```

---

### Task 2: Trends-Tab verdrahten (leere Ansicht)

**Files:**
- Modify: `index.html` (Tab-Button + View-Section + Script-Includes)
- Modify: `assets/app.js` (Tab-Router-Eintrag)

**Interfaces:**
- Produces: klickbarer Tab „Trends" (nach „Finanzen"), zeigt die Section `#view-trends` und ruft `renderTrends()` auf. `renderTrends` wird in Task 3 definiert; hier ein temporärer Stub.

- [ ] **Step 1: Tab-Button einfügen**

In `index.html`, in der `<nav class="tabs">`, nach der Zeile `<button data-view="finance">Finanzen</button>` einfügen:

```html
      <button data-view="trends">Trends</button>
```

- [ ] **Step 2: View-Section einfügen**

In `index.html`, nach dem schließenden `</section>` von `#view-finance` (vor `<section id="view-verbote" ...>`) einfügen:

```html
    <section id="view-trends" class="view">
      <div id="trends-stats"></div>
      <h2 class="sec">Erfüllung · letzte 90 Tage</h2>
      <div id="trends-completion"></div>
      <h2 class="sec">Erfüllung pro Woche</h2>
      <div id="trends-weekly"></div>
      <h2 class="sec">KI-Stunden pro Woche</h2>
      <div id="trends-ki"></div>
    </section>
```

- [ ] **Step 3: Script-Include einfügen**

In `index.html`, vor `<script src="assets/app.js"></script>`, einfügen (charts.js ist bereits eingebunden):

```html
  <script src="assets/trends-calc.js"></script>
  <script src="assets/trends.js"></script>
```

- [ ] **Step 4: Temporären Stub anlegen**

Create `assets/trends.js`:

```js
/* The Plan — Trends (Stub, wird in Task 3 ersetzt) */
async function renderTrends() {
  document.getElementById("trends-stats").textContent = "Trends folgt …";
}
```

- [ ] **Step 5: Router-Eintrag in app.js ergänzen**

In `assets/app.js`, in `initTabs`, die Router-Zeile erweitern. Ersetze:

```js
      ({ today: renderToday, calendar: renderCalendar, week: renderWeek, finance: renderFinance, verbote: renderVerbote, reflexion: renderReflexion }[b.dataset.view])();
```

durch:

```js
      ({ today: renderToday, calendar: renderCalendar, week: renderWeek, finance: renderFinance, trends: renderTrends, verbote: renderVerbote, reflexion: renderReflexion }[b.dataset.view])();
```

- [ ] **Step 6: Statisch verifizieren**

Run: `cd /Users/farell.ceo/the-plan && /opt/homebrew/bin/bun build assets/trends.js --target=browser > /dev/null && echo "parse ok"`
Expected: `parse ok`.
Run: `grep -n 'data-view="trends"' index.html` → Button vorhanden.
Run: `grep -n 'id="view-trends"' index.html` → Section vorhanden.
Run: `grep -n -E 'trends-calc\.js|trends\.js|app\.js' index.html` → trends-calc.js + trends.js vor app.js.
Run: `grep -n 'trends: renderTrends' assets/app.js` → Router verdrahtet.

- [ ] **Step 7: Commit**

```bash
git add index.html assets/app.js assets/trends.js
git commit -m "feat(trends): Tab + leere Ansicht verdrahtet"
```

---

### Task 3: Trends — Daten laden + Diagramme + Streak-Statistik

**Files:**
- Modify: `assets/trends.js` (Stub vollständig ersetzen)
- Modify: `assets/styles.css` (Trends-Styles ergänzen)

**Interfaces:**
- Consumes: `weekKey`/`dailyCompletion`/`weeklyCompletion`/`weeklyKiHours`/`currentStreak`/`longestStreak` (trends-calc); `svgLineChart`/`svgBarChart` (charts); `sb`, `iso`, `typeForDate`, `pctForDate` (app.js); `window.PLAN_DATA` (plan-data).
- Produces: `renderTrends()` (global), füllt `#trends-stats`, `#trends-completion`, `#trends-weekly`, `#trends-ki`. Setzt `window.renderTrends = renderTrends;`.

- [ ] **Step 1: trends.js vollständig schreiben**

Ersetze den **gesamten** Inhalt von `assets/trends.js`:

```js
/* The Plan — Trends */
function kiHoursForDate(d, checks) {
  return typeForDate(d).blocks
    .filter((b) => b.track && b.cat === "ki" && checks[b.id])
    .reduce((s, b) => s + (b.h || 0), 0);
}

async function renderTrends() {
  const end = new Date();
  const start = new Date(); start.setDate(end.getDate() - 89);
  const { data } = await sb.from("day_checks").select("date,block_id,done").gte("date", iso(start)).lte("date", iso(end));
  const byDate = {};
  (data || []).forEach((r) => { if (r.done) (byDate[r.date] = byDate[r.date] || {})[r.block_id] = true; });

  // 90 kalendarisch lückenlose Tage aufbauen (aufsteigend)
  const days = [];
  for (let i = 89; i >= 0; i--) {
    const d = new Date(end); d.setDate(end.getDate() - i);
    const ds = iso(d);
    const checks = byDate[ds] || {};
    days.push({ date: ds, pct: pctForDate(d, checks), kiHours: kiHoursForDate(d, checks) });
  }

  // Streak-Statistik
  document.getElementById("trends-stats").innerHTML =
    `<div class="tr-stats">` +
    `<div class="tr-stat"><div class="tr-num serif">${currentStreak(days)}</div><div class="tr-cap">Streak aktuell</div></div>` +
    `<div class="tr-stat"><div class="tr-num serif">${longestStreak(days)}</div><div class="tr-cap">Längste Streak</div></div>` +
    `</div>`;

  // Erfüllung 90 Tage (Linie)
  const dc = dailyCompletion(days).map((p) => ({ label: p.date.slice(5), value: p.pct }));
  document.getElementById("trends-completion").innerHTML = `<div class="chart-card">${svgLineChart(dc)}</div>`;

  // Erfüllung pro Woche (Balken)
  const wc = weeklyCompletion(days).map((w) => ({ label: w.week.slice(5), value: w.pct }));
  document.getElementById("trends-weekly").innerHTML = `<div class="chart-card">${svgBarChart(wc, { color: "var(--green)" })}</div>`;

  // KI-Stunden pro Woche (Balken)
  const wk = weeklyKiHours(days).map((w) => ({ label: w.week.slice(5), value: w.hours }));
  document.getElementById("trends-ki").innerHTML = `<div class="chart-card">${svgBarChart(wk, { color: "var(--gold)" })}</div>`;
}
window.renderTrends = renderTrends;
```

- [ ] **Step 2: Trends-Styles ergänzen**

Hänge ans Ende von `assets/styles.css` an:

```css
/* ---- Trends ---- */
.tr-stats { display: flex; gap: 10px; margin-bottom: 6px; }
.tr-stat { flex: 1; background: var(--panel-2); border: 1px solid var(--line); border-radius: 10px; padding: 14px; text-align: center; }
.tr-num { font-size: 34px; line-height: 1.1; color: var(--gold); }
.tr-cap { color: var(--muted); letter-spacing: .15em; text-transform: uppercase; font-size: 10px; margin-top: 2px; }
```

- [ ] **Step 3: Regressionstest der gesamten Suite**

Run: `cd /Users/farell.ceo/the-plan && /opt/homebrew/bin/bun test`
Expected: PASS — alle Tests grün (finance-calc, charts, markdown, trends-calc).

Run: `cd /Users/farell.ceo/the-plan && /opt/homebrew/bin/bun build assets/trends.js --target=browser > /dev/null && echo "parse ok"`
Expected: `parse ok`.

- [ ] **Step 4: Commit**

```bash
git add assets/trends.js assets/styles.css
git commit -m "feat(trends): 90-Tage-Erfüllung, Wochen-Balken, KI-Stunden, Streak-Statistik"
```

**Hinweis für den Controller (manuelle Browser-Verifikation):** Es gibt echte `day_checks`-Daten. Nach diesem Task „Trends" im Browser öffnen → Streak-Zahlen plausibel, 90-Tage-Linie rendert, zwei Balken-Diagramme (Wochen-Erfüllung grün, KI-Stunden gold) erscheinen. Keine Konsolenfehler.

---

## Self-Review (vom Plan-Autor durchgeführt)

**Spec-Abdeckung (Spec-Abschnitt „3. Trends 📈", Scope „voller Satz aus Abhak-Daten"):**
- Erfüllungs-% letzte 90 Tage (Linie) → Task 1 (dailyCompletion) + Task 3 ✓
- Erfüllung pro Woche (Balken) → Task 1 (weeklyCompletion) + Task 3 ✓
- KI-Stunden pro Woche (Balken) → Task 1 (weeklyKiHours) + Task 3 ✓
- Streak-Statistik (aktuell + längste) → Task 1 (currentStreak/longestStreak) + Task 3 ✓
- Wiederverwendung charts.js statt Duplikat → Task 3 ✓
- Körper-Kurven bewusst ausgeklammert (Daten existieren noch nicht) → out of scope ✓

**Placeholder-Scan:** Keine TBD/TODO. Der Stub in Task 2 ist bewusst und wird in Task 3 ersetzt.

**Typ-Konsistenz:** `Day`-Form (`date/pct/kiHours`) identisch in trends-calc, Tests, trends.js. Funktionsnamen `weekKey/dailyCompletion/weeklyCompletion/weeklyKiHours/currentStreak/longestStreak`, `renderTrends`, `kiHoursForDate` konsistent. Container-IDs (`trends-stats/-completion/-weekly/-ki`) konsistent zwischen index.html und trends.js. `pct` durchgängig 0..1 in `Day`, erst in dailyCompletion/weeklyCompletion auf Prozent gerundet.

**Out of scope (spätere Phasen):** Körper (inkl. Gewicht/Schlaf-Kurven), Ziele.
```
