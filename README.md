# The Plan — Cockpit + Wochen-Review

Persönliches Cockpit für Farell: Tages-/Wochenplan abhaken (Handy + Laptop) statt Markdown pflegen.
Die Haken sind zugleich die Ist-Datenquelle für ein automatisches **Wochen-Review** (Samstag).

## Struktur
- `index.html`, `assets/` — statische Website (GitHub Pages). Heute · Woche · Verbote · Reflexion.
- `assets/config.js` — Supabase-URL, Public-Key, PIN. **PIN hier ändern.**
- `assets/plan-data.js` — Tagesstruktur aus `plan/wochenplan.md`. Bei Plan-Änderung nachziehen.
- `plan/` — Kopien aus „The Plan" (`/Users/farell.ceo/Desktop/The Plan/`). Quelle der Wahrheit bleibt dort.
- `.claude/skills/weekly-review/` — Cloud-Routine, die das Review erstellt (Phase 2).
- `reviews/` — Archiv der Wochen-Reviews.
- `docs/superpowers/specs/` — Design-Spec.

## Backend (Supabase)
- Projekt-Ref `ykhuavvsfeairuwnymsr` (Free-Tier, eu-central-1).
- Tabellen: `day_checks`, `week_reflections`, `verbote_log`.
- RLS aktiv, anon-Zugriff erlaubt; Schutz via PIN + nicht-öffentlicher Link (niedrig-sensibel).

## Betrieb
- Live: https://farelltollmannlacava-sys.github.io/the-plan/
- Review-Routine: Samstag ~19:45 (vor dem Plan-Block „Wochen-Review" 20:00–21:30).
