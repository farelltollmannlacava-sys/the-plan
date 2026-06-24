# Phase 5: Ziele — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Einen „Ziele"-Tab bauen, der Farells 2026-KPIs zeigt: binäre Ziele zum Abhaken, messbare Ziele mit Fortschrittsbalken + manueller Ist-Eingabe, und das Einnahmen-Ziel „1 Monat ≥ 5.000 €" automatisch aus den Finanz-Einnahmen berechnet.

**Architecture:** Bestehendes statisches Vanilla-JS-Cockpit (GitHub Pages + Supabase). Neue Tabelle `goals` (DB ist kanonisch). Reine Logik (`goals-calc.js`, mit `bun test`): bestes Monats-Einnahmen-Ergebnis (Auto-Synergie) + Fortschritts-Prozent. DOM/Supabase in `goals.js`.

**Tech Stack:** HTML, Vanilla JS (klassische Scripts), Supabase JS v2 (CDN), `bun test`. Kein Build, kein Framework.

## Global Constraints

- Kein Build, kein npm/node — Tests mit `/opt/homebrew/bin/bun` (`bun test`). Keine `package.json`.
- Neue Frontend-Dateien sind klassische Scripts (kein `type="module"`); `goals-calc.js` endet mit `if (typeof module !== "undefined" && module.exports) { module.exports = { ... }; }` für bun-Tests.
- Supabase-Projekt ref `ykhuavvsfeairuwnymsr`. RLS-Policy für neue Tabelle: `auth.jwt() ->> 'email' = 'farelltollmannlacava@gmail.com'`.
- **Supabase liefert `numeric` als String** — Beträge/Werte beim Rechnen defensiv mit `Number()` wandeln.
- Ziel-Typen: `binary` (Häkchen, Feld `done`), `numeric` (Fortschrittsbalken `current`/`target`, manuell editierbar), `auto` (berechnet, read-only — derzeit nur das Einnahmen-Ziel aus `finance_entries`).
- Tab-Reihenfolge: `Heute · Kalender · Woche · Finanzen · Trends · Ziele · Verbote · Sonntag` (Ziele direkt nach Trends).
- DB kanonisch: die Ziele werden in `goals` gepflegt, `plan/ziele.md` bleibt Prosa.

---

### Task 1: Supabase-Tabelle `goals` + Seed

**Files:**
- Migration: über Supabase MCP `apply_migration`. Kein lokales Datei-Artefakt.

**Interfaces:**
- Produces: `goals(key pk, label, type, target, current, unit, done, sort)` mit RLS, vorbefüllt mit Farells 2026-KPIs.

- [ ] **Step 1: Migration anwenden**

Über MCP `apply_migration` (name: `goals_table`):

```sql
create table if not exists goals (
  key text primary key,
  label text not null,
  type text not null check (type in ('binary','numeric','auto')),
  target numeric,
  current numeric default 0,
  unit text,
  done boolean default false,
  sort integer default 0
);
alter table goals enable row level security;
create policy "owner_all" on goals for all
  using (auth.jwt() ->> 'email' = 'farelltollmannlacava@gmail.com')
  with check (auth.jwt() ->> 'email' = 'farelltollmannlacava@gmail.com');

insert into goals (key, label, type, target, current, unit, done, sort) values
  ('eigenes-geld',     'Erstes eigenes Geld als Selbständiger (≥ 1 € mit Rechnung)', 'binary',  null, 0,  null,       false, 10),
  ('monat-5000',       '1 Monat mit ≥ 5.000 € Einnahmen',                            'auto',    5000, 0,  '€',        false, 20),
  ('follower-1000',    'Social Media: Follower auf Hauptplattform',                  'numeric', 1000, 0,  'Follower', false, 30),
  ('posts-50',         'Social Media: veröffentlichte Posts (12 Monate)',            'numeric', 50,   0,  'Posts',    false, 40),
  ('mailing-500',      'Momentum Pre-Launch: Mailing-Liste',                         'numeric', 500,  0,  'Subs',     false, 50),
  ('momentum-ready',   'Bereit für Momentum-Launch 2027 (Produkt+Produktion+Funnel+Liste+Datum)', 'binary', null, 0, null, false, 60),
  ('kfa-8-10',         'KFA durchgängig 8–10 %',                                     'binary',  null, 0,  null,       false, 70),
  ('ausziehen',        'Ausziehen von zuhause (Mietvertrag unterschrieben)',         'binary',  null, 0,  null,       false, 80),
  ('klausuren-2',      'Alle BWL-Klausuren 2026 mit Note ≤ 2,0',                     'binary',  null, 0,  null,       false, 90),
  ('ki-3-projekte',    'KI auf Top-Niveau: 3 öffentliche Projekte gezeigt',          'binary',  null, 0,  null,       false, 100),
  ('porsche',          'Porsche vor dem 24. Geburtstag',                             'binary',  null, 0,  null,       false, 110)
on conflict (key) do nothing;
```

