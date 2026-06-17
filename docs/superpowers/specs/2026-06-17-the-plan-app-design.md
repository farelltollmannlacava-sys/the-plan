# The Plan — Cockpit-Website + Wochen-Review

**Datum:** 2026-06-17
**Status:** Design abgenommen (Farell, 17.06.2026)

## Ziel

Farell soll seinen Tages-/Wochenplan nicht mehr in Markdown-Dateien pflegen, sondern auf einer Website abhaken (Handy + Laptop). Die Haken sind zugleich die harte Ist-Datenquelle für ein automatisiertes **Wochen-Review**, das samstags läuft und seine Woche gegen „The Plan" abgleicht.

## System in 3 Teilen

### 1. Website „The Plan" (statisch, GitHub Pages)
- **Repo:** `the-plan`, live unter `https://farelltollmannlacava-sys.github.io/the-plan/`
- **Heute-Ansicht:** Tagesplan des jeweiligen Wochentags, automatisch aus dem Tagestyp abgeleitet (Tagestyp 1 Mo/Do/Fr Training, Tagestyp 2 Di/Mi, Tagestyp 3 Samstag, Tagestyp 4 Sonntag). Jeder Block mit Checkbox, antippbar.
- **Wochen-Ansicht:** Mo–So Überblick mit Fortschritt je Kategorie (KI-Training, Momentum, Training, ZOXS, Uni …).
- **Verbote-Tracker:** die 8 Verbote als antippbarer Zähler (ersetzt das manuelle Führen in `verbote.md`).
- **Sonntags-Reflexion:** Formular mit 3 Fragen (Größter Fortschritt? Wo nachgelassen? Fokus nächste Woche?). Liefert die qualitative Ebene fürs Review.
- **Design:** Gold/Schwarz, editorial, Bodoni-Serif. Kein generischer App-Look.
- **Zugang:** Client-seitiger PIN-Gate. Daten sind niedrig-sensibel; bei Bedarf später auf echte Supabase-Auth upgradebar.

### 2. Supabase (Backend, Free-Tier, Frankfurt eu-central-1)
- **Projekt-Ref:** `ykhuavvsfeairuwnymsr`
- Speichert Block-Haken, Verbots-Einträge, Wochen-Reflexionen. Synchron über alle Geräte, von der Cloud-Routine lesbar.
- Statische Site spricht Supabase via JS-Client + publishable key an (kein eigener Server).

**Datenmodell:**
- `day_checks(date, block_id, done, updated_at)` — unique(date, block_id)
- `week_reflections(week_start, q1_fortschritt, q2_nachgelassen, q3_fokus, updated_at)` — unique(week_start)
- `verbote_log(date, verbot_nr, note, created_at)`

### 3. Wochen-Review (Cloud-Routine, wie das Morgen-Briefing)
- Repo `the-plan`, Skill `.claude/skills/weekly-review/SKILL.md`.
- Läuft **Samstag ~19:45** (passt zum Plan-Block „Wochen-Review" Sa 20:00–21:30).
- Liest: `day_checks` der Woche (Supabase) + Google Calendar + `week_reflections` + `plan/`-Kopien. Tagebuch optional (best effort) — nicht mehr nötig, da die Haken die Ist-Zahl liefern.
- Output: Soll/Ist je Kategorie → eingehalten/gerissen → Verbote-Status → **1 klare Empfehlung** für die kommende Woche. Lehrer-/Accountability-Ton, kein Schönreden.
- Zustellung: Google-Kalender-Termin „📊 Wochen-Review" + Archiv `reviews/JJJJ-MM-TT.md`.

## Bauphasen
- **Phase 1:** Website + Supabase + Abhaken funktioniert auf Handy + Laptop, deployed auf GitHub Pages.
- **Phase 2:** Wochen-Review-Routine, die diese Daten liest, + Cron-Scheduling.

## Bewusst NICHT im Scope (YAGNI)
- Mehrbenutzer/Accounts, Push-Notifications, native App, Bearbeiten der Plan-Struktur über die Website (Tagestypen ändern bleibt vorerst in `plan/`-Dateien).
