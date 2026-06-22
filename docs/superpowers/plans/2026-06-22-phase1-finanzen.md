# Phase 1: Finanzen — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Einen „Finanzen"-Tab bauen, der Einnahmen/Ausgaben mit Kategorie erfasst, den Kontostand automatisch berechnet, zwei Budget-Limits (80 €/400 €) live anzeigt und drei Diagramme rendert.

**Architecture:** Bestehendes statisches Vanilla-JS-Cockpit (GitHub Pages + Supabase). Reine Rechenlogik wird in ein testbares Modul `finance-calc.js` ausgelagert (mit `bun test`), DOM/Supabase-Rendering in `finance.js`, wiederverwendbare SVG-Diagramme in `charts.js`. Alle neuen Dateien sind klassische `<script>`-Dateien mit `window`-Globals (wie der Rest der App); `finance-calc.js` und `charts.js` haben zusätzlich einen `module.exports`-Footer, damit `bun test` sie importieren kann.

**Tech Stack:** HTML, Vanilla JS (klassische Scripts), Supabase JS v2 (CDN), SVG (handgemalt), `bun test` für Unit-Tests. Kein Build, kein Framework.

## Global Constraints

- Kein Build, kein npm/node — Tests laufen mit `/opt/homebrew/bin/bun` (`bun test`). Keine `package.json` anlegen (bun test braucht keine).
- Neue Frontend-Dateien sind klassische Scripts (kein `type="module"`), Funktionen/`const` auf Top-Level (im Browser über die Script-übergreifende globale Lexikal-Umgebung erreichbar).
- `finance-calc.js` und `charts.js` enden mit `if (typeof module !== "undefined" && module.exports) { module.exports = { ... }; }` für bun-Tests; im Browser wird dieser Block übersprungen.
- Design-Tokens aus `assets/styles.css` verwenden: `--gold`, `--green`, `--red`, `--muted`, `--line`, `--panel-2`, `--text`. Serif = `Bodoni Moda`.
- Supabase-Projekt ref `ykhuavvsfeairuwnymsr`. RLS-Policy für jede neue Tabelle: `auth.jwt() ->> 'email' = 'farelltollmannlacava@gmail.com'`.
- Datumsformat überall `YYYY-MM-DD` (lokale Browser-Zeit ≈ Europe/Berlin), passend zur vorhandenen `iso()`-Helferfunktion in `app.js`.
- Beträge: `numeric`, immer positiv gespeichert; Richtung über `kind` ('income'|'expense').
- Kategorien-Definition (Spec): Ausgaben = `Miete`, `Tanken`, `Investition`, `Konsum`, `Sonstiges`. 80-€-Limit = nur `Konsum`. 400-€-Limit = alle Ausgaben außer `Miete`/`Tanken`/`Investition` (= `Konsum` + `Sonstiges`).

---

### Task 1: Supabase-Tabellen `finance_entries` + `app_settings`

**Files:**
- Migration: über Supabase MCP `apply_migration` (oder Dashboard → SQL Editor). Kein lokales Datei-Artefakt nötig.

**Interfaces:**
- Produces: Tabelle `finance_entries(id, date, kind, amount, category, note, created_at)` und `app_settings(key, value, updated_at)`, beide mit RLS auf Farells Mail.

- [ ] **Step 1: Migration anwenden**

Über Supabase MCP-Tool `apply_migration` (name: `finance_tables`) mit diesem SQL:

```sql
create table if not exists finance_entries (
  id bigint generated always as identity primary key,
  date date not null,
  kind text not null check (kind in ('income','expense')),
  amount numeric not null check (amount >= 0),
  category text not null,
  note text,
  created_at timestamptz not null default now()
);
alter table finance_entries enable row level security;
create policy "owner_all" on finance_entries for all
  using (auth.jwt() ->> 'email' = 'farelltollmannlacava@gmail.com')
  with check (auth.jwt() ->> 'email' = 'farelltollmannlacava@gmail.com');

create table if not exists app_settings (
  key text primary key,
  value jsonb,
  updated_at timestamptz not null default now()
);
alter table app_settings enable row level security;
create policy "owner_all" on app_settings for all
  using (auth.jwt() ->> 'email' = 'farelltollmannlacava@gmail.com')
  with check (auth.jwt() ->> 'email' = 'farelltollmannlacava@gmail.com');
```

- [ ] **Step 2: Tabellen verifizieren**

Über MCP `list_tables` (schema `public`) prüfen, dass `finance_entries` und `app_settings` erscheinen, RLS = enabled.
Expected: beide Tabellen gelistet, `rls_enabled: true`.