- [ ] **Step 2: Verifizieren**

MCP `execute_sql`: `select count(*) from goals;` → 11. MCP `list_tables`: `goals` mit `rls_enabled: true`.

- [ ] **Step 3: Commit**

Keine lokalen Dateien — kein Commit.

---

### Task 2: Reine Logik `goals-calc.js` (TDD)

**Files:**
- Create: `assets/goals-calc.js`
- Test: `tests/goals-calc.test.js`

**Interfaces:**
- Produces:
  - `bestMonthIncome(entries: object[]): number` — höchste Summe der Einnahmen (`kind === "income"`) eines Kalendermonats (`date` `YYYY-MM-DD`), Beträge via `Number()` (Supabase numeric als String). 0 bei keinen Einnahmen.
  - `goalPct(current: number, target: number): number` — `Math.min(current/target, 1) * 100` gerundet; 0 wenn `target` fehlt/≤ 0 oder `current` ≤ 0.

- [ ] **Step 1: Failing test schreiben**

Create `tests/goals-calc.test.js`:

```js
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
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `cd /Users/farell.ceo/the-plan && /opt/homebrew/bin/bun test tests/goals-calc.test.js`
Expected: FAIL — `Cannot find module '../assets/goals-calc.js'`.

- [ ] **Step 3: Implementierung schreiben**

Create `assets/goals-calc.js`:

```js
/* The Plan — Ziele-Logik (pur, ohne DOM/Supabase) */
function bestMonthIncome(entries) {
  const m = {};
  entries.filter((e) => e.kind === "income").forEach((e) => {
    const k = e.date.slice(0, 7);
    m[k] = (m[k] || 0) + Number(e.amount);
  });
  const vals = Object.values(m);
  return vals.length ? Math.max(...vals) : 0;
}

function goalPct(current, target) {
  if (!target || target <= 0 || current <= 0) return 0;
  return Math.round(Math.min(current / target, 1) * 100);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { bestMonthIncome, goalPct };
}
```

- [ ] **Step 4: Test laufen lassen, Erfolg bestätigen**

Run: `cd /Users/farell.ceo/the-plan && /opt/homebrew/bin/bun test tests/goals-calc.test.js`
Expected: PASS — 5 pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add assets/goals-calc.js tests/goals-calc.test.js
git commit -m "feat(ziele): reine Logik goals-calc (bestMonthIncome, goalPct) + Tests"
```

---

### Task 3: Ziele-Tab verdrahten (leere Ansicht)

**Files:**
- Modify: `index.html` (Tab-Button + View-Section + Script-Includes)
- Modify: `assets/app.js` (Tab-Router-Eintrag)

**Interfaces:**
- Produces: klickbarer Tab „Ziele" (nach „Trends"), zeigt `#view-ziele` und ruft `renderGoals()` auf. `renderGoals` wird in Task 4 definiert; hier ein temporärer Stub.

- [ ] **Step 1: Tab-Button einfügen**

In `index.html`, in der `<nav class="tabs">`, nach `<button data-view="trends">Trends</button>` einfügen:

```html
      <button data-view="ziele">Ziele</button>
```

- [ ] **Step 2: View-Section einfügen**

In `index.html`, nach dem schließenden `</section>` von `#view-trends` (vor `<section id="view-verbote" ...>`) einfügen:

```html
    <section id="view-ziele" class="view">
      <h2 class="sec">Ziele 2026</h2>
      <div id="goals"></div>
    </section>
```

- [ ] **Step 3: Script-Includes einfügen**

In `index.html`, vor `<script src="assets/app.js"></script>`, einfügen:

```html
  <script src="assets/goals-calc.js"></script>
  <script src="assets/goals.js"></script>
```

- [ ] **Step 4: Temporären Stub anlegen**

Create `assets/goals.js`:

```js
/* The Plan — Ziele (Stub, wird in Task 4 ersetzt) */
async function renderGoals() {
  document.getElementById("goals").textContent = "Ziele folgt …";
}
```

- [ ] **Step 5: Router-Eintrag in app.js ergänzen**

In `assets/app.js`, in `initTabs`, die Router-Zeile erweitern. Ersetze:

```js
      ({ today: renderToday, calendar: renderCalendar, week: renderWeek, finance: renderFinance, trends: renderTrends, verbote: renderVerbote, reflexion: renderReflexion }[b.dataset.view])();
```

durch:

```js
      ({ today: renderToday, calendar: renderCalendar, week: renderWeek, finance: renderFinance, trends: renderTrends, ziele: renderGoals, verbote: renderVerbote, reflexion: renderReflexion }[b.dataset.view])();
```

- [ ] **Step 6: Statisch verifizieren**

Run: `cd /Users/farell.ceo/the-plan && /opt/homebrew/bin/bun build assets/goals.js --target=browser > /dev/null && echo "parse ok"`
Expected: `parse ok`.
Run: `grep -n 'data-view="ziele"' index.html` → Button vorhanden.
Run: `grep -n 'id="view-ziele"' index.html` → Section vorhanden.
Run: `grep -n -E 'goals-calc\.js|goals\.js|app\.js' index.html` → goals-calc.js + goals.js vor app.js.
Run: `grep -n 'ziele: renderGoals' assets/app.js` → Router verdrahtet.

- [ ] **Step 7: Commit**

```bash
git add index.html assets/app.js assets/goals.js
git commit -m "feat(ziele): Tab + leere Ansicht verdrahtet"
```

---

### Task 4: Ziele — Render (binär, messbar, Auto-Einnahmen)

**Files:**
- Modify: `assets/goals.js` (Stub vollständig ersetzen)
- Modify: `assets/styles.css` (Ziele-Styles)

**Interfaces:**
- Consumes: `bestMonthIncome`, `goalPct` (goals-calc); globaler `sb` (app.js); vorhandene CSS-Klassen `.bud-top`/`.bud-track`/`.bud-lbl`/`.bud-num`, `.btn`.
- Produces: `renderGoals()` (global, via `window.renderGoals = renderGoals`).

- [ ] **Step 1: goals.js vollständig schreiben**

Ersetze den **gesamten** Inhalt von `assets/goals.js`:

```js
/* The Plan — Ziele 2026 */
const gfmt = (n) => Math.round(Number(n) || 0).toLocaleString("de-DE");

async function renderGoals() {
  const el = document.getElementById("goals");
  if (!el) return;
  const [{ data: goals }, { data: fin }] = await Promise.all([
    sb.from("goals").select("*").order("sort"),
    sb.from("finance_entries").select("date,kind,amount"),
  ]);
  const best = bestMonthIncome(fin || []);

  el.innerHTML = (goals || []).map((g) => goalRow(g, best)).join("");

  el.querySelectorAll(".goal-check").forEach((b) =>
    b.addEventListener("click", async (ev) => {
      const t = ev.currentTarget;
      const now = !t.classList.contains("on");
      t.classList.toggle("on", now);
      await sb.from("goals").update({ done: now }).eq("key", t.dataset.key);
    })
  );
  el.querySelectorAll(".goal-save").forEach((b) =>
    b.addEventListener("click", async (ev) => {
      const key = ev.currentTarget.dataset.key;
      const val = parseFloat(document.getElementById("gi-" + key).value);
      if (isNaN(val)) return;
      await sb.from("goals").update({ current: val }).eq("key", key);
      renderGoals();
    })
  );
}

function goalRow(g, best) {
  const safe = g.label.replace(/</g, "&lt;");
  if (g.type === "binary") {
    return `<div class="goal-bin"><button class="goal-check${g.done ? " on" : ""}" data-key="${g.key}" aria-label="erreicht">✓</button>` +
      `<span class="goal-lbl${g.done ? " done" : ""}">${safe}</span></div>`;
  }
  const cur = g.type === "auto" ? best : Number(g.current) || 0;
  const target = Number(g.target) || 0;
  const pct = goalPct(cur, target);
  const unit = g.unit ? " " + g.unit : "";
  const reached = pct >= 100;
  const editor = g.type === "numeric"
    ? `<div class="goal-edit"><input id="gi-${g.key}" type="number" value="${Number(g.current) || 0}"><button class="btn goal-save" data-key="${g.key}">Ist speichern</button></div>`
    : `<div class="goal-edit"><span class="goal-auto">automatisch aus Einnahmen</span></div>`;
  return `<div class="goal-num">` +
    `<div class="bud-top"><span class="bud-lbl">${safe}</span>` +
    `<span class="bud-num">${gfmt(cur)} / ${gfmt(target)}${unit}</span></div>` +
    `<div class="bud-track"><i style="width:${pct}%;background:${reached ? "var(--green)" : "var(--gold)"}"></i></div>` +
    editor + `</div>`;
}
window.renderGoals = renderGoals;
```

