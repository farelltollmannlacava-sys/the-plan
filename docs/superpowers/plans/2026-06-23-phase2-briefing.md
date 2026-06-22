# Phase 2: Briefing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Das tägliche Morgen-Briefing oben auf dem „Heute"-Tab der The-Plan-App anzeigen und die bestehende Briefing-Cloud-Routine so erweitern, dass sie das Briefing automatisch in Supabase schreibt.

**Architecture:** Zweistufig. **Stufe A (Tasks 1–3):** neue Supabase-Tabelle `briefings`, ein reiner, testbarer Markdown→HTML-Renderer (`markdown.js`), und ein Anzeige-Modul (`briefing.js`), das das heutige Briefing oben auf „Heute" rendert — voll lauffähig und mit einer manuell eingefügten Zeile testbar. **Stufe B (Task 4):** die Cloud-Routine (Skill `morning-briefing` im separaten Repo `daily-briefing`) bekommt einen Zustell-Schritt, der das fertige Briefing per REST in die `briefings`-Tabelle upsertet (Service-Key als Routine-Secret, bypasst RLS).

**Tech Stack:** HTML, Vanilla JS (klassische Scripts), Supabase JS v2 (CDN) für Lesen unter User-Session, Supabase REST für Schreiben aus der Routine, `bun test`. Kein Build, kein Framework.

## Global Constraints

- Kein Build, kein npm/node — Tests mit `/opt/homebrew/bin/bun` (`bun test`). Keine `package.json`.
- Neue Frontend-Dateien sind klassische Scripts (kein `type="module"`); Funktionen/`const` auf Top-Level. `markdown.js` endet mit `if (typeof module !== "undefined" && module.exports) { module.exports = { ... }; }` für bun-Tests (im Browser übersprungen).
- Supabase-Projekt ref `ykhuavvsfeairuwnymsr`, URL `https://ykhuavvsfeairuwnymsr.supabase.co`. RLS-Policy für neue Tabelle: `auth.jwt() ->> 'email' = 'farelltollmannlacava@gmail.com'`.
- Datumsformat `YYYY-MM-DD`, lokale Browser-Zeit ≈ Europe/Berlin (vorhandener `iso()`-Helfer in `app.js`). In der Routine: `TZ=Europe/Berlin date +%F`.
- Briefing-Markdown nutzt: `#`/`##`/`###`-Überschriften, `- `-Listen, `**fett**`, normale Absätze, Zeilen mit `|`-Trennern (Märkte). Der Renderer muss **zuerst HTML escapen, dann** sichere Tags erzeugen (kein roher `innerHTML` von Fremd-HTML).
- Zwei Repos: App-Änderungen in `/Users/farell.ceo/the-plan`; Routine-Änderung (Task 4) in `/Users/farell.ceo/daily-briefing`.
- Quelle der Wahrheit ist die DB (`briefings`-Tabelle); das GitHub-Archiv im `daily-briefing`-Repo bleibt zusätzlich bestehen.

---

### Task 1: Supabase-Tabelle `briefings`

**Files:**
- Migration: über Supabase MCP `apply_migration` (oder Dashboard → SQL Editor). Kein lokales Datei-Artefakt.

**Interfaces:**
- Produces: Tabelle `briefings(date date primary key, content text, created_at timestamptz default now())` mit RLS-Lesepolicy auf Farells Mail. (Schreiben erfolgt in Task 4 per Service-Key, der RLS umgeht.)

- [ ] **Step 1: Migration anwenden**

Über Supabase MCP `apply_migration` (name: `briefings_table`) mit diesem SQL:

```sql
create table if not exists briefings (
  date date primary key,
  content text not null,
  created_at timestamptz not null default now()
);
alter table briefings enable row level security;
create policy "owner_all" on briefings for all
  using (auth.jwt() ->> 'email' = 'farelltollmannlacava@gmail.com')
  with check (auth.jwt() ->> 'email' = 'farelltollmannlacava@gmail.com');
```

