# The Plan v2 — Finanzen, Briefing, Trends, Ziele, Körper

**Datum:** 2026-06-22
**Status:** Design abgenommen (nach kritischer Durchsicht überarbeitet), bereit für Implementierungsplan

## Zweck

Das bestehende „The Plan"-Cockpit (statisches Vanilla-JS auf GitHub Pages + Supabase)
um fünf Tracking-Bereiche erweitern: Finanzen, Morgen-Briefing, Langzeit-Trends,
Ziele-Fortschritt und Körper-Werte. Alles im bestehenden Gold/Schwarz-Bodoni-Stil,
ohne neue Build-Kette und ohne Chart-Framework.

## Architektur-Prinzipien (unverändert)

- Statisch, kein Build, Deploy via GitHub Pages.
- Supabase als Backend, RLS auf `farelltollmannlacava@gmail.com`.
- Diagramme handgemalt als SVG im Gold/Schwarz-Stil (wie die vorhandenen Ringe).
  **Kein** externes Chart-Framework. Bewusst minimal: Linien + Balken, **keine**
  Hover-Tooltips (hält den SVG-Aufwand beherrschbar).
- `app.js` wird beim Wachstum in fokussierte Module pro Bereich aufgeteilt:
  `finance.js`, `body.js`, `goals.js`, `briefing.js` und ein gemeinsames
  `charts.js` (SVG-Linien- und Balken-Helfer). Jedes Modul kapselt das Rendern
  seiner Ansicht und seine Supabase-Zugriffe.

## Quelle der Wahrheit (bewusst festgelegt)

Die **Supabase-DB ist kanonisch** für alle trackbaren Werte (Ziele-Ist-Stände,
Verbote-Zähler, Finanzen, Körper). Die `plan/*.md`-Dateien bleiben Farells
„Verfassung" — Prosa, Begründungen, Definitionen — werden aber **nicht** mehr als
Live-Daten gepflegt. Damit gibt es keine stille Drift zwischen DB und Markdown.

## Navigation

Nur **drei** echte neue Tabs — Reihenfolge der Leiste:
`Heute · Kalender · Woche · Finanzen · Trends · Ziele · Verbote · Sonntag` (8 Tabs).

- **Briefing** lebt oben auf dem „Heute"-Tab (kein eigener Tab).
- **Körper-Schnelleingabe** lebt unten auf dem „Heute"-Tab; die Körper-**Verläufe**
  erscheinen im Trends-Tab.

## Neue Supabase-Tabellen

| Tabelle | Spalten (Kern) | Schlüssel |
|---|---|---|
| `finance_entries` | `date`, `kind` ('income'\|'expense'), `amount` (numeric, positiv), `category`, `note`, `created_at` | `id` |
| `app_settings` | `key` (text), `value` (jsonb) | `key` (pk) |
| `briefings` | `date`, `content` (markdown), `created_at` | `date` (pk) |
| `body_metrics` | `date`, `weight`, `caffeine_mg`, `sleep_hours`, `sleep_quality`, `water_ml`, `mood`, `hunger`, `updated_at` | `date` (pk) |
| `goals` | `key`, `label`, `type` ('binary'\|'numeric'), `target`, `current`, `unit`, `sort` | `key` (pk) |

Alle Tabellen mit RLS analog zu den bestehenden (nur Farells User).

## 1. Finanzen 💰 (Tab)

**Erfassen:** Formular — Betrag, Kategorie, Notiz, Einnahme/Ausgabe, **Datum
(Default heute, frei wählbar zum Nachtragen)**. Buchung landet in `finance_entries`.
Letzte Buchungen als Liste, **einzeln editierbar und löschbar** (Tippfehler-Korrektur).

**Kategorien (Ausgaben):**
- **Fix** (zählt zu keinem Limit): `Miete`, `Tanken`, `Investition`
- **Konsum** (Lifestyle: Klamotten/Restaurants/Gadgets/Spaß) → zählt zum 80-€-Limit
- **Sonstiges** (Lebensmittel/Supplements/Hygiene/Abos u.a.) → zählt nur zum 400-€-Limit

**Kategorien (Einnahmen):** `Einnahme` (frei per Notiz spezifizierbar).

**Kontostand (automatisch):** `Startstand + Σ Einnahmen − Σ Ausgaben`.
- Startstand + Startdatum in `app_settings`.
- **Erststart:** Ist kein Startstand gesetzt, fragt die App ihn einmalig ab
  (Onboarding-Prompt). Jederzeit über „Stand korrigieren" anpassbar.

**Diagramme (SVG):**
- Kontostand-Verlauf (Linie über Zeit).
- Ausgaben pro Monat nach Kategorie (Balken).
- Einnahmen pro Monat (Balken).

**Budget-Logik (an die Verbote gekoppelt, Monatsgrenze nach Browser-Lokalzeit ≈ Europe/Berlin):**
- **Verbot 5 — Konsum < 80 €/Monat:** Summe der Kategorie `Konsum`.
- **Verbot 4 — Gesamtausgaben < 400 €/Monat:** Summe aller Ausgaben außer
  `Miete`/`Tanken`/`Investition` (= `Konsum` + `Sonstiges`).
- Beide als Live-Fortschrittsbalken (grün/gold/rot), ersetzen das manuelle Abhaken
  dieser zwei Geld-Verbote.

> **Bewusst akzeptierter Tradeoff:** Wird alles Nicht-Fixe als `Konsum` gebucht,
> konvergieren beide Limits — dann ist 80 € das einzige echte Limit. Saubere
> Trennung entsteht durch Disziplin beim Kategorisieren (Lifestyle → Konsum,
> Essentielles → Sonstiges). Farell hat diesen Tradeoff bewusst gewählt statt eines
> dritten Topfes.