- [ ] **Step 3: Commit**

Keine lokalen Dateien geändert — kein Commit. (Die Migration lebt in Supabase.)

---

### Task 2: Reine Rechenlogik `finance-calc.js` (TDD)

**Files:**
- Create: `assets/finance-calc.js`
- Test: `tests/finance-calc.test.js`

**Interfaces:**
- Produces (alle pur, ohne DOM/Supabase):
  - `EXPENSE_CATEGORIES: string[]` = `["Miete","Tanken","Investition","Konsum","Sonstiges"]`
  - `FIXED_CATEGORIES: string[]` = `["Miete","Tanken","Investition"]`
  - `computeBalance(startBalance: number, entries: Entry[]): number`
  - `monthBudget(entries: Entry[], year: number, month: number): {konsum: number, gesamt: number}` (month 1–12)
  - `balanceSeries(startBalance: number, entries: Entry[]): {date: string, balance: number}[]`
  - `monthlyExpenseTotals(entries: Entry[]): {month: string, total: number}[]` (month = `YYYY-MM`)
  - `monthlyIncomeTotals(entries: Entry[]): {month: string, total: number}[]`
  - `Entry` = `{date: 'YYYY-MM-DD', kind: 'income'|'expense', amount: number, category: string, note?: string}`

- [ ] **Step 1: Failing test schreiben**

Create `tests/finance-calc.test.js`:

```js
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
  expect(monthBudget(E, 2026, 7).konsum).toBe(40);
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
  const m = monthlyExpenseTotals(E);
  expect(m).toEqual([
    { month: "2026-06", total: 970 },
    { month: "2026-07", total: 40 },
  ]);
});

test("monthlyIncomeTotals: nur Einnahmen", () => {
  expect(monthlyIncomeTotals(E)).toEqual([{ month: "2026-06", total: 2100 }]);
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `cd /Users/farell.ceo/the-plan && /opt/homebrew/bin/bun test tests/finance-calc.test.js`
Expected: FAIL — `Cannot find module '../assets/finance-calc.js'`.

- [ ] **Step 3: Implementierung schreiben**

Create `assets/finance-calc.js`:

```js
/* The Plan — Finanz-Rechenlogik (pur, ohne DOM/Supabase) */
const EXPENSE_CATEGORIES = ["Miete", "Tanken", "Investition", "Konsum", "Sonstiges"];
const FIXED_CATEGORIES = ["Miete", "Tanken", "Investition"];

function computeBalance(startBalance, entries) {
  return entries.reduce(
    (bal, e) => bal + (e.kind === "income" ? e.amount : -e.amount),
    startBalance
  );
}

function monthBudget(entries, year, month) {
  const pre = `${year}-${String(month).padStart(2, "0")}`;
  const exp = entries.filter((e) => e.kind === "expense" && e.date.startsWith(pre));
  const konsum = exp.filter((e) => e.category === "Konsum").reduce((s, e) => s + e.amount, 0);
  const gesamt = exp.filter((e) => !FIXED_CATEGORIES.includes(e.category)).reduce((s, e) => s + e.amount, 0);
  return { konsum, gesamt };
}

function balanceSeries(startBalance, entries) {
  const sorted = [...entries].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  let bal = startBalance;
  const byDate = {};
  sorted.forEach((e) => {
    bal += e.kind === "income" ? e.amount : -e.amount;
    byDate[e.date] = bal;
  });
  return Object.keys(byDate).sort().map((d) => ({ date: d, balance: byDate[d] }));
}

function monthlyTotals(entries, kind) {
  const m = {};
  entries.filter((e) => e.kind === kind).forEach((e) => {
    const k = e.date.slice(0, 7);
    m[k] = (m[k] || 0) + e.amount;
  });
  return Object.keys(m).sort().map((k) => ({ month: k, total: m[k] }));
}
const monthlyExpenseTotals = (entries) => monthlyTotals(entries, "expense");
const monthlyIncomeTotals = (entries) => monthlyTotals(entries, "income");

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    EXPENSE_CATEGORIES, FIXED_CATEGORIES, computeBalance,
    monthBudget, balanceSeries, monthlyExpenseTotals, monthlyIncomeTotals,
  };
}
```

- [ ] **Step 4: Test laufen lassen, Erfolg bestätigen**

Run: `cd /Users/farell.ceo/the-plan && /opt/homebrew/bin/bun test tests/finance-calc.test.js`
Expected: PASS — 9 pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add assets/finance-calc.js tests/finance-calc.test.js
git commit -m "feat(finanzen): reine Rechenlogik finance-calc + Tests"
```

---

