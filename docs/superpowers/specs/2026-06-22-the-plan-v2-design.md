# The Plan v2 — Finanzen, Briefing, Trends, Ziele, Körper

**Datum:** 2026-06-22
**Status:** Design abgenommen, bereit für Implementierungsplan

## Zweck

Das bestehende „The Plan"-Cockpit (statisches Vanilla-JS auf GitHub Pages + Supabase)
um fünf Tracking-Bereiche erweitern: Finanzen, Morgen-Briefing, Langzeit-Trends,
Ziele-Fortschritt und Körper-Werte. Alles im bestehenden Gold/Schwarz-Bodoni-Stil,
ohne neue Build-Kette und ohne Chart-Framework.

## Architektur-Prinzipien (unverändert)

- Statisch, kein Build, Deploy via GitHub Pages.
- Supabase als Backend, RLS auf `farelltollmannlacava@gmail.com`.
- Diagramme handgemalt als SVG im Gold/Schwarz-Stil (wie die vorhandenen Ringe in
  der Woche-Ansicht). **Kein** externes Chart-Framework.
- `app.js` wird beim Wachstum in fokussierte Module pro Bereich aufgeteilt:
  `finance.js`, `body.js`, `goals.js`, `briefing.js` und ein gemeinsames
  `charts.js` (SVG-Linien- und Balken-Helfer). Jedes Modul kapselt das Rendern
  seiner Ansicht und seine Supabase-Zugriffe.

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
| `briefings` | `date`, `content` (text/markdown), `created_at` | `date` (pk) |
| `body_metrics` | `date`, `weight`, `caffeine_mg`, `sleep_hours`, `sleep_quality`, `water_ml`, `mood`, `hunger`, `updated_at` | `date` (pk) |
| `goals` | `key`, `label`, `type` ('binary'\|'numeric'), `target`, `current`, `unit`, `sort` | `key` (pk) |

Alle Tabellen mit RLS analog zu den bestehenden (nur Farells User).

## 1. Finanzen 💰 (Tab)

**Erfassen:** Formular — Betrag, Kategorie, Notiz, Einnahme/Ausgabe. Buchung landet
in `finance_entries`. Letzte Buchungen als Liste, einzeln löschbar.

**Kategorien (Ausgaben):** `Miete`, `Tanken`, `Investition`, `Konsum`, `Sonstiges`.
**Kategorien (Einnahmen):** `Einnahme` (frei per Notiz spezifizierbar).

**Kontostand (automatisch):** `Startstand + Σ Einnahmen − Σ Ausgaben`.
Startstand + Startdatum liegen in `app_settings` (einmalig setzbar, später korrigierbar).

**Diagramme (SVG):**
- Kontostand-Verlauf (Linie über Zeit).
- Ausgaben pro Monat nach Kategorie (Balken).
- Einnahmen pro Monat (Balken).

**Budget-Logik (an die Verbote gekoppelt):**
- **Verbot 5 — Konsum < 80 €/Monat:** Summe der Kategorie `Konsum` im laufenden Monat.
- **Verbot 4 — Gesamtausgaben < 400 €/Monat:** Summe **aller** Ausgaben außer
  `Miete`, `Tanken`, `Investition`.
- Beide als Live-Fortschrittsbalken (grün/gold/rot), ersetzen das manuelle Abhaken
  dieser zwei Geld-Verbote.

> Auflösung des Plan-Widerspruchs: `Konsum` ist eine eigene, engere Kategorie
> (Klamotten, Restaurants, Gadgets, Spaß) für die 80-€-Grenze; die 400-€-Grenze
> umfasst alle nicht-fixen Ausgaben. Damit haben beide Limits klar getrennte Bedeutung.

## 2. Briefing 🌅 (Kopf des „Heute"-Tabs)

- Die bestehende Briefing-Cloud-Routine (`morning-briefing`-Skill, Repo `daily-briefing`)
  wird erweitert: sie schreibt das fertige Briefing zusätzlich in `briefings`
  (`date` = heute, `content` = Markdown). Der Google-Kalender-Termin bleibt unberührt.
- Die App liest das **heutige** Briefing und rendert es (leichtes Markdown → HTML)
  oben auf „Heute". Kein Briefing für heute → dezenter Platzhalter.
- Kein In-App-Archiv in dieser Runde (YAGNI).

## 3. Trends 📈 (Tab)

Langzeit-Auswertung aus bereits vorhandenen + neuen Daten, alles als SVG:
- Erfüllungs-% der letzten 90 Tage (Linie).
- Streak-Historie.
- KI-Stunden pro Woche (Balken).
- Körper-Kurven: Gewicht-Verlauf, Schlaf-Verlauf.

## 4. Ziele 🎯 (Tab)

Die 2026-KPIs aus `plan/ziele.md`, gespeichert in `goals`:
- **Binäre Ziele** (z.B. „Ausziehen", „Porsche", „erstes eigenes Geld"): Häkchen.
- **Messbare Ziele** mit Fortschrittsbalken + manueller Ist-Eingabe:
  Follower ≥ 1.000, Posts ≥ 50, Mailing-Liste ≥ 500.
- **Auto-Synergie:** Ziel „1 Monat mit ≥ 5.000 € Einnahmen" wird live aus den
  `finance_entries` (Einnahmen je Kalendermonat) berechnet, kein manuelles Pflegen.

## 5. Körper 💪 (Schnelleingabe auf „Heute", Verläufe in Trends)

Tageseingabe (Upsert auf `body_metrics`, eine Zeile pro Tag):
Gewicht, Koffein (mg), Schlaf (Stunden + Qualität), Wasser, Stimmung, Hunger.

- **Koffein-Balken** gegen das 400-mg-Limit (Verbot 1) mit Warnfärbung bei Überschreitung.
- Gewicht- und Schlaf-Verläufe erscheinen im Trends-Tab.

## Bau-Reihenfolge (jede Phase einzeln deploybar)

1. **Finanzen** (Tab + Tabellen + Budget-Balken + Diagramme) — Hauptwunsch, größter Umfang.
2. **Briefing** (Tabelle + Routine-Erweiterung + Anzeige auf „Heute").
3. **Körper** (Schnelleingabe auf „Heute" + Koffein-Balken).
4. **Trends** (Tab mit allen Langzeit-Diagrammen, inkl. Körper-Kurven).
5. **Ziele** (Tab + `goals`-Tabelle + Finanz-Auto-Synergie).

## Bewusst nicht in dieser Runde (YAGNI)

- Briefing-Archiv / Blättern durch alte Briefings.
- Mehrere Konten / Bargeld-vs-Bank-Trennung (ein Kontostand).
- Vision-Countdown, Projekt-Status-Tab, Quick-Inbox (spätere Runde).