- [ ] **Step 2: Ziele-Styles ergänzen**

Hänge ans Ende von `assets/styles.css` an:

```css
/* ---- Ziele ---- */
.goal-bin { display: flex; align-items: center; gap: 10px; padding: 9px 2px; border-bottom: 1px solid var(--line); }
.goal-check { flex: none; width: 26px; height: 26px; border-radius: 50%; border: 1px solid var(--line); background: transparent; color: transparent; cursor: pointer; font-size: 14px; line-height: 1; }
.goal-check.on { border-color: var(--green); background: var(--green); color: #0c0c0d; }
.goal-lbl { font-size: 14px; color: var(--text); }
.goal-lbl.done { color: var(--muted); text-decoration: line-through; }
.goal-num { padding: 12px 0; border-bottom: 1px solid var(--line); }
.goal-edit { display: flex; gap: 8px; margin-top: 8px; align-items: center; }
.goal-edit input { width: 120px; }
.goal-auto { color: var(--muted); font-size: 12px; font-style: italic; }
```

- [ ] **Step 3: Regressionstest + Parse-Check**

Run: `cd /Users/farell.ceo/the-plan && /opt/homebrew/bin/bun test`
Expected: PASS — alle Tests grün (finance-calc, charts, markdown, trends-calc, body-calc, goals-calc).
Run: `cd /Users/farell.ceo/the-plan && /opt/homebrew/bin/bun build assets/goals.js --target=browser > /dev/null && echo "parse ok"`
Expected: `parse ok`.

- [ ] **Step 4: Commit**

```bash
git add assets/goals.js assets/styles.css
git commit -m "feat(ziele): binäre + messbare Ziele + Auto-Einnahmen-Synergie"
```

**Hinweis für den Controller (manuelle Browser-Verifikation):** „Ziele" öffnen → 11 Ziele. Binäre lassen sich abhaken (bleiben nach Reload). Bei messbaren Ist-Wert eintragen + speichern → Balken aktualisiert; ≥ Ziel → grün. Das Ziel „1 Monat ≥ 5.000 €" zeigt automatisch den besten Monatswert aus den Finanz-Einnahmen (read-only).

---

## Self-Review (vom Plan-Autor durchgeführt)

**Spec-Abdeckung (Spec-Abschnitt „4. Ziele 🎯"):**
- 2026-KPIs in `goals` (DB kanonisch) → Task 1 (Seed) ✓
- Binäre Ziele als Häkchen → Task 4 (`goal-check`) ✓
- Messbare Ziele (Follower ≥ 1.000, Posts ≥ 50, Mailing ≥ 500) mit Balken + manuellem Ist → Task 1 (Seed numeric) + Task 4 ✓
- Auto-Synergie „1 Monat ≥ 5.000 € Einnahmen“ live aus `finance_entries` → Task 2 (`bestMonthIncome`) + Task 4 ✓
- numeric-als-String defensiv via `Number()` → Task 2 + `gfmt` ✓

**Placeholder-Scan:** Keine TBD/TODO. Der Stub in Task 3 wird in Task 4 ersetzt.

**Typ-Konsistenz:** `bestMonthIncome`/`goalPct` in Task 2 definiert, in Task 4 konsumiert. `renderGoals`/`goalRow`/`gfmt` konsistent. Container `goals`, Input-IDs `gi-<key>`, Tabellen-/Spaltennamen (`goals`: key/label/type/target/current/unit/done/sort) konsistent in Task 1/4. Reuse vorhandener CSS-Klassen (`.bud-*`, `.btn`).

**Out of scope:** Keine weiteren Phasen — Ziele ist die letzte geplante Phase des v2-Ausbaus.
```
