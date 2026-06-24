# Phase 4: Körper — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eine Körper-Schnelleingabe unten auf dem „Heute"-Tab (Gewicht, Koffein, Schlaf+Qualität, Wasser, Stimmung, Hunger) mit Koffein-Limit-Balken, und Gewicht-/Schlaf-Kurven im Trends-Tab.

**Architecture:** Bestehendes statisches Vanilla-JS-Cockpit (GitHub Pages + Supabase). Neue Tabelle `body_metrics` (eine Zeile pro Tag, Upsert). Reine Datenlogik (`body-calc.js`, mit `bun test`) extrahiert Mess-Serien für Diagramme; DOM/Supabase in `body.js` (Eingabe + Koffein-Balken auf „Heute"). Der Trends-Tab wird um zwei Linien-Diagramme erweitert (Gewicht, Schlaf), über das vorhandene `charts.js`.

**Tech Stack:** HTML, Vanilla JS (klassische Scripts), Supabase JS v2 (CDN), SVG via charts.js, `bun test`. Kein Build, kein Framework.

## Global Constraints

- Kein Build, kein npm/node — Tests mit `/opt/homebrew/bin/bun` (`bun test`). Keine `package.json`.
- Neue Frontend-Dateien sind klassische Scripts (kein `type="module"`); `body-calc.js` endet mit `if (typeof module !== "undefined" && module.exports) { module.exports = { ... }; }` für bun-Tests (im Browser übersprungen).
- Supabase-Projekt ref `ykhuavvsfeairuwnymsr`. RLS-Policy für neue Tabelle: `auth.jwt() ->> 'email' = 'farelltollmannlacava@gmail.com'`.
- **Supabase liefert `numeric` als String** — Mess-Werte beim Lesen/Rechnen defensiv mit `Number()` wandeln (wie in Phase 1 gelernt).
- Skalen (Spec): `sleep_quality`, `mood`, `hunger` je **1–5**; `weight` (kg), `caffeine_mg` (mg), `sleep_hours` (h), `water_ml` (ml) numerisch frei.
- Koffein-Limit = **400 mg/Tag** (Verbot 1), Balken grün < 80 %, gold 80–99 %, rot ≥ 100 %.
- Datumsformat `YYYY-MM-DD`, lokale Browser-Zeit (`iso()` aus app.js). Eingabe-Datum default heute, Vortag nachtragbar.
- Wiederverwenden statt duplizieren: vorhandene CSS-Klassen `.fin-row`, `.bud-row`/`.bud-top`/`.bud-track`/`.bud-lbl`/`.bud-num`, `.btn`, `.saved-hint`, `.chart-card`; `svgLineChart` aus charts.js; `iso` aus app.js.

---

### Task 1: Supabase-Tabelle `body_metrics`

**Files:**
- Migration: über Supabase MCP `apply_migration`. Kein lokales Datei-Artefakt.

**Interfaces:**
- Produces: `body_metrics(date pk, weight, caffeine_mg, sleep_hours, sleep_quality, water_ml, mood, hunger, updated_at)` mit RLS auf Farells Mail.

- [ ] **Step 1: Migration anwenden**

Über MCP `apply_migration` (name: `body_metrics_table`):

```sql
create table if not exists body_metrics (
  date date primary key,
  weight numeric,
  caffeine_mg integer,
  sleep_hours numeric,
  sleep_quality smallint,
  water_ml integer,
  mood smallint,
  hunger smallint,
  updated_at timestamptz not null default now()
);
alter table body_metrics enable row level security;
create policy "owner_all" on body_metrics for all
  using (auth.jwt() ->> 'email' = 'farelltollmannlacava@gmail.com')
  with check (auth.jwt() ->> 'email' = 'farelltollmannlacava@gmail.com');
```

- [ ] **Step 2: Verifizieren**

MCP `list_tables` (schema `public`): `body_metrics` erscheint, `rls_enabled: true`.

- [ ] **Step 3: Commit**

Keine lokalen Dateien — kein Commit.

---

### Task 2: Reine Datenlogik `body-calc.js` (TDD)

**Files:**
- Create: `assets/body-calc.js`
- Test: `tests/body-calc.test.js`

**Interfaces:**
- Produces: `metricSeries(rows: object[], key: string): {date: string, value: number}[]` — filtert Zeilen ohne Wert (null/undefined/`""`) heraus, wandelt den Wert via `Number()` (Supabase numeric kommt als String), verwirft `NaN`, und sortiert aufsteigend nach `date`.

- [ ] **Step 1: Failing test schreiben**

Create `tests/body-calc.test.js`:

```js
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
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `cd /Users/farell.ceo/the-plan && /opt/homebrew/bin/bun test tests/body-calc.test.js`
Expected: FAIL — `Cannot find module '../assets/body-calc.js'`.

- [ ] **Step 3: Implementierung schreiben**

Create `assets/body-calc.js`:

```js
/* The Plan — Körper-Datenlogik (pur, ohne DOM/Supabase) */
function metricSeries(rows, key) {
  return rows
    .filter((r) => r[key] !== null && r[key] !== undefined && r[key] !== "")
    .map((r) => ({ date: r.date, value: Number(r[key]) }))
    .filter((p) => !isNaN(p.value))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { metricSeries };
}
```

- [ ] **Step 4: Test laufen lassen, Erfolg bestätigen**

Run: `cd /Users/farell.ceo/the-plan && /opt/homebrew/bin/bun test tests/body-calc.test.js`
Expected: PASS — 4 pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add assets/body-calc.js tests/body-calc.test.js
git commit -m "feat(koerper): reine Datenlogik body-calc (metricSeries) + Tests"
```

---

### Task 3: Körper-Eingabe + Koffein-Balken auf „Heute"

**Files:**
- Create: `assets/body.js`
- Modify: `index.html` (Körper-Container in `#view-today`, Script-Includes)
- Modify: `assets/app.js` (Aufruf `renderBody()` in `renderToday`)
- Modify: `assets/styles.css` (Körper-Styles)

**Interfaces:**
- Consumes: globaler Supabase-Client `sb`, `iso()` (app.js).
- Produces: `renderBody(dateStr?: string)` (global, via `window.renderBody = renderBody`), rendert die Eingabe + Koffein-Balken in `#body`, upsertet `body_metrics` auf `date`.
- Script-Reihenfolge: `body-calc.js` muss **vor** `trends.js` geladen werden (Task 4 nutzt `metricSeries`).

- [ ] **Step 1: body.js schreiben**

Create `assets/body.js`:

```js
/* The Plan — Körper-Schnelleingabe (unten auf „Heute") */
const CAF_LIMIT = 400;
function cafColor(mg) {
  const r = mg / CAF_LIMIT;
  if (r >= 1) return "var(--red)";
  if (r >= 0.8) return "var(--gold)";
  return "var(--green)";
}
function sel15(id, val) {
  let o = `<option value="">–</option>`;
  for (let i = 1; i <= 5; i++) o += `<option value="${i}"${String(val) === String(i) ? " selected" : ""}>${i}</option>`;
  return `<select id="${id}">${o}</select>`;
}
function renderCafBar(mg) {
  const el = document.getElementById("b-caf-bar");
  if (!el) return;
  const v = Number(mg) || 0;
  const pct = Math.min(v / CAF_LIMIT, 1) * 100;
  const over = v > CAF_LIMIT ? ` <span style="color:var(--red)">über Limit</span>` : "";
  el.innerHTML =
    `<div class="bud-row"><div class="bud-top"><span class="bud-lbl">Koffein heute (Verbot 1)</span>` +
    `<span class="bud-num">${v} / ${CAF_LIMIT} mg${over}</span></div>` +
    `<div class="bud-track"><i style="width:${pct.toFixed(0)}%;background:${cafColor(v)}"></i></div></div>`;
}

async function renderBody(dateStr) {
  const el = document.getElementById("body");
  if (!el) return;
  const ds = dateStr || iso(new Date());
  const { data } = await sb.from("body_metrics").select("*").eq("date", ds).maybeSingle();
  const r = data || {};
  const v = (x) => (x === null || x === undefined ? "" : x);
  el.innerHTML =
    `<div class="body-card">` +
    `<div class="fin-row"><label class="body-f">Gewicht (kg)<input id="b-weight" type="number" step="0.1" value="${v(r.weight)}"></label>` +
    `<label class="body-f">Koffein (mg)<input id="b-caf" type="number" step="10" value="${v(r.caffeine_mg)}"></label></div>` +
    `<div class="fin-row"><label class="body-f">Schlaf (h)<input id="b-sleep" type="number" step="0.5" value="${v(r.sleep_hours)}"></label>` +
    `<label class="body-f">Schlafqualität ${sel15("b-squal", r.sleep_quality)}</label></div>` +
    `<div class="fin-row"><label class="body-f">Wasser (ml)<input id="b-water" type="number" step="100" value="${v(r.water_ml)}"></label>` +
    `<label class="body-f">Stimmung ${sel15("b-mood", r.mood)}</label>` +
    `<label class="body-f">Hunger ${sel15("b-hunger", r.hunger)}</label></div>` +
    `<div class="fin-row"><label class="body-f">Datum<input id="b-date" type="date" value="${ds}"></label></div>` +
    `<button class="btn" id="b-save">Körper speichern</button><span class="saved-hint" id="b-hint"></span>` +
    `<div id="b-caf-bar"></div>` +
    `</div>`;
  renderCafBar(r.caffeine_mg);

  document.getElementById("b-save").addEventListener("click", async () => {
    const numOrNull = (id) => { const x = parseFloat(document.getElementById(id).value); return isNaN(x) ? null : x; };
    const intOrNull = (id) => { const x = document.getElementById(id).value; return x === "" ? null : Number(x); };
    const date = document.getElementById("b-date").value;
    if (!date) return;
    const row = {
      date,
      weight: numOrNull("b-weight"),
      caffeine_mg: numOrNull("b-caf"),
      sleep_hours: numOrNull("b-sleep"),
      sleep_quality: intOrNull("b-squal"),
      water_ml: numOrNull("b-water"),
      mood: intOrNull("b-mood"),
      hunger: intOrNull("b-hunger"),
      updated_at: new Date().toISOString(),
    };
    await sb.from("body_metrics").upsert(row, { onConflict: "date" });
    await renderBody(date);
    const h = document.getElementById("b-hint");
    if (h) { h.textContent = "Gespeichert ✓"; setTimeout(() => (h.textContent = ""), 2000); }
  });
}
window.renderBody = renderBody;
```

- [ ] **Step 2: Körper-Container in index.html einfügen**

In `index.html`, in `<section id="view-today" ...>`, nach `<div id="dayreflexion"></div>` einfügen:

```html
      <h2 class="sec">Körper</h2>
      <div id="body"></div>
```

- [ ] **Step 3: Script-Includes einfügen**

In `index.html`, **vor** der Zeile `<script src="assets/trends-calc.js"></script>`, einfügen (so steht `body-calc.js` vor `trends.js`):

```html
  <script src="assets/body-calc.js"></script>
  <script src="assets/body.js"></script>
```

- [ ] **Step 4: renderBody in renderToday aufrufen**

In `assets/app.js`, in `renderToday`, die letzte Zeile des Funktionskörpers ergänzen. Aktuell endet `renderToday` mit:

```js
  renderDayReflexion(iso(today));
}
```

ersetzen durch:

```js
  renderDayReflexion(iso(today));
  renderBody();
}
```

- [ ] **Step 5: Körper-Styles ergänzen**

Hänge ans Ende von `assets/styles.css` an:

```css
/* ---- Körper ---- */
.body-card { background: var(--panel-2); border: 1px solid var(--line); border-radius: 10px; padding: 12px; }
.body-f { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; color: var(--muted); font-size: 12px; }
.body-f input, .body-f select { width: 100%; }
#b-caf-bar { margin-top: 12px; }
```

- [ ] **Step 6: Statisch verifizieren**

Run: `cd /Users/farell.ceo/the-plan && /opt/homebrew/bin/bun build assets/body.js --target=browser > /dev/null && echo "parse ok"`
Expected: `parse ok`.
Run: `grep -n 'id="body"' index.html` → Container vorhanden.
Run: `grep -n -E 'body-calc\.js|body\.js|trends-calc\.js|app\.js' index.html` → body-calc.js + body.js stehen vor trends-calc.js und vor app.js (Zeilennummern zeigen Reihenfolge).
Run: `grep -n 'renderBody' assets/app.js` → Aufruf in renderToday.
Run: `grep -n 'window.renderBody' assets/body.js` → Export vorhanden.

- [ ] **Step 7: Commit**

```bash
git add assets/body.js index.html assets/app.js assets/styles.css
git commit -m "feat(koerper): Eingabe + Koffein-Balken unten auf Heute"
```

**Hinweis für den Controller (manuelle Browser-Verifikation):** „Heute" öffnen → unten „Körper"-Karte. Werte eintragen (inkl. Koffein > 400 zum Test der Rot-Warnung) → speichern → bleibt nach Reload erhalten; Koffein-Balken färbt sich korrekt; Datum ändern + speichern legt einen anderen Tag an (Nachtragen). Keine Konsolenfehler.

---

### Task 4: Körper-Kurven im Trends-Tab

**Files:**
- Modify: `index.html` (zwei Diagramm-Container in `#view-trends`)
- Modify: `assets/trends.js` (Gewicht- + Schlaf-Linien laden & rendern)

**Interfaces:**
- Consumes: `metricSeries` (body-calc.js), `svgLineChart` (charts.js), `sb`, `iso` (app.js).
- Produces: zwei zusätzliche Linien-Diagramme (`#trends-weight`, `#trends-sleep`) am Ende des Trends-Tabs.

- [ ] **Step 1: Container in index.html einfügen**

In `index.html`, in `<section id="view-trends" ...>`, nach `<div id="trends-ki"></div>` einfügen:

```html
      <h2 class="sec">Gewicht (kg)</h2>
      <div id="trends-weight"></div>
      <h2 class="sec">Schlaf (h)</h2>
      <div id="trends-sleep"></div>
```

- [ ] **Step 2: Gewicht/Schlaf in renderTrends ergänzen**

In `assets/trends.js`, am Ende der Funktion `renderTrends` (direkt vor der schließenden `}` der Funktion, nach der `trends-ki`-Zeile) einfügen:

```js
  // Körper-Kurven (Gewicht + Schlaf) aus body_metrics
  const { data: bm } = await sb.from("body_metrics").select("date,weight,sleep_hours").gte("date", iso(start)).lte("date", iso(end));
  const weight = metricSeries(bm || [], "weight").map((p) => ({ label: p.date.slice(5), value: p.value }));
  document.getElementById("trends-weight").innerHTML = `<div class="chart-card">${svgLineChart(weight)}</div>`;
  const sleep = metricSeries(bm || [], "sleep_hours").map((p) => ({ label: p.date.slice(5), value: p.value }));
  document.getElementById("trends-sleep").innerHTML = `<div class="chart-card">${svgLineChart(sleep, { color: "var(--gold-soft)" })}</div>`;
```

(Die Variablen `start` und `end` existieren bereits am Anfang von `renderTrends`.)

- [ ] **Step 3: Regressionstest + Parse-Check**

Run: `cd /Users/farell.ceo/the-plan && /opt/homebrew/bin/bun test`
Expected: PASS — alle Tests grün (finance-calc, charts, markdown, trends-calc, body-calc).
Run: `cd /Users/farell.ceo/the-plan && /opt/homebrew/bin/bun build assets/trends.js --target=browser > /dev/null && echo "parse ok"`
Expected: `parse ok`.

- [ ] **Step 4: Commit**

```bash
git add index.html assets/trends.js
git commit -m "feat(koerper): Gewicht- und Schlaf-Kurven im Trends-Tab"
```

**Hinweis für den Controller (manuelle Browser-Verifikation):** Nach Eintragen einiger Körper-Werte über mehrere Tage „Trends" öffnen → unten Gewicht- und Schlaf-Linien rendern mit den eingetragenen Werten; ohne Daten erscheint der „Noch keine Daten"-Platzhalter.

---

## Self-Review (vom Plan-Autor durchgeführt)

**Spec-Abdeckung (Spec-Abschnitt „5. Körper 💪"):**
- Tageseingabe Gewicht/Koffein/Schlaf+Qualität/Wasser/Stimmung/Hunger, Upsert pro Tag, Datum default heute + Vortag nachtragbar → Task 3 ✓
- Skalen 1–5 für Qualität/Stimmung/Hunger → Task 3 (`sel15`) ✓
- Koffein-Balken gegen 400 mg mit Warnfärbung → Task 3 (`renderCafBar`/`cafColor`) ✓
- Gewicht- und Schlaf-Verläufe im Trends-Tab → Task 4 ✓
- Eingabe unten auf „Heute", Kurven in Trends (Navigation laut Spec) → Task 3/4 ✓
- numeric-als-String defensiv via `Number()` → Task 2 (metricSeries) + Task 3 (renderCafBar) ✓

**Placeholder-Scan:** Keine TBD/TODO.

**Typ-Konsistenz:** `metricSeries` in Task 2 definiert, in Task 4 konsumiert. `renderBody`/`renderCafBar`/`cafColor`/`sel15` konsistent. Container-IDs (`body`, `b-*`, `trends-weight`, `trends-sleep`) konsistent zwischen index.html und JS. Tabellen-/Spaltennamen (`body_metrics`, weight/caffeine_mg/sleep_hours/sleep_quality/water_ml/mood/hunger) konsistent in Task 1/3/4. Reuse vorhandener CSS-Klassen (`.fin-row`, `.bud-*`, `.btn`, `.saved-hint`, `.chart-card`).

**Out of scope (spätere Phase):** Ziele.
```