### Task 3: SVG-Diagramm-Helfer `charts.js`

**Files:**
- Create: `assets/charts.js`
- Test: `tests/charts.test.js`

**Interfaces:**
- Produces:
  - `svgBarChart(data: {label: string, value: number}[], opts?: {height?: number, color?: string}): string` — gibt einen `<svg>`-String zurück.
  - `svgLineChart(data: {label: string, value: number}[], opts?: {height?: number, color?: string}): string` — gibt einen `<svg>`-String zurück.
  - Beide skalieren auf `viewBox="0 0 320 H"` (responsiv über CSS-Breite), Default-Höhe 160, Default-Farbe `var(--gold)`.

- [ ] **Step 1: Failing test schreiben**

Create `tests/charts.test.js`:

```js
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
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `cd /Users/farell.ceo/the-plan && /opt/homebrew/bin/bun test tests/charts.test.js`
Expected: FAIL — `Cannot find module '../assets/charts.js'`.

- [ ] **Step 3: Implementierung schreiben**

Create `assets/charts.js`:

```js
/* The Plan — handgemalte SVG-Diagramme (Gold/Schwarz), keine Tooltips */
const _W = 320;
function _empty(h) {
  return `<svg viewBox="0 0 ${_W} ${h}" class="chart"><text x="${_W / 2}" y="${h / 2}" text-anchor="middle" fill="var(--muted)" font-size="12">Noch keine Daten</text></svg>`;
}

function svgBarChart(data, opts) {
  const h = (opts && opts.height) || 160;
  const color = (opts && opts.color) || "var(--gold)";
  if (!data || !data.length) return _empty(h);
  const padB = 22, padT = 10, max = Math.max(...data.map((d) => d.value), 1);
  const gap = 8, bw = (_W - (data.length + 1) * gap) / data.length;
  const usableH = h - padB - padT;
  let bars = "";
  data.forEach((d, i) => {
    const bh = (d.value / max) * usableH;
    const x = gap + i * (bw + gap), y = padT + (usableH - bh);
    bars +=
      `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="2" fill="${color}"/>` +
      `<text x="${(x + bw / 2).toFixed(1)}" y="${h - 8}" text-anchor="middle" fill="var(--muted)" font-size="9">${d.label}</text>`;
  });
  return `<svg viewBox="0 0 ${_W} ${h}" class="chart">${bars}</svg>`;
}

function svgLineChart(data, opts) {
  const h = (opts && opts.height) || 160;
  const color = (opts && opts.color) || "var(--gold)";
  if (!data || !data.length) return _empty(h);
  const padB = 22, padT = 10, padX = 8;
  const usableH = h - padB - padT, usableW = _W - padX * 2;
  const vals = data.map((d) => d.value);
  const max = Math.max(...vals), min = Math.min(...vals, 0);
  const span = max - min || 1;
  const n = data.length;
  const xFor = (i) => padX + (n === 1 ? usableW / 2 : (i / (n - 1)) * usableW);
  const yFor = (v) => padT + (usableH - ((v - min) / span) * usableH);
  const pts = data.map((d, i) => `${xFor(i).toFixed(1)},${yFor(d.value).toFixed(1)}`).join(" ");
  const dots = data.map((d, i) => `<circle cx="${xFor(i).toFixed(1)}" cy="${yFor(d.value).toFixed(1)}" r="2.5" fill="${color}"/>`).join("");
  const firstLbl = `<text x="${padX}" y="${h - 8}" fill="var(--muted)" font-size="9">${data[0].label}</text>`;
  const lastLbl = n > 1 ? `<text x="${_W - padX}" y="${h - 8}" text-anchor="end" fill="var(--muted)" font-size="9">${data[n - 1].label}</text>` : "";
  return `<svg viewBox="0 0 ${_W} ${h}" class="chart"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>${dots}${firstLbl}${lastLbl}</svg>`;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { svgBarChart, svgLineChart };
}
```

- [ ] **Step 4: Test laufen lassen, Erfolg bestätigen**

Run: `cd /Users/farell.ceo/the-plan && /opt/homebrew/bin/bun test tests/charts.test.js`
Expected: PASS — 3 pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add assets/charts.js tests/charts.test.js
git commit -m "feat(charts): SVG-Linien- und Balken-Helfer + Tests"
```

---

### Task 4: Finanzen-Tab verdrahten (leere Ansicht)

**Files:**
- Modify: `index.html` (Tab-Button + View-Section + Script-Includes)
- Modify: `assets/app.js` (Tab-Router-Eintrag)