## 2. Briefing 🌅 (Kopf des „Heute"-Tabs) — zweistufig

**Stufe A — Anzeige (früh, eigenständig testbar):**
Die App liest das **heutige** Briefing aus `briefings` und rendert es (leichtes,
**sicheres** Markdown→HTML, kein roher `innerHTML` von Fremdinhalt). Kein Briefing
für heute → dezenter Platzhalter. Testbar durch manuelles Einfügen einer Zeile in
`briefings` — unabhängig von der Routine.

**Stufe B — Routine-Wiring (letzter Schritt):**
Erst nachdem bestätigt ist, dass die Briefing-Routine überhaupt noch läuft
(letzte lokale Datei ist vom 2026-06-12, 10 Tage alt → Liveness zuerst klären:
Cloud oder lokal? läuft der Cron?), wird sie erweitert, das fertige Markdown
zusätzlich in `briefings` zu schreiben. Offene Punkte für diesen Schritt:
Run-Ort, sichere Hinterlegung des Supabase-Keys, Idempotenz (kein Doppelschreiben).
Der Google-Kalender-Termin bleibt unberührt. Kein In-App-Archiv (YAGNI).

## 3. Trends 📈 (Tab)

Langzeit-Auswertung aus vorhandenen + neuen Daten, alles als SVG:
- Erfüllungs-% der letzten 90 Tage (Linie).
- Streak-Historie.
- KI-Stunden pro Woche (Balken).
- Körper-Kurven: Gewicht-Verlauf, Schlaf-Verlauf.

## 4. Ziele 🎯 (Tab)

Die 2026-KPIs aus `plan/ziele.md`, gespeichert in `goals` (DB kanonisch):
- **Binäre Ziele** (z.B. „Ausziehen", „Porsche", „erstes eigenes Geld"): Häkchen.
- **Messbare Ziele** mit Fortschrittsbalken + manueller Ist-Eingabe:
  Follower ≥ 1.000, Posts ≥ 50, Mailing-Liste ≥ 500.
- **Auto-Synergie:** Ziel „1 Monat mit ≥ 5.000 € Einnahmen" wird live aus den
  `finance_entries` (Einnahmen je Kalendermonat) berechnet, kein manuelles Pflegen.

## 5. Körper 💪 (Schnelleingabe auf „Heute", Verläufe in Trends)

Tageseingabe (Upsert auf `body_metrics`, eine Zeile pro Tag, **Datum default heute,
Vortag nachtragbar**): Gewicht, Koffein (mg), Schlaf (Stunden + Qualität), Wasser,
Stimmung, Hunger.

- Skalen festgelegt: **Schlafqualität, Stimmung, Hunger je 1–5**; Gewicht (kg),
  Koffein (mg), Schlaf (h), Wasser (ml) numerisch.
- **Koffein-Balken** gegen das 400-mg-Limit (Verbot 1) mit Warnfärbung bei Überschreitung.
- Gewicht- und Schlaf-Verläufe erscheinen im Trends-Tab.

## Bau-Reihenfolge (jede Phase einzeln deploybar + verifizierbar)

1. **Finanzen** — Tab, Tabellen, Onboarding-Startstand, Buchungen (anlegen/editieren/löschen,
   Datum-Picker), Budget-Balken, Diagramme.
2. **Briefing-Anzeige (Stufe A)** — `briefings`-Tabelle + Anzeige auf „Heute",
   getestet mit manueller Zeile.
3. **Körper** — Schnelleingabe auf „Heute" + Koffein-Balken.
4. **Trends** — Tab mit allen Langzeit-Diagrammen, inkl. Körper-Kurven.
5. **Ziele** — Tab + `goals`-Tabelle + Finanz-Auto-Synergie.
6. **Briefing-Wiring (Stufe B)** — zuletzt, nach Routine-Liveness-Check.

## Verifikation pro Phase (Pflicht — App hat kein automatisiertes Test-Setup)

Jede Phase wird manuell gegen eine Checkliste geprüft, bevor sie als fertig gilt:
- **Finanzen:** Startstand setzen → Test-Einnahme + Test-Ausgabe je Kategorie buchen
  → Kontostand stimmt rechnerisch → 80-€- und 400-€-Balken zeigen korrekte Summen
  → Buchung editieren/löschen wirkt → Diagramme rendern mit echten Werten.
- **Briefing-Anzeige:** manuelle Zeile in `briefings` → erscheint korrekt formatiert
  auf „Heute"; ohne Zeile → Platzhalter.
- **Körper:** Werte eintragen → in `body_metrics` gespeichert → Koffein-Balken +
  Warnfärbung bei >400 mg → Vortag nachtragbar.
- **Trends:** Diagramme zeigen echte Historie über den gewählten Zeitraum.
- **Ziele:** binär abhaken persistiert; messbarer Ist-Wert speichert; 5.000-€-Ziel
  zieht den korrekten Monatswert aus den Finanzen.
- **Briefing-Wiring:** Routine läuft → schreibt heutiges Briefing in `briefings`
  → erscheint automatisch auf „Heute"; kein Doppeleintrag bei erneutem Lauf.

## Bewusst nicht in dieser Runde (YAGNI)

- Briefing-Archiv / Blättern durch alte Briefings.
- Mehrere Konten / Bargeld-vs-Bank-Trennung (ein Kontostand).
- Dritter Ausgaben-Topf (Tradeoff bewusst gewählt, s.o.).
- Hover-Tooltips in Diagrammen.
- Vision-Countdown, Projekt-Status-Tab, Quick-Inbox (spätere Runde).
- Wiederkehrende Buchungen (Miete monatlich neu eintragen — akzeptiert; ggf. spätere Runde).
