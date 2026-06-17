// Tagesstruktur aus "The Plan" / wochenplan.md.
// Quelle der Wahrheit: /Users/farell.ceo/Desktop/The Plan/wochenplan.md
// Bei Plan-Änderung hier nachziehen.
//
// track:true  -> abhakbarer Block (zählt fürs Review)
// track:false -> reiner Info-Block (Mahlzeit/Frei/Schlaf), nicht gewertet
//
// cat: Kategorie für die Wochen-Auswertung
//   ki | momentum | andere | zoxs | uni | fb | individual | routine | mahlzeit | reflektion | light | schlaf

window.PLAN_DATA = {
  // Wochentag (0=So..6=Sa) -> Tagestyp-Schlüssel
  weekdayToType: { 1: "t1", 2: "t2", 3: "t2", 4: "t1", 5: "t1", 6: "sa", 0: "so" },

  types: {
    t1: {
      name: "Werktag mit Training",
      blocks: [
        { id: "aufstehen",  time: "07:00–07:15", label: "Aufstehen, Hygiene",        cat: "routine",    track: false },
        { id: "zoxs",       time: "07:15–11:15", label: "ZOXS",                       cat: "zoxs",       track: true  },
        { id: "essen1",     time: "11:15–11:30", label: "Pre-Workout 800 kcal",       cat: "mahlzeit",   track: false },
        { id: "ki1",        time: "11:30–13:30", label: "KI-Training (2 h)",          cat: "ki",         track: true  },
        { id: "fb",         time: "13:30–15:15", label: "Pull/Push FB",               cat: "fb",         track: true  },
        { id: "essen2",     time: "15:15–15:45", label: "Essen 600 kcal",             cat: "mahlzeit",   track: false },
        { id: "uni",        time: "15:45–18:45", label: "BWL Uni",                    cat: "uni",        track: true  },
        { id: "essen3",     time: "18:45–19:00", label: "Essen 500 kcal",             cat: "mahlzeit",   track: false },
        { id: "individual", time: "19:00–20:00", label: "Individual Training",        cat: "individual", track: true  },
        { id: "momentum",   time: "20:00–22:00", label: "Momentum / Andere (2 h)",    cat: "momentum",   track: true  },
        { id: "abschluss",  time: "22:00–22:30", label: "Tagesabschluss + Tagebuch",  cat: "routine",    track: true  },
        { id: "bett",       time: "22:30",       label: "Bettruhe",                   cat: "schlaf",     track: false },
      ],
    },
    t2: {
      name: "Werktag ohne Training",
      blocks: [
        { id: "aufstehen",  time: "07:00–07:15", label: "Aufstehen, Hygiene",        cat: "routine",    track: false },
        { id: "zoxs",       time: "07:15–11:15", label: "ZOXS",                       cat: "zoxs",       track: true  },
        { id: "ki1",        time: "11:15–13:30", label: "KI-Training (2 h 15)",       cat: "ki",         track: true  },
        { id: "essen1",     time: "13:30–14:00", label: "Essen 1.100 kcal",           cat: "mahlzeit",   track: false },
        { id: "momentum",   time: "14:00–15:45", label: "Momentum / Andere (1 h 45)", cat: "momentum",   track: true  },
        { id: "uni",        time: "15:45–18:45", label: "BWL Uni",                    cat: "uni",        track: true  },
        { id: "essen2",     time: "18:45–19:00", label: "Essen 700 kcal",             cat: "mahlzeit",   track: false },
        { id: "individual", time: "19:00–20:00", label: "Individual Training",        cat: "individual", track: true  },
        { id: "ki2",        time: "20:00–22:00", label: "KI-Training (2 h)",          cat: "ki",         track: true  },
        { id: "abschluss",  time: "22:00–22:30", label: "Tagesabschluss + Tagebuch",  cat: "routine",    track: true  },
        { id: "bett",       time: "22:30",       label: "Bettruhe",                   cat: "schlaf",     track: false },
      ],
    },
    sa: {
      name: "Samstag (Flex / Review)",
      blocks: [
        { id: "aufstehen",  time: "07:00–07:15", label: "Aufstehen",                  cat: "routine",    track: false },
        { id: "ki1",        time: "07:15–11:30", label: "KI-Training (4 h 15)",       cat: "ki",         track: true  },
        { id: "frei1",      time: "11:30–13:30", label: "Frei / Familie / Erholung",  cat: "light",      track: false },
        { id: "essen1",     time: "13:30–14:00", label: "Essen 1.100 kcal",           cat: "mahlzeit",   track: false },
        { id: "momentum",   time: "14:00–16:30", label: "Momentum (2 h 30)",          cat: "momentum",   track: true  },
        { id: "frei2",      time: "16:30–18:45", label: "Frei / Familie / Erholung",  cat: "light",      track: false },
        { id: "essen2",     time: "18:45–19:00", label: "Essen 700 kcal",             cat: "mahlzeit",   track: false },
        { id: "individual", time: "19:00–20:00", label: "Individual Training",        cat: "individual", track: true  },
        { id: "review",     time: "20:00–21:30", label: "Wochen-Review (Bilanz)",     cat: "reflektion", track: true  },
        { id: "frei3",      time: "21:30–22:30", label: "Frei / Lesen / Reflektion",  cat: "light",      track: false },
        { id: "bett",       time: "22:30",       label: "Bettruhe",                   cat: "schlaf",     track: false },
      ],
    },
    so: {
      name: "Sonntag (Push)",
      blocks: [
        { id: "aufstehen",  time: "07:00–07:15", label: "Aufstehen",                  cat: "routine",    track: false },
        { id: "ki1",        time: "07:15–11:15", label: "KI-Training (4 h)",          cat: "ki",         track: true  },
        { id: "essen1",     time: "11:15–11:30", label: "Pre-Workout 800 kcal",       cat: "mahlzeit",   track: false },
        { id: "momentum",   time: "11:30–13:30", label: "Momentum (2 h)",             cat: "momentum",   track: true  },
        { id: "fb",         time: "13:30–15:15", label: "Push FB",                    cat: "fb",         track: true  },
        { id: "essen2",     time: "15:15–15:45", label: "Essen 600 kcal",             cat: "mahlzeit",   track: false },
        { id: "kimix",      time: "15:45–18:45", label: "KI-Training / Momentum (3 h)", cat: "ki",       track: true  },
        { id: "essen3",     time: "18:45–19:00", label: "Essen 500 kcal",             cat: "mahlzeit",   track: false },
        { id: "individual", time: "19:00–20:00", label: "Individual Training",        cat: "individual", track: true  },
        { id: "ki2",        time: "20:00–21:30", label: "KI-Training / Momentum (1 h 30)", cat: "ki",    track: true  },
        { id: "vorbereitung", time: "21:30–22:30", label: "Wochen-Vorbereitung + Tagebuch", cat: "reflektion", track: true },
        { id: "bett",       time: "22:30",       label: "Bettruhe",                   cat: "schlaf",     track: false },
      ],
    },
  },

  // Kategorie-Anzeige im Wochen-Überblick
  catLabels: {
    ki: "KI-Training", momentum: "Momentum", andere: "Andere", zoxs: "ZOXS",
    uni: "BWL Uni", fb: "FB Training", individual: "Individual", routine: "Routine",
    reflektion: "Reflektion",
  },

  // Verbote-Texte kommen aus der DB (Tabelle meta_verbote), hinter dem Login.

  // Sonntags-Reflexion
  reflectionQuestions: [
    { key: "q1_fortschritt",  label: "Größter Fortschritt diese Woche?" },
    { key: "q2_nachgelassen", label: "Wo hast du nachgelassen?" },
    { key: "q3_fokus",        label: "Fokus für nächste Woche?" },
  ],
};