**Interfaces:**
- Consumes: nichts.
- Produces: klickbarer Tab „Finanzen", der die (noch leere) Section `#view-finance` zeigt und `renderFinance()` aufruft. `renderFinance` wird in Task 5 definiert; für diese Task ein temporärer Stub, damit der Router nicht bricht.

- [ ] **Step 1: Tab-Button einfügen**

In `index.html`, in der `<nav class="tabs">`, nach der Zeile `<button data-view="week">Woche</button>` einfügen:

```html
      <button data-view="finance">Finanzen</button>
```

- [ ] **Step 2: View-Section einfügen**

In `index.html`, nach dem schließenden `</section>` von `#view-week` (vor `<section id="view-verbote" ...>`) einfügen:

```html
    <section id="view-finance" class="view">
      <div id="finance-onboard"></div>
      <h2 class="sec">Buchung erfassen</h2>
      <div id="finance-form"></div>
      <h2 class="sec">Budget diesen Monat</h2>
      <div id="finance-budget"></div>
      <h2 class="sec">Verlauf</h2>
      <div id="finance-charts"></div>
      <h2 class="sec">Letzte Buchungen</h2>
      <div id="finance-list"></div>
    </section>
```

- [ ] **Step 3: Script-Includes einfügen**

In `index.html`, vor `<script src="assets/app.js"></script>`, einfügen:

```html
  <script src="assets/finance-calc.js"></script>
  <script src="assets/charts.js"></script>
  <script src="assets/finance.js"></script>
```

- [ ] **Step 4: Temporären Stub anlegen, damit der Router lädt**

Create `assets/finance.js` mit vorläufigem Inhalt:

```js
/* The Plan — Finanzen (Stub, wird in Task 5 ersetzt) */
async function renderFinance() {
  document.getElementById("finance-list").textContent = "Finanzen folgt …";
}
```

- [ ] **Step 5: Router-Eintrag in app.js ergänzen**

In `assets/app.js`, in der Funktion `initTabs`, die Router-Zeile erweitern. Ersetze:

```js
      ({ today: renderToday, calendar: renderCalendar, week: renderWeek, verbote: renderVerbote, reflexion: renderReflexion }[b.dataset.view])();
```

durch:

```js
      ({ today: renderToday, calendar: renderCalendar, week: renderWeek, finance: renderFinance, verbote: renderVerbote, reflexion: renderReflexion }[b.dataset.view])();
```

- [ ] **Step 6: Manuell verifizieren**

Lokal öffnen: `cd /Users/farell.ceo/the-plan && /opt/homebrew/bin/bun x serve . -p 5050` (oder `python3 -m http.server 5050`), Browser auf `http://localhost:5050`, einloggen.
Expected: In der Tab-Leiste steht „Finanzen" zwischen „Woche" und „Verbote". Klick → Section mit Überschriften erscheint, unter „Letzte Buchungen" steht „Finanzen folgt …". Keine Konsolenfehler.

- [ ] **Step 7: Commit**

```bash
git add index.html assets/app.js assets/finance.js
git commit -m "feat(finanzen): Tab + leere Ansicht verdrahtet"
```

---

### Task 5: Finanzen — Buchungen erfassen, bearbeiten, löschen + Startstand

**Files:**
- Modify: `assets/finance.js` (Stub vollständig ersetzen)
- Modify: `assets/styles.css` (Finanz-Styles ergänzen)

**Interfaces:**
- Consumes: `EXPENSE_CATEGORIES`, `computeBalance` (aus `finance-calc.js`); globaler Supabase-Client `sb` und Helfer `iso(date)` (aus `app.js`); globale `today`-Variable nicht nutzen — eigenes Default-Datum.
- Produces: `renderFinance()` (global), plus interne Daten-Helfer `loadFinance()`, `getStartBalance()`, `setStartBalance(n)`, `addEntry(o)`, `updateEntry(id,o)`, `deleteEntry(id)`. Setzt `window.renderFinance = renderFinance;`.

- [ ] **Step 1: finance.js vollständig schreiben (ohne Budget/Charts — die kommen in Task 6)**

Ersetze den **gesamten** Inhalt von `assets/finance.js`:

```js
/* The Plan — Finanzen */
const FIN_INCOME_CAT = "Einnahme";
const eur = (n) => (Math.round(n * 100) / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const todayIso = () => iso(new Date());

// ---- Supabase I/O ----
async function loadFinance() {
  const { data } = await sb.from("finance_entries").select("*").order("date", { ascending: false }).order("id", { ascending: false });
  return data || [];
}
async function getStartBalance() {
  const { data } = await sb.from("app_settings").select("value").eq("key", "start_balance").maybeSingle();
  return data && data.value != null ? Number(data.value) : null;
}
async function setStartBalance(n) {
  await sb.from("app_settings").upsert({ key: "start_balance", value: n, updated_at: new Date().toISOString() }, { onConflict: "key" });
}
async function addEntry(o) {
  await sb.from("finance_entries").insert(o);
}
async function updateEntry(id, o) {
  await sb.from("finance_entries").update(o).eq("id", id);
}
async function deleteEntry(id) {
  await sb.from("finance_entries").delete().eq("id", id);
}

// ---- Onboarding Startstand ----
function renderOnboard(startBalance) {
  const el = document.getElementById("finance-onboard");
  if (startBalance != null) { el.innerHTML = ""; return; }
  el.innerHTML =
    `<div class="fin-onboard"><div class="fin-onboard-txt">Noch kein Startstand gesetzt. Trag deinen aktuellen Kontostand ein – ab da rechnet alles automatisch.</div>` +
    `<div class="fin-row"><input id="fin-start" type="number" step="0.01" placeholder="z. B. 2000" /><button class="btn" id="fin-start-save">Startstand setzen</button></div></div>`;
  document.getElementById("fin-start-save").addEventListener("click", async () => {
    const v = parseFloat(document.getElementById("fin-start").value);
    if (isNaN(v)) return;
    await setStartBalance(v);
    renderFinance();
  });
}

// ---- Erfassungs-Formular ----
let finEditId = null;
function renderForm() {
  const cats = EXPENSE_CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join("");
  const el = document.getElementById("finance-form");
  el.innerHTML =
    `<div class="fin-form">` +
    `<div class="fin-kind"><button class="fin-k active" data-kind="expense">Ausgabe</button><button class="fin-k" data-kind="income">Einnahme</button></div>` +
    `<div class="fin-row"><input id="fin-amount" type="number" step="0.01" placeholder="Betrag" /><input id="fin-date" type="date" value="${todayIso()}" /></div>` +
    `<div class="fin-row"><select id="fin-cat">${cats}</select><input id="fin-note" type="text" placeholder="Notiz (optional)" /></div>` +
    `<button class="btn" id="fin-save">Buchen</button><span class="saved-hint" id="fin-hint"></span>` +
    (finEditId ? `<button class="linklike" id="fin-cancel">Abbrechen</button>` : "") +
    `</div>`;

  let kind = "expense";
  const catSel = document.getElementById("fin-cat");
  const setKind = (k) => {
    kind = k;
    el.querySelectorAll(".fin-k").forEach((b) => b.classList.toggle("active", b.dataset.kind === k));
    catSel.style.display = k === "income" ? "none" : "";
  };
  el.querySelectorAll(".fin-k").forEach((b) => b.addEventListener("click", () => setKind(b.dataset.kind)));

  document.getElementById("fin-save").addEventListener("click", async () => {
    const amount = parseFloat(document.getElementById("fin-amount").value);
    const date = document.getElementById("fin-date").value;
    if (isNaN(amount) || amount < 0 || !date) { flashHint("Betrag & Datum prüfen", true); return; }
    const row = {
      date, kind, amount,
      category: kind === "income" ? FIN_INCOME_CAT : catSel.value,
      note: document.getElementById("fin-note").value || null,
    };
    if (finEditId) { await updateEntry(finEditId, row); finEditId = null; }
    else { await addEntry(row); }
    renderFinance();
  });
  if (finEditId) document.getElementById("fin-cancel").addEventListener("click", () => { finEditId = null; renderFinance(); });
}
function flashHint(msg, err) {
  const h = document.getElementById("fin-hint");
  if (!h) return;
  h.style.color = err ? "var(--red)" : "var(--green)";
  h.textContent = msg;
  setTimeout(() => (h.textContent = ""), 2500);
}

// ---- Buchungs-Liste ----
function renderList(entries) {
  const el = document.getElementById("finance-list");
  if (!entries.length) { el.innerHTML = `<div class="muted-line">Noch keine Buchungen.</div>`; return; }
  el.innerHTML = entries.slice(0, 40).map((e) => {
    const sign = e.kind === "income" ? "+" : "−";
    const col = e.kind === "income" ? "var(--green)" : "var(--text)";
    const note = e.note ? ` · ${e.note.replace(/</g, "&lt;")}` : "";
    return `<div class="fin-item" data-id="${e.id}">` +
      `<span class="fin-date">${e.date.slice(8, 10)}.${e.date.slice(5, 7)}</span>` +
      `<span class="fin-cat-lbl">${e.category}${note}</span>` +
      `<span class="fin-amt" style="color:${col}">${sign}${eur(e.amount)}</span>` +
      `<button class="fin-edit" title="Bearbeiten">✎</button>` +
      `<button class="fin-del" title="Löschen">✕</button></div>`;
  }).join("");
  el.querySelectorAll(".fin-del").forEach((b) => b.addEventListener("click", async (ev) => {
    const id = ev.target.closest(".fin-item").dataset.id;
    if (!confirm("Diese Buchung löschen?")) return;
    await deleteEntry(id);
    renderFinance();
  }));
  el.querySelectorAll(".fin-edit").forEach((b) => b.addEventListener("click", (ev) => {
    const id = Number(ev.target.closest(".fin-item").dataset.id);
    const e = entries.find((x) => x.id === id);
    if (!e) return;
    finEditId = id;
    renderForm();
    document.getElementById("fin-amount").value = e.amount;
    document.getElementById("fin-date").value = e.date;
    document.getElementById("fin-note").value = e.note || "";
    el.querySelectorAll(".fin-k").forEach(() => {});
    document.querySelector(`.fin-k[data-kind="${e.kind}"]`).click();
    if (e.kind === "expense") document.getElementById("fin-cat").value = e.category;
    document.getElementById("finance-form").scrollIntoView({ behavior: "smooth" });
  }));
}

// ---- Header: Kontostand ----
function renderBalanceHead(startBalance, entries) {
  let head = document.getElementById("fin-balance");
  if (!head) {
    head = document.createElement("div");
    head.id = "fin-balance";
    document.getElementById("finance-onboard").insertAdjacentElement("afterend", head);
  }
  if (startBalance == null) { head.innerHTML = ""; return; }
  const bal = computeBalance(startBalance, entries);
  head.innerHTML = `<div class="fin-bal-cap">Kontostand</div><div class="fin-bal serif">${eur(bal)}</div>` +
    `<button class="linklike" id="fin-edit-start">Stand korrigieren</button>`;
  document.getElementById("fin-edit-start").addEventListener("click", async () => {
    const v = prompt("Neuen Startstand setzen (überschreibt den bisherigen Startwert):", String(startBalance));
    if (v == null) return;
    const n = parseFloat(v);
    if (isNaN(n)) return;
    await setStartBalance(n);
    renderFinance();
  });
}

// ---- Haupt-Render ----
async function renderFinance() {
  const [startBalance, entries] = await Promise.all([getStartBalance(), loadFinance()]);
  renderOnboard(startBalance);
  renderBalanceHead(startBalance, entries);
  renderForm();
  renderBudget(entries);   // in Task 6 definiert
  renderCharts(startBalance, entries); // in Task 6 definiert
  renderList(entries);
}
window.renderFinance = renderFinance;

// Platzhalter bis Task 6 (verhindert ReferenceError beim ersten Lauf)
if (typeof renderBudget === "undefined") { var renderBudget = function () {}; }
if (typeof renderCharts === "undefined") { var renderCharts = function () {}; }
```

