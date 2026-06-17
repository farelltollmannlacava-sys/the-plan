// Tagesstruktur aus "The Plan" / wochenplan.md.
// Quelle der Wahrheit: /Users/farell.ceo/Desktop/The Plan/wochenplan.md
// Bei Plan-Änderung hier nachziehen.
//
// track:true  -> abhakbarer Block (zählt fürs Review)
// track:false -> reiner Info-Block (Mahlzeit/Frei/Schlaf), nicht gewertet
// h           -> Dauer in Stunden (für KI-Wochenring & Soll/Ist)
//
// cat: ki | momentum | andere | zoxs | uni | fb | individual | routine | mahlzeit | reflektion | light | schlaf

window.PLAN_DATA = {
  weekdayToType: { 1: "t1", 2: "t2", 3: "t2", 4: "t1", 5: "t1", 6: "sa", 0: "so" },

  // Aktuelle Phase + Leitsatz für den Header-Reminder
  phase: { label: "Skillaufbau", focus: "KI 23 h / Woche", kiSoll: 23, leitsatz: "Einfach durchziehen" },

  types: {
    t1: {
      name: "Werktag mit Training",
      blocks: [
        { id: "aufstehen",  time: "07:00–07:15", label: "Aufstehen, Hygiene",        cat: "routine",    track: false, h: 0 },
        { id: "zoxs",       time: "07:15–11:15", label: "ZOXS",                       cat: "zoxs",       track: true,  h: 4 },
        { id: "essen1",     time: "11:15–11:30", label: "Pre-Workout 800 kcal",       cat: "mahlzeit",   track: false, h: 0 },
        { id: "ki1",        time: "11:30–13:30", label: "KI-Training (2 h)",          cat: "ki",         track: true,  h: 2 },
        { id: "fb",         time: "13:30–15:15", label: "Pull/Push FB",               cat: "fb",         track: true,  h: 1.75 },
        { id: "essen2",     time: "15:15–15:45", label: "Essen 600 kcal",             cat: "mahlzeit",   track: false, h: 0 },
        { id: "uni",        time: "15:45–18:45", label: "BWL Uni",                    cat: "uni",        track: true,  h: 3 },
        { id: "essen3",     time: "18:45–19:00", label: "Essen 500 kcal",             cat: "mahlzeit",   track: false, h: 0 },
        { id: "individual", time: "19:00–20:00", label: "Individual Training",        cat: "individual", track: true,  h: 1 },
        { id: "momentum",   time: "20:00–22:00", label: "Momentum / Andere (2 h)",    cat: "momentum",   track: true,  h: 2 },
        { id: "abschluss",  time: "22:00–22:30", label: "Tagesabschluss + Tagebuch",  cat: "routine",    track: true,  h: 0.5 },
        { id: "bett",       time: "22:30",       label: "Bettruhe",                   cat: "schlaf",     track: false, h: 0 },
      ],
    },
    t2: {
      name: "Werktag ohne Training",
      blocks: [
        { id: "aufstehen",  time: "07:00–07:15", label: "Aufstehen, Hygiene",        cat: "routine",    track: false, h: 0 },
        { id: "zoxs",       time: "07:15–11:15", label: "ZOXS",                       cat: "zoxs",       track: true,  h: 4 },
        { id: "ki1",        time: "11:15–13:30", label: "KI-Training (2 h 15)",       cat: "ki",         track: true,  h: 2.25 },
        { id: "essen1",     time: "13:30–14:00", label: "Essen 1.100 kcal",           cat: "mahlzeit",   track: false, h: 0 },
        { id: "momentum",   time: "14:00–15:45", label: "Momentum / Andere (1 h 45)", cat: "momentum",   track: true,  h: 1.75 },
        { id: "uni",        time: "15:45–18:45", label: "BWL Uni",                    cat: "uni",        track: true,  h: 3 },
        { id: "essen2",     time: "18:45–19:00", label: "Essen 700 kcal",             cat: "mahlzeit",   track: false, h: 0 },
        { id: "individual", time: "19:00–20:00", label: "Individual Training",        cat: "individual", track: true,  h: 1 },
        { id: "ki2",        time: "20:00–22:00", label: "KI-Training (2 h)",          cat: "ki",         track: true,  h: 2 },
        { id: "abschluss",  time: "22:00–22:30", label: "Tagesabschluss + Tagebuch",  cat: "routine",    track: true,  h: 0.5 },
        { id: "bett",       time: "22:30",       label: "Bettruhe",                   cat: "schlaf",     track: false, h: 0 },
      ],
    },
    sa: {
      name: "Samstag (Flex / Review)",
      blocks: [
        { id: "aufstehen",  time: "07:00–07:15", label: "Aufstehen",                  cat: "routine",    track: false, h: 0 },
        { id: "ki1",        time: "07:15–11:30", label: "KI-Training (4 h 15)",       cat: "ki",         track: true,  h: 4.25 },
        { id: "frei1",      time: "11:30–13:30", label: "Frei / Familie / Erholung",  cat: "light",      track: false, h: 0 },
        { id: "essen1",     time: "13:30–14:00", label: "Essen 1.100 kcal",           cat: "mahlzeit",   track: false, h: 0 },
        { id: "momentum",   time: "14:00–16:30", label: "Momentum (2 h 30)",          cat: "momentum",   track: true,  h: 2.5 },
        { id: "frei2",      time: "16:30–18:45", label: "Frei / Familie / Erholung",  cat: "light",      track: false, h: 0 },
        { id: "essen2",     time: "18:45–19:00", label: "Essen 700 kcal",             cat: "mahlzeit",   track: false, h: 0 },
        { id: "individual", time: "19:00–20:00", label: "Individual Training",        cat: "individual", track: true,  h: 1 },
        { id: "review",     time: "20:00–21:30", label: "Wochen-Review (Bilanz)",     cat: "reflektion", track: true,  h: 1.5 },
        { id: "frei3",      time: "21:30–22:30", label: "Frei / Lesen / Reflektion",  cat: "light",      track: false, h: 0 },
        { id: "bett",       time: "22:30",       label: "Bettruhe",                   cat: "schlaf",     track: false, h: 0 },
      ],
    },
    so: {
      name: "Sonntag (Push)",
      blocks: [
        { id: "aufstehen",  time: "07:00–07:15", label: "Aufstehen",                  cat: "routine",    track: false, h: 0 },
        { id: "ki1",        time: "07:15–11:15", label: "KI-Training (4 h)",          cat: "ki",         track: true,  h: 4 },
        { id: "essen1",     time: "11:15–11:30", label: "Pre-Workout 800 kcal",       cat: "mahlzeit",   track: false, h: 0 },
        { id: "momentum",   time: "11:30–13:30", label: "Momentum (2 h)",             cat: "momentum",   track: true,  h: 2 },
        { id: "fb",         time: "13:30–15:15", label: "Push FB",                    cat: "fb",         track: true,  h: 1.75 },
        { id: "essen2",     time: "15:15–15:45", label: "Essen 600 kcal",             cat: "mahlzeit",   track: false, h: 0 },
        { id: "kimix",      time: "15:45–18:45", label: "KI-Training / Momentum (3 h)", cat: "ki",       track: true,  h: 3 },
        { id: "essen3",     time: "18:45–19:00", label: "Essen 500 kcal",             cat: "mahlzeit",   track: false, h: 0 },
        { id: "individual", time: "19:00–20:00", label: "Individual Training",        cat: "individual", track: true,  h: 1 },
        { id: "ki2",        time: "20:00–21:30", label: "KI-Training / Momentum (1 h 30)", cat: "ki",    track: true,  h: 1.5 },
        { id: "vorbereitung", time: "21:30–22:30", label: "Wochen-Vorbereitung + Tagebuch", cat: "reflektion", track: true, h: 1 },
        { id: "bett",       time: "22:30",       label: "Bettruhe",                   cat: "schlaf",     track: false, h: 0 },
      ],
    },
  },

  catLabels: {
    ki: "KI-Training", momentum: "Momentum", andere: "Andere", zoxs: "ZOXS",
    uni: "BWL Uni", fb: "FB Training", individual: "Individual", routine: "Routine",
    reflektion: "Reflektion",
  },

  // Verbote-Texte kommen aus der DB (Tabelle meta_verbote), hinter dem Login.

  // Tägliche Reflexion (Tagesabschluss)
  dayRating: { label: "Wie war dein Tag?", max: 5 },
  dayNote: { label: "Tagebuch — was lief, was nimmst du mit?" },

  // Wochen-Reflexion (Sonntag)
  reflectionQuestions: [
    { key: "q1_fortschritt",  label: "Größter Fortschritt diese Woche?" },
    { key: "q2_nachgelassen", label: "Wo hast du nachgelassen?" },
    { key: "q3_fokus",        label: "Fokus für nächste Woche?" },
  ],
};
