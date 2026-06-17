---
name: calendar-sync
description: Spiegelt Farells abweichende Google-Calendar-Termine (Einzeltermine, Geburtstage) in die Supabase-Tabelle public.events des The-Plan-Cockpits. Nutze diesen Skill, wenn der Kalender-Sync laufen soll — manuell oder als tägliche Cloud-Routine ("Kalender synchronisieren").
---

# Kalender-Sync — Google Calendar → The Plan Cockpit

Ziel: Im Cockpit-Kalender sollen **nur abweichende** Termine erscheinen (Arzttermine, Reisen, Geburtstage, einmalige Verpflichtungen) — **nicht** die wiederkehrenden Routine-Blöcke und keine System-Events.

## Voraussetzungen (im Lauf vorhanden)
- Google-Calendar-MCP (`mcp__claude_ai_Google_Calendar__list_events`, `list_calendars`)
- Supabase-MCP (`mcp__claude_ai_Supabase__execute_sql`), Projekt-Ref `ykhuavvsfeairuwnymsr`
- Tabelle `public.events(id, date, title, type, all_day, start_time, updated_at)`

## Ablauf

1. **Zeitfenster:** heute − 2 Tage bis heute + 120 Tage (Europe/Berlin).
2. **Termine holen** aus dem Hauptkalender `farelltollmannlacava@gmail.com` mit `eventType=["DEFAULT","BIRTHDAY"]`, nach `startTime` sortiert, alle Seiten via `nextPageToken`.
3. **Filtern — ein Termin ist „abweichend", wenn ALLE zutreffen:**
   - Er hat **kein** `recurringEventId` (Routine-Blöcke sind wiederkehrend) — **Ausnahme:** `eventType == "BIRTHDAY"` wird IMMER behalten.
   - Titel beginnt **nicht** mit `📰` (Briefing) oder `📊` (Wochen-Review) — das sind System-Events.
   - `transparency != "transparent"` ist KEIN Ausschlusskriterium allein, aber kombiniert mit recurring fällt es eh raus.
   - (Routine-Erkennung ist bewusst über „recurring" gelöst — alle Plan-Blöcke wie ZOXS, KI-Training, Essen, Uni, Training sind wiederkehrend.)
4. **Mappen** je behaltenem Termin:
   - `id` = Event-ID (bei Instanzen die Instanz-ID, die `list_events` liefert)
   - `date` = `start.date` (all-day) bzw. lokales Datum aus `start.dateTime`
   - `title` = `summary`
   - `type` = `birthday` wenn `eventType=="BIRTHDAY"`, sonst `personal`
   - `all_day` = true, wenn `start.date` gesetzt ist
   - `start_time` = `"HH:MM"` aus `start.dateTime`, sonst NULL
5. **Schreiben** per Supabase-`execute_sql` in einer Transaktion:
   - Erst veraltete löschen: `delete from public.events where date >= current_date and id <> all(<aktuelle id-liste>);`
   - Dann alle behaltenen `insert ... on conflict (id) do update set ...` (date/title/type/all_day/start_time/updated_at).
   - Werte sauber escapen (einfache Anführungszeichen verdoppeln).
6. **Kurzes Log** ausgeben: wie viele Termine gespiegelt, wie viele gelöscht.

## Wichtig
- Niemals die Routine-/System-Events in `events` schreiben — der Cockpit-Kalender färbt Tage ohnehin nach Plan-Erfüllung; `events` ist nur für Abweichungen.
- Feiertage/Gedenktage bewusst NICHT mitziehen (zu verrauscht). Falls später gewünscht: separater `type='holiday'` aus dem Kalender `de.german#holiday`, nur bundesweite gesetzliche Feiertage.