- [ ] **Step 2: Finanz-Styles ergänzen**

Hänge ans Ende von `assets/styles.css` an:

```css
/* ---- Finanzen ---- */
#fin-balance { text-align:center; margin:10px 0 4px; }
.fin-bal-cap { color:var(--muted); letter-spacing:.25em; text-transform:uppercase; font-size:10px; }
.fin-bal { font-size:40px; line-height:1.1; color:var(--text); }
.fin-onboard { background:var(--panel-2); border:1px solid var(--line); border-radius:10px; padding:14px; margin-bottom:8px; }
.fin-onboard-txt { color:var(--muted); font-size:13px; margin-bottom:8px; }
.fin-form { background:var(--panel-2); border:1px solid var(--line); border-radius:10px; padding:12px; }
.fin-row { display:flex; gap:8px; margin-bottom:8px; }
.fin-row input, .fin-row select { flex:1; min-width:0; }
.fin-kind { display:flex; gap:6px; margin-bottom:10px; }
.fin-k { flex:1; padding:8px; border:1px solid var(--line); background:transparent; color:var(--muted); border-radius:8px; cursor:pointer; font:inherit; }
.fin-k.active { border-color:var(--gold); color:var(--gold); }
.fin-item { display:flex; align-items:center; gap:8px; padding:9px 2px; border-bottom:1px solid var(--line); font-size:14px; }
.fin-date { color:var(--muted); width:42px; flex:none; font-variant-numeric:tabular-nums; }
.fin-cat-lbl { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.fin-amt { font-variant-numeric:tabular-nums; flex:none; }
.fin-edit, .fin-del { background:none; border:none; color:var(--muted); cursor:pointer; font-size:14px; padding:2px 4px; flex:none; }
.fin-del:hover { color:var(--red); }
.fin-edit:hover { color:var(--gold); }
.muted-line { color:var(--muted); font-size:13px; padding:8px 0; }
```