- [ ] **Step 2: Verifizieren**

Über MCP `list_tables` (schema `public`) prüfen: `briefings` erscheint, `rls_enabled: true`.
Expected: Tabelle gelistet, RLS aktiv.

- [ ] **Step 3: Commit**

Keine lokalen Dateien geändert — kein Commit.

---

### Task 2: Markdown→HTML-Renderer `markdown.js` (TDD)

**Files:**
- Create: `assets/markdown.js`
- Test: `tests/markdown.test.js`

**Interfaces:**
- Produces: `mdToHtml(md: string): string` — wandelt das Briefing-Markdown in sicheres HTML. Escapet zuerst `&`,`<`,`>`; dann: `# ` → `<h2>`, `## ` → `<h3>`, `### ` → `<h4>`; `- `/`* ` → `<ul><li>…</li></ul>` (zusammenhängende Listenzeilen gruppiert); `**fett**` → `<strong>`; Leerzeile beendet Liste/Absatz; sonstige Zeilen → `<p>`. Gibt `""` für leere Eingabe.

- [ ] **Step 1: Failing test schreiben**

Create `tests/markdown.test.js`:

```js
const { test, expect } = require("bun:test");
const { mdToHtml } = require("../assets/markdown.js");

test("Überschriften: # ## ### -> h2 h3 h4", () => {
  expect(mdToHtml("# Titel")).toBe("<h2>Titel</h2>");
  expect(mdToHtml("## Welt")).toBe("<h3>Welt</h3>");
  expect(mdToHtml("### Supplements")).toBe("<h4>Supplements</h4>");
});

test("Liste: zusammenhängende - Zeilen werden eine ul", () => {
  expect(mdToHtml("- a\n- b")).toBe("<ul><li>a</li><li>b</li></ul>");
});

test("Fett: **x** -> strong innerhalb p", () => {
  expect(mdToHtml("Heute **wichtig** ok")).toBe("<p>Heute <strong>wichtig</strong> ok</p>");
});

test("Absatz + Leerzeile beendet Liste", () => {
  expect(mdToHtml("- a\n\nText")).toBe("<ul><li>a</li></ul><p>Text</p>");
});

test("HTML wird escaped (kein XSS)", () => {
  expect(mdToHtml("<script>alert(1)</script>")).toBe("<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>");
  expect(mdToHtml("a & b")).toBe("<p>a &amp; b</p>");
});

test("Märkte-Zeile mit | bleibt als Absatz erhalten", () => {
  expect(mdToHtml("DAX 24.500 | Gold 4.100 $")).toBe("<p>DAX 24.500 | Gold 4.100 $</p>");
});

test("Leere Eingabe -> leerer String", () => {
  expect(mdToHtml("")).toBe("");
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `cd /Users/farell.ceo/the-plan && /opt/homebrew/bin/bun test tests/markdown.test.js`
Expected: FAIL — `Cannot find module '../assets/markdown.js'`.

- [ ] **Step 3: Implementierung schreiben**

Create `assets/markdown.js`:

```js
/* The Plan — minimaler, sicherer Markdown->HTML-Renderer (escaped zuerst) */
function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function inlineMd(s) {
  return escapeHtml(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}
function mdToHtml(md) {
  const lines = (md || "").split(/\r?\n/);
  let html = "";
  let inList = false;
  const closeList = () => { if (inList) { html += "</ul>"; inList = false; } };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^###\s+/.test(line)) { closeList(); html += `<h4>${inlineMd(line.replace(/^###\s+/, ""))}</h4>`; }
    else if (/^##\s+/.test(line)) { closeList(); html += `<h3>${inlineMd(line.replace(/^##\s+/, ""))}</h3>`; }
    else if (/^#\s+/.test(line)) { closeList(); html += `<h2>${inlineMd(line.replace(/^#\s+/, ""))}</h2>`; }
    else if (/^[-*]\s+/.test(line)) { if (!inList) { html += "<ul>"; inList = true; } html += `<li>${inlineMd(line.replace(/^[-*]\s+/, ""))}</li>`; }
    else if (line.trim() === "") { closeList(); }
    else { closeList(); html += `<p>${inlineMd(line)}</p>`; }
  }
  closeList();
  return html;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { mdToHtml };
}
```

- [ ] **Step 4: Test laufen lassen, Erfolg bestätigen**

Run: `cd /Users/farell.ceo/the-plan && /opt/homebrew/bin/bun test tests/markdown.test.js`
Expected: PASS — 7 pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add assets/markdown.js tests/markdown.test.js
git commit -m "feat(briefing): sicherer Markdown->HTML-Renderer + Tests"
```

---

### Task 3: Briefing-Anzeige auf „Heute" (`briefing.js` + Wiring)

**Files:**
- Create: `assets/briefing.js`
- Modify: `index.html` (Briefing-Container oben in `#view-today`, Script-Includes)
- Modify: `assets/app.js` (Aufruf von `renderBriefing()` in `renderToday`)
- Modify: `assets/styles.css` (Briefing-Styles)

**Interfaces:**
- Consumes: `mdToHtml` (aus `markdown.js`); globaler Supabase-Client `sb` und `iso()` (aus `app.js`).
- Produces: `renderBriefing()` (global, via `window.renderBriefing = renderBriefing;`), liest das heutige Briefing aus `briefings` und rendert es in `#briefing`.

- [ ] **Step 1: briefing.js schreiben**

Create `assets/briefing.js`:

```js
/* The Plan — Briefing-Anzeige (oben auf „Heute") */
async function renderBriefing() {
  const el = document.getElementById("briefing");
  if (!el) return;
  const ds = iso(new Date());
  const { data } = await sb.from("briefings").select("content").eq("date", ds).maybeSingle();
  if (!data || !data.content) {
    el.innerHTML = `<div class="briefing-empty">Heute noch kein Briefing.</div>`;
    return;
  }
  el.innerHTML = `<div class="briefing-card">${mdToHtml(data.content)}</div>`;
}
window.renderBriefing = renderBriefing;
```

- [ ] **Step 2: Briefing-Container in index.html einfügen**

In `index.html`, in `<section id="view-today" class="view">`, als **erstes** Kind direkt nach dem öffnenden Tag (vor `<div class="daytype" id="daytype"></div>`) einfügen:

```html
      <div id="briefing"></div>
```

- [ ] **Step 3: Script-Includes einfügen**

In `index.html`, vor `<script src="assets/app.js"></script>`, einfügen (Reihenfolge: markdown vor briefing):

```html
  <script src="assets/markdown.js"></script>
  <script src="assets/briefing.js"></script>
```

- [ ] **Step 4: renderBriefing in renderToday aufrufen**

In `assets/app.js`, in der Funktion `renderToday`, ersetze die erste Zeile des Funktionskörpers. Aktuell:

```js
async function renderToday() {
  const t = typeForDate(today);
```

ersetzen durch:

```js
async function renderToday() {
  renderBriefing();
  const t = typeForDate(today);
```

- [ ] **Step 5: Briefing-Styles ergänzen**

Hänge ans Ende von `assets/styles.css` an:

```css
/* ---- Briefing ---- */
#briefing { margin-bottom: 14px; }
.briefing-empty { color: var(--muted); font-size: 13px; padding: 10px 0; border-bottom: 1px solid var(--line); }
.briefing-card { background: var(--panel-2); border: 1px solid var(--line); border-radius: 10px; padding: 14px 16px; }
.briefing-card h2 { font-family: "Bodoni Moda", serif; font-size: 22px; margin: 0 0 10px; color: var(--text); }
.briefing-card h3 { font-size: 13px; letter-spacing: .12em; text-transform: uppercase; color: var(--gold); margin: 14px 0 6px; }
.briefing-card h4 { font-size: 13px; color: var(--text); margin: 10px 0 4px; }
.briefing-card p { font-size: 14px; line-height: 1.5; color: var(--text); margin: 6px 0; }
.briefing-card ul { margin: 6px 0; padding-left: 18px; }
.briefing-card li { font-size: 14px; line-height: 1.5; margin: 4px 0; }
.briefing-card strong { color: var(--text); }
```

- [ ] **Step 6: Parse-Check + statische Verifikation**

Run: `cd /Users/farell.ceo/the-plan && /opt/homebrew/bin/bun build assets/briefing.js --target=browser > /dev/null && echo "parse ok"`
Expected: `parse ok` (Exit 0; browser-only Globals wie `sb`/`document` sind kein Syntaxfehler).
Run: `grep -n 'renderBriefing' assets/app.js` → zeigt den Aufruf in renderToday.
Run: `grep -n 'id="briefing"' index.html` → Container vorhanden.
Run: `grep -n -E 'markdown\.js|briefing\.js|app\.js' index.html` → markdown.js + briefing.js stehen vor app.js (Zeilennummern zeigen Reihenfolge).

- [ ] **Step 7: Commit**

```bash
git add assets/briefing.js index.html assets/app.js assets/styles.css
git commit -m "feat(briefing): Anzeige des heutigen Briefings oben auf Heute"
```

**Hinweis für den Controller (manuelle Browser-Verifikation):** Nach diesem Task eine echte Zeile in `briefings` einfügen (z.B. Inhalt eines vorhandenen Briefings aus dem `daily-briefing`-Repo) via MCP `execute_sql`, dann „Heute" im Browser laden → Briefing erscheint formatiert; ohne Zeile → „Heute noch kein Briefing."

---

### Task 4: Stufe B — Routine schreibt Briefing nach Supabase

**Files:**
- Modify: `/Users/farell.ceo/daily-briefing/.claude/skills/morning-briefing/SKILL.md` (neuer Zustell-Schritt)
- Modify: `/Users/farell.ceo/daily-briefing/README.md` (Betriebshinweis: Service-Key-Secret)

**Interfaces:**
- Consumes: Tabelle `briefings` (Task 1). Routine-Umgebung muss die Env-Variable `SUPABASE_SERVICE_KEY` kennen (von Farell als Routine-Secret gesetzt; lokal zum Testen per `export`).
- Produces: Bei jedem Routine-Lauf wird `briefings/{date}.md` per REST-Upsert (on conflict date) in die Tabelle geschrieben.

- [ ] **Step 1: Zustell-Schritt in SKILL.md ergänzen**

In `/Users/farell.ceo/daily-briefing/.claude/skills/morning-briefing/SKILL.md`, im Abschnitt `## Zustellung`, nach Punkt „2. **Archiv**…" einen dritten Punkt einfügen:

```markdown
3. **Supabase** (Anzeige in der The-Plan-App): Das fertige Briefing in die Tabelle `briefings` upserten (überschreibt bei erneutem Lauf denselben Tag). Service-Key aus der Env-Variable `SUPABASE_SERVICE_KEY` (Routine-Secret) — niemals den Key ins Repo schreiben. Befehl (Datum Europe/Berlin):

    ```bash
    DATE=$(TZ=Europe/Berlin date +%F)
    jq -Rs --arg d "$DATE" '{date:$d, content:.}' "briefings/$DATE.md" \
    | curl -sS -X POST "https://ykhuavvsfeairuwnymsr.supabase.co/rest/v1/briefings" \
        -H "apikey: $SUPABASE_SERVICE_KEY" \
        -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
        -H "Content-Type: application/json" \
        -H "Prefer: resolution=merge-duplicates" \
        --data-binary @-
    ```

    Falls `jq` in der Umgebung fehlt, Payload mit python3 bauen:
    `python3 -c "import json,datetime; d=datetime.datetime.now().strftime('%Y-%m-%d'); print(json.dumps({'date':d,'content':open(f'briefings/{d}.md').read()}))"` und an denselben curl pipen.
    Schlägt der Supabase-Write fehl, nicht abbrechen — Kalender-Termin bleibt der Hauptzustellweg; Fehler im Abschlussbericht erwähnen.
```

- [ ] **Step 2: README-Betriebshinweis ergänzen**

In `/Users/farell.ceo/daily-briefing/README.md`, im Abschnitt `## Betrieb`, anhängen:

```markdown
- Supabase-Zustellung: Routine-Secret `SUPABASE_SERVICE_KEY` (Supabase → Project Settings → API → `service_role`-Key) muss in der Cloud-Routine gesetzt sein. Wird in `briefings` upsertet (gelesen von der The-Plan-App auf „Heute").
```

- [ ] **Step 3: Commit (im daily-briefing-Repo)**

```bash
cd /Users/farell.ceo/daily-briefing
git add .claude/skills/morning-briefing/SKILL.md README.md
git commit -m "feat: Briefing zusätzlich nach Supabase (briefings) zustellen"
git push
```

- [ ] **Step 4: Manueller End-to-End-Test (durch Farell — externe Abhängigkeit)**

Dieser Schritt braucht den echten Service-Key und kann nicht headless verifiziert werden. Farell führt aus:
1. Service-Key holen: Supabase Dashboard → Project Settings → API → `service_role` secret.
2. Lokal testen (im `daily-briefing`-Repo, ein vorhandenes Briefing nutzen):
   ```bash
   export SUPABASE_SERVICE_KEY="<service_role_key>"
   DATE=2026-06-22   # ein vorhandenes briefings/<DATE>.md
   jq -Rs --arg d "$DATE" '{date:$d, content:.}' "briefings/$DATE.md" \
   | curl -sS -X POST "https://ykhuavvsfeairuwnymsr.supabase.co/rest/v1/briefings" \
       -H "apikey: $SUPABASE_SERVICE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
       -H "Content-Type: application/json" -H "Prefer: resolution=merge-duplicates" \
       -w "\nHTTP %{http_code}\n" --data-binary @-
   ```
   Erwartet: HTTP 201 (oder 200). Zeile erscheint in der `briefings`-Tabelle.
3. Denselben Service-Key als Secret `SUPABASE_SERVICE_KEY` in der Cloud-Routine (claude.ai/code/routines) hinterlegen.
4. Am nächsten Morgen (oder per manuellem Routine-Lauf) prüfen: heutiges Briefing erscheint automatisch auf „Heute".

---

## Self-Review (vom Plan-Autor durchgeführt)

**Spec-Abdeckung (Spec-Abschnitt „2. Briefing 🌅" + Entscheidung „Routine schreibt nach Supabase"):**
- `briefings`-Tabelle → Task 1 ✓
- Sicheres Markdown→HTML (escape zuerst) → Task 2 ✓
- Anzeige des heutigen Briefings oben auf „Heute", Platzhalter wenn keins → Task 3 ✓
- Zweistufig: Anzeige eigenständig testbar (manuelle Zeile) vor Routine-Wiring → Tasks 1–3 vor Task 4 ✓
- Routine upsertet nach Supabase, Service-Key als Secret, Idempotenz (merge-duplicates), Kalender unberührt → Task 4 ✓
- Kein In-App-Archiv (YAGNI) → nicht enthalten ✓

**Placeholder-Scan:** Keine TBD/TODO. Task 4 Step 4 ist bewusst ein manueller Farell-Schritt (externer Service-Key), vollständig mit konkreten Befehlen beschrieben.

**Typ-Konsistenz:** `mdToHtml` in Task 2 definiert, in Task 3 konsumiert. `renderBriefing` in Task 3 definiert + in app.js aufgerufen. Container-ID `briefing` konsistent in index.html, briefing.js. Tabellen-/Spaltennamen (`briefings.date/content`) konsistent in Task 1/3/4.

**Out of scope (spätere Phasen, eigene Pläne):** Trends, Ziele, Körper.
```