- [ ] **Step 3: Manuell verifizieren (Erfassen/Bearbeiten/Löschen)**

Server starten (siehe Task 4 Step 6), einloggen, Finanzen-Tab.
Expected:
1. Beim ersten Mal erscheint die Startstand-Box → z. B. `2000` setzen → Kontostand zeigt `2.000,00 €`.
2. Ausgabe `50`, Kategorie `Konsum`, buchen → erscheint in Liste, Kontostand `1.950,00 €`.
3. Einnahme `100` buchen (Kategorie-Feld ausgeblendet) → Kontostand `2.050,00 €`.
4. Buchung über ✎ bearbeiten → Werte erscheinen im Formular, ändern → Liste + Kontostand aktualisiert.
5. Buchung über ✕ (mit Bestätigung) löschen → verschwindet, Kontostand stimmt.
6. „Stand korrigieren" ändert den Startwert. Keine Konsolenfehler.

- [ ] **Step 4: Commit**

```bash
git add assets/finance.js assets/styles.css
git commit -m "feat(finanzen): Buchungen erfassen/bearbeiten/löschen + Kontostand + Startstand"
```

---

### Task 6: Finanzen — Budget-Balken + Diagramme

**Files:**
- Modify: `assets/finance.js` (Platzhalter `renderBudget`/`renderCharts` durch echte Funktionen ersetzen)
- Modify: `assets/styles.css` (Budget-/Chart-Styles)

**Interfaces:**
- Consumes: `monthBudget`, `balanceSeries`, `monthlyExpenseTotals`, `monthlyIncomeTotals` (finance-calc); `svgLineChart`, `svgBarChart` (charts); `eur` (finance.js).
- Produces: `renderBudget(entries)`, `renderCharts(startBalance, entries)` — füllen `#finance-budget` bzw. `#finance-charts`.

- [ ] **Step 1: Platzhalter-Zeilen entfernen**

In `assets/finance.js`, lösche die zwei Platzhalter-Zeilen am Dateiende:

```js
// Platzhalter bis Task 6 (verhindert ReferenceError beim ersten Lauf)
if (typeof renderBudget === "undefined") { var renderBudget = function () {}; }
if (typeof renderCharts === "undefined") { var renderCharts = function () {}; }
```

- [ ] **Step 2: Budget- und Chart-Funktionen anhängen**

Hänge ans Ende von `assets/finance.js` an:

```js
// ---- Budget-Balken (Verbote 4 + 5) ----
const LIMIT_KONSUM = 80, LIMIT_GESAMT = 400;
function budgetColor(spent, limit) {
  const r = spent / limit;
  if (r >= 1) return "var(--red)";
  if (r >= 0.8) return "var(--gold)";
  return "var(--green)";
}
function budgetBar(label, spent, limit) {
  const pct = Math.min(spent / limit, 1) * 100;
  const col = budgetColor(spent, limit);
  const over = spent > limit ? ` <span style="color:var(--red)">über Limit</span>` : "";
  return `<div class="bud-row"><div class="bud-top"><span class="bud-lbl">${label}</span>` +
    `<span class="bud-num">${eur(spent)} / ${eur(limit)}${over}</span></div>` +
    `<div class="bud-track"><i style="width:${pct.toFixed(1)}%;background:${col}"></i></div></div>`;
}
function renderBudget(entries) {
  const now = new Date();
  const { konsum, gesamt } = monthBudget(entries, now.getFullYear(), now.getMonth() + 1);
  document.getElementById("finance-budget").innerHTML =
    budgetBar("Konsum (Verbot 5)", konsum, LIMIT_KONSUM) +
    budgetBar("Gesamtausgaben (Verbot 4)", gesamt, LIMIT_GESAMT);
}

// ---- Diagramme ----
const MON_SHORT = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];
const monLabel = (ym) => MON_SHORT[Number(ym.slice(5, 7)) - 1];
function renderCharts(startBalance, entries) {
  const el = document.getElementById("finance-charts");
  if (startBalance == null || !entries.length) { el.innerHTML = `<div class="muted-line">Sobald Buchungen da sind, erscheinen hier Verläufe.</div>`; return; }
  const bal = balanceSeries(startBalance, entries).map((p) => ({ label: p.date.slice(5, 10), value: p.balance }));
  const exp = monthlyExpenseTotals(entries).map((m) => ({ label: monLabel(m.month), value: m.total }));
  const inc = monthlyIncomeTotals(entries).map((m) => ({ label: monLabel(m.month), value: m.total }));
  el.innerHTML =
    `<div class="chart-card"><div class="chart-cap">Kontostand-Verlauf</div>${svgLineChart(bal)}</div>` +
    `<div class="chart-card"><div class="chart-cap">Ausgaben pro Monat</div>${svgBarChart(exp, { color: "var(--red)" })}</div>` +
    `<div class="chart-card"><div class="chart-cap">Einnahmen pro Monat</div>${svgBarChart(inc, { color: "var(--green)" })}</div>`;
}
```

- [ ] **Step 3: Budget-/Chart-Styles ergänzen**

Hänge ans Ende von `assets/styles.css` an:

```css
/* ---- Finanzen: Budget + Charts ---- */
.bud-row { margin-bottom:12px; }
.bud-top { display:flex; justify-content:space-between; font-size:13px; margin-bottom:5px; }
.bud-lbl { color:var(--text); }
.bud-num { color:var(--muted); font-variant-numeric:tabular-nums; }
.bud-track { height:8px; background:var(--panel-2); border-radius:5px; overflow:hidden; }
.bud-track i { display:block; height:100%; border-radius:5px; transition:width .3s; }
.chart-card { background:var(--panel-2); border:1px solid var(--line); border-radius:10px; padding:12px; margin-bottom:10px; }
.chart-cap { color:var(--muted); letter-spacing:.2em; text-transform:uppercase; font-size:10px; margin-bottom:6px; }
.chart { width:100%; height:auto; display:block; }
```

- [ ] **Step 4: Regressionstest der Rechenlogik**

Run: `cd /Users/farell.ceo/the-plan && /opt/homebrew/bin/bun test`
Expected: PASS — alle Tests aus `finance-calc.test.js` und `charts.test.js` grün (12 pass).

- [ ] **Step 5: Manuell verifizieren (Budget + Charts)**

Server starten, einloggen, Finanzen-Tab. Mit Buchungen aus Task 5:
Expected:
1. „Budget diesen Monat": zwei Balken. Konsum-Balken zeigt z. B. `50,00 € / 80,00 €` (grün, <80 %). Buche testweise Konsum bis >64 € → gold; >80 € → rot + „über Limit".
2. Gesamtausgaben-Balken summiert Konsum + Sonstiges (ohne Miete/Tanken/Investition). Buche eine `Miete` → Gesamt-Balken ändert sich NICHT.
3. „Verlauf": drei Karten — Kontostand-Linie, Ausgaben-Balken (rot), Einnahmen-Balken (grün). Werte plausibel.
4. Keine Konsolenfehler.

- [ ] **Step 6: Commit**

```bash
git add assets/finance.js assets/styles.css
git commit -m "feat(finanzen): Budget-Balken (80/400 €) + Diagramme"
```

---

## Self-Review (vom Plan-Autor durchgeführt)

**Spec-Abdeckung (Abschnitt „1. Finanzen 💰"):**
- Erfassen mit Betrag/Kategorie/Notiz/Einnahme-Ausgabe/Datum → Task 5 ✓
- Buchungen editierbar + löschbar → Task 5 ✓
- Kategorien Fix/Konsum/Sonstiges → Task 2 (Konstanten) + Task 5 (Auswahl) + Task 6 (Limit-Logik) ✓
- Kontostand automatisch + Startstand in app_settings + Onboarding + Korrektur → Task 1, 2, 5 ✓
- Diagramme (Kontostand-Linie, Ausgaben/Monat, Einnahmen/Monat) → Task 3, 6 ✓
- Budget-Logik 80 € / 400 € mit Live-Balken + Farben → Task 2, 6 ✓
- Verifikations-Checkliste pro Phase → Task-Steps „Manuell verifizieren" ✓

**Placeholder-Scan:** Keine TBD/TODO. Der temporäre Stub in Task 4 und die Platzhalter in Task 5 sind bewusst, vollständig codiert und werden in Task 6 explizit entfernt.

**Typ-Konsistenz:** `Entry`-Form (`date/kind/amount/category/note`) identisch in finance-calc, Tests, finance.js. Funktionsnamen `renderBudget`/`renderCharts` in Task 5 referenziert und in Task 6 definiert. `eur`, `monthBudget`, `balanceSeries`, `monthlyExpenseTotals`, `monthlyIncomeTotals`, `svgLineChart`, `svgBarChart` konsistent benannt.

**Out of scope (spätere Phasen, eigene Pläne):** Briefing, Körper, Trends, Ziele.
```
