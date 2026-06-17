/* The Plan — Cockpit-Logik */
const { SUPABASE_URL, SUPABASE_KEY } = window.PLAN_CONFIG;
const P = window.PLAN_DATA;
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let VERBOTE = []; // wird nach Login aus der DB geladen

const WD = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const WD_SHORT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

// ---- Datum-Helfer (lokal, Europe/Berlin-nah über Browser-Zeit) ----
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function mondayOf(d) {
  const x = new Date(d);
  const wd = (x.getDay() + 6) % 7; // Mo=0
  x.setDate(x.getDate() - wd);
  return x;
}
const typeForDate = (d) => P.types[P.weekdayToType[d.getDay()]];

// ---- Login-Gate (Supabase-Auth) ----
let signupMode = false;
async function initGate() {
  const form = document.getElementById("login-form");
  const err = document.getElementById("login-err");
  const btn = document.getElementById("login-btn");
  const toggle = document.getElementById("toggle-signup");

  // Schon eingeloggt? (Session aus dem Browser)
  const { data: { session } } = await sb.auth.getSession();
  if (session) return unlock();

  toggle.addEventListener("click", () => {
    signupMode = !signupMode;
    btn.textContent = signupMode ? "Konto anlegen" : "Einloggen";
    toggle.textContent = signupMode ? "Schon ein Konto? Einloggen" : "Erstes Mal? Konto anlegen";
    err.textContent = "";
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    err.textContent = "";
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    if (!email || !password) { err.textContent = "Mail und Passwort eingeben"; return; }
    btn.disabled = true;
    const fn = signupMode ? sb.auth.signUp : sb.auth.signInWithPassword;
    const { error } = await fn.call(sb.auth, { email, password });
    btn.disabled = false;
    if (error) { err.textContent = error.message; return; }
    if (signupMode) { err.style.color = "var(--green)"; err.textContent = "Konto angelegt. Falls eine Bestätigungsmail kommt, kurz bestätigen – dann einloggen."; signupMode = false; btn.textContent = "Einloggen"; toggle.textContent = "Erstes Mal? Konto anlegen"; return; }
    unlock();
  });
}
function unlock() { document.getElementById("gate").classList.add("hidden"); start(); }

// ---- Daten laden ----
async function getChecks(dateStr) {
  const { data } = await sb.from("day_checks").select("block_id,done").eq("date", dateStr);
  const map = {};
  (data || []).forEach((r) => { map[r.block_id] = r.done; });
  return map;
}
async function setCheck(dateStr, blockId, done) {
  await sb.from("day_checks").upsert({ date: dateStr, block_id: blockId, done, updated_at: new Date().toISOString() }, { onConflict: "date,block_id" });
}

// Erfüllungsgrad eines Tages (0..1) aus den trackbaren Blöcken
function pctForDate(d, checks) {
  const t = typeForDate(d);
  const tracked = t.blocks.filter((b) => b.track);
  if (!tracked.length) return 0;
  const done = tracked.filter((b) => checks[b.id]).length;
  return done / tracked.length;
}
// Farbe nach Erfüllungsgrad
function pctColor(p) {
  if (p >= 0.8) return "var(--green)";
  if (p >= 0.4) return "var(--gold)";
  if (p > 0) return "var(--red)";
  return "var(--line)";
}

// ---- Header-Reminder ----
function renderReminder() {
  const ph = P.phase;
  document.getElementById("reminder").innerHTML =
    `<span class="chip">Phase: <b>${ph.label}</b></span>` +
    `<span class="chip">${ph.focus}</span>` +
    `<span class="chip leit">„${ph.leitsatz}"</span>`;
}

// ---- Tägliche Reflexion (Tagesabschluss) ----
async function renderDayReflexion(dateStr) {
  const { data } = await sb.from("day_reflections").select("*").eq("date", dateStr).maybeSingle();
  let rating = (data && data.rating) || 0;
  const wrap = document.getElementById("dayreflexion");
  wrap.innerHTML =
    `<div class="rating" id="rating"></div>` +
    `<div class="field"><label>${P.dayNote.label}</label><textarea id="day-note">${(data && data.note) || ""}</textarea></div>` +
    `<button class="btn" id="day-save">Tagesabschluss speichern</button><div class="saved-hint" id="day-hint"></div>`;
  const rEl = document.getElementById("rating");
  const drawStars = () => {
    rEl.innerHTML = "";
    for (let i = 1; i <= P.dayRating.max; i++) {
      const s = document.createElement("span");
      s.className = "star" + (i <= rating ? " on" : "");
      s.textContent = "★";
      s.addEventListener("click", () => { rating = i; drawStars(); });
      rEl.appendChild(s);
    }
  };
  drawStars();
  document.getElementById("day-save").addEventListener("click", async () => {
    await sb.from("day_reflections").upsert(
      { date: dateStr, rating: rating || null, note: document.getElementById("day-note").value, updated_at: new Date().toISOString() },
      { onConflict: "date" }
    );
    const h = document.getElementById("day-hint"); h.textContent = "Gespeichert ✓"; setTimeout(() => (h.textContent = ""), 2500);
  });
}

// ---- HEUTE ----
let today = new Date();
async function renderToday() {
  const t = typeForDate(today);
  document.getElementById("daytype").textContent = `${WD[today.getDay()]} · ${t.name}`;
  const checks = await getChecks(iso(today));
  const wrap = document.getElementById("blocks");
  wrap.innerHTML = "";
  t.blocks.forEach((b) => {
    const done = !!checks[b.id];
    const el = document.createElement("div");
    el.className = "block" + (b.track ? "" : " untracked") + (done && b.track ? " done" : "");
    el.innerHTML = `<span class="time">${b.time}</span><span class="label">${b.label}</span>` +
      (b.track ? `<span class="check">✓</span>` : `<span class="cat-dot"></span>`);
    if (b.track) {
      el.addEventListener("click", async () => {
        const now = !el.classList.contains("done");
        el.classList.toggle("done", now);
        await setCheck(iso(today), b.id, now);
      });
    }
    wrap.appendChild(el);
  });
  renderDayReflexion(iso(today));
}

// ---- WOCHE ----
async function renderWeek() {
  const mon = mondayOf(new Date());
  const days = [...Array(7)].map((_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return d; });
  // alle Checks der Woche holen
  const { data } = await sb.from("day_checks").select("date,block_id,done").gte("date", iso(days[0])).lte("date", iso(days[6]));
  const byDate = {};
  (data || []).forEach((r) => { (byDate[r.date] = byDate[r.date] || {})[r.block_id] = r.done; });

  renderRings(days, byDate);

  // Tages-Grid (% erledigter trackbarer Blöcke)
  const grid = document.getElementById("weekgrid");
  grid.innerHTML = "";
  const todayStr = iso(new Date());
  days.forEach((d) => {
    const t = typeForDate(d);
    const tracked = t.blocks.filter((b) => b.track);
    const checks = byDate[iso(d)] || {};
    const done = tracked.filter((b) => checks[b.id]).length;
    const pct = tracked.length ? Math.round((done / tracked.length) * 100) : 0;
    const cell = document.createElement("div");
    cell.className = "d" + (iso(d) === todayStr ? " today" : "");
    cell.innerHTML = `<div class="wd">${WD_SHORT[d.getDay()]}</div><div class="pct serif">${pct}<span style="font-size:12px">%</span></div>`;
    grid.appendChild(cell);
  });

  // Kategorie-Soll/Ist (Block-Zähler)
  const soll = {}, ist = {};
  days.forEach((d) => {
    const t = typeForDate(d);
    const checks = byDate[iso(d)] || {};
    t.blocks.filter((b) => b.track && P.catLabels[b.cat]).forEach((b) => {
      soll[b.cat] = (soll[b.cat] || 0) + 1;
      if (checks[b.id]) ist[b.cat] = (ist[b.cat] || 0) + 1;
    });
  });
  const catWrap = document.getElementById("catrows");
  catWrap.innerHTML = "";
  Object.keys(P.catLabels).filter((c) => soll[c]).forEach((c) => {
    const s = soll[c], i = ist[c] || 0, pct = Math.round((i / s) * 100);
    const row = document.createElement("div");
    row.className = "cat-row";
    row.innerHTML = `<span class="name">${P.catLabels[c]}</span><span class="bar"><i style="width:${pct}%"></i></span><span class="num">${i}/${s}</span>`;
    catWrap.appendChild(row);
  });
}

// ---- RINGE (KI-Soll) + STREAK ----
function ringSvg(pct, centerText, sub) {
  const r = 34, c = 2 * Math.PI * r, off = c * (1 - Math.min(pct, 1));
  return `<div class="ring"><svg width="86" height="86" viewBox="0 0 86 86">
      <circle cx="43" cy="43" r="${r}" fill="none" stroke="var(--panel-2)" stroke-width="8"/>
      <circle cx="43" cy="43" r="${r}" fill="none" stroke="url(#g)" stroke-width="8" stroke-linecap="round"
        stroke-dasharray="${c}" stroke-dashoffset="${off}" transform="rotate(-90 43 43)"/>
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="var(--gold)"/><stop offset="1" stop-color="var(--gold-soft)"/>
      </linearGradient></defs>
      <text x="43" y="40" text-anchor="middle" class="ring-val" fill="var(--text)" font-size="18" font-family="Bodoni Moda,serif">${centerText}</text>
      <text x="43" y="56" text-anchor="middle" fill="var(--muted)" font-size="10">${sub}</text>
    </svg></div>`;
}
async function renderRings(days, byDate) {
  // KI-Stunden dieser Woche
  let kiDone = 0;
  days.forEach((d) => {
    const checks = byDate[iso(d)] || {};
    typeForDate(d).blocks.filter((b) => b.track && b.cat === "ki").forEach((b) => { if (checks[b.id]) kiDone += b.h || 0; });
  });
  const soll = P.phase.kiSoll;
  const kiPct = soll ? kiDone / soll : 0;

  // Streak: aufeinanderfolgende Tage >= 80%
  const streak = await computeStreak();

  document.getElementById("rings").innerHTML =
    `<div class="ring-card"><div class="cap">KI-Woche</div>${ringSvg(kiPct, kiDone.toFixed(1) + "h", "/ " + soll + "h")}</div>` +
    `<div class="ring-card streak-card"><div class="cap">Streak</div><div class="streak-num">${streak}</div><div class="sub">Tage ≥ 80 %</div></div>`;
}
async function computeStreak() {
  const end = new Date();
  const start = new Date(); start.setDate(start.getDate() - 60);
  const { data } = await sb.from("day_checks").select("date,block_id,done").gte("date", iso(start)).lte("date", iso(end));
  const byDate = {};
  (data || []).forEach((r) => { if (r.done) (byDate[r.date] = byDate[r.date] || {})[r.block_id] = true; });
  let streak = 0;
  const d = new Date();
  // Heute nur mitzählen, wenn schon >= 80% (Tag evtl. noch nicht vorbei)
  if (pctForDate(d, byDate[iso(d)] || {}) < 0.8) d.setDate(d.getDate() - 1);
  for (let i = 0; i < 60; i++) {
    if (pctForDate(d, byDate[iso(d)] || {}) >= 0.8) { streak++; d.setDate(d.getDate() - 1); }
    else break;
  }
  return streak;
}

// ---- KALENDER ----
let calMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let calSel = null;
const MONTHS = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
async function renderCalendar() {
  const y = calMonth.getFullYear(), m = calMonth.getMonth();
  document.getElementById("cal-title").textContent = `${MONTHS[m]} ${y}`;
  const first = new Date(y, m, 1), last = new Date(y, m + 1, 0);
  const [{ data }, { data: evs }] = await Promise.all([
    sb.from("day_checks").select("date,block_id,done").gte("date", iso(first)).lte("date", iso(last)),
    sb.from("events").select("date,type").gte("date", iso(first)).lte("date", iso(last)),
  ]);
  const byDate = {};
  (data || []).forEach((r) => { if (r.done) (byDate[r.date] = byDate[r.date] || {})[r.block_id] = true; });
  const evDays = {};
  (evs || []).forEach((e) => { evDays[e.date] = e.type; });

  const grid = document.getElementById("calgrid");
  grid.innerHTML = "";
  const lead = (first.getDay() + 6) % 7; // Mo=0
  for (let i = 0; i < lead; i++) { const e = document.createElement("div"); e.className = "cal-cell empty"; grid.appendChild(e); }
  const todayStr = iso(new Date());
  for (let day = 1; day <= last.getDate(); day++) {
    const d = new Date(y, m, day), ds = iso(d);
    const p = pctForDate(d, byDate[ds] || {});
    const cell = document.createElement("div");
    cell.className = "cal-cell" + (ds === todayStr ? " today" : "") + (ds === calSel ? " sel" : "");
    const evMark = evDays[ds] ? `<span class="ev-mark ev-${evDays[ds]}">${evDays[ds] === "birthday" ? "🎂" : evDays[ds] === "holiday" ? "★" : "●"}</span>` : "";
    cell.innerHTML = `${evMark}<span class="dnum">${day}</span><span class="dot" style="background:${pctColor(p)}"></span>`;
    cell.addEventListener("click", () => { calSel = ds; renderCalendar(); renderCalDetail(d); });
    grid.appendChild(cell);
  }
  if (calSel && calSel.startsWith(`${y}-${String(m + 1).padStart(2, "0")}`)) renderCalDetail(new Date(calSel));
  else document.getElementById("cal-detail").innerHTML = "";
}
async function renderCalDetail(d) {
  const ds = iso(d);
  const [checks, { data: refl }, { data: evs }] = await Promise.all([
    getChecks(ds),
    sb.from("day_reflections").select("*").eq("date", ds).maybeSingle(),
    sb.from("events").select("title,type,all_day,start_time").eq("date", ds).order("start_time", { nullsFirst: true }),
  ]);
  const t = typeForDate(d);
  const tracked = t.blocks.filter((b) => b.track);
  const done = tracked.filter((b) => checks[b.id]);
  const pct = tracked.length ? Math.round((done.length / tracked.length) * 100) : 0;
  let html = `<div class="cd-day">${WD[d.getDay()]}, ${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")} · ${t.name}</div>`;
  (evs || []).forEach((e) => {
    const icon = e.type === "birthday" ? "🎂" : e.type === "holiday" ? "★" : "📌";
    const when = e.all_day || !e.start_time ? "" : `<span class="ev-time">${e.start_time}</span> `;
    html += `<div class="cd-event">${icon} ${when}${e.title.replace(/</g, "&lt;")}</div>`;
  });
  html += `<div class="cd-line">Erfüllt: <b style="color:var(--text)">${done.length}/${tracked.length}</b> (${pct} %)${refl && refl.rating ? " · Tag " + refl.rating + "/5 ★" : ""}</div>`;
  if (refl && refl.note) html += `<div class="cd-note">${refl.note.replace(/</g, "&lt;")}</div>`;
  document.getElementById("cal-detail").innerHTML = html;
}

// ---- VERBOTE ----
async function renderVerbote() {
  const mon = iso(mondayOf(new Date()));
  const monthStart = (() => { const d = new Date(); return iso(new Date(d.getFullYear(), d.getMonth(), 1)); })();
  const { data } = await sb.from("verbote_log").select("verbot_nr,date").gte("date", monthStart);
  const cnt = {};
  (data || []).forEach((r) => { cnt[r.verbot_nr] = (cnt[r.verbot_nr] || 0) + 1; });
  const wrap = document.getElementById("verbote");
  wrap.innerHTML = "";
  if (!VERBOTE.length) {
    const { data: vd } = await sb.from("meta_verbote").select("nr,text").order("nr");
    VERBOTE = vd || [];
  }
  VERBOTE.forEach((v) => {
    const el = document.createElement("div");
    el.className = "verbot";
    el.innerHTML = `<span class="v-nr serif">${v.nr}</span><span class="v-text">${v.text}</span>` +
      `<span class="count">${cnt[v.nr] || 0}× Monat</span><button class="tick">+ gebrochen</button>`;
    el.querySelector(".tick").addEventListener("click", async () => {
      await sb.from("verbote_log").insert({ verbot_nr: v.nr, note: null });
      renderVerbote();
    });
    wrap.appendChild(el);
  });
}

// ---- REFLEXION ----
async function renderReflexion() {
  const ws = iso(mondayOf(new Date()));
  const { data } = await sb.from("week_reflections").select("*").eq("week_start", ws).maybeSingle();
  const wrap = document.getElementById("reflexion");
  wrap.innerHTML = "";
  P.reflectionQuestions.forEach((q) => {
    const f = document.createElement("div");
    f.className = "field";
    f.innerHTML = `<label>${q.label}</label><textarea id="rf-${q.key}">${(data && data[q.key]) || ""}</textarea>`;
    wrap.appendChild(f);
  });
  const btn = document.createElement("button");
  btn.className = "btn"; btn.textContent = "Reflexion speichern";
  const hint = document.createElement("div"); hint.className = "saved-hint";
  btn.addEventListener("click", async () => {
    const row = { week_start: ws, updated_at: new Date().toISOString() };
    P.reflectionQuestions.forEach((q) => { row[q.key] = document.getElementById("rf-" + q.key).value; });
    await sb.from("week_reflections").upsert(row, { onConflict: "week_start" });
    hint.textContent = "Gespeichert ✓"; setTimeout(() => (hint.textContent = ""), 2500);
  });
  wrap.appendChild(btn); wrap.appendChild(hint);
}

// ---- Tabs ----
function initTabs() {
  document.querySelectorAll(".tabs button").forEach((b) => {
    b.addEventListener("click", () => {
      document.querySelectorAll(".tabs button").forEach((x) => x.classList.remove("active"));
      document.querySelectorAll(".view").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      const v = document.getElementById("view-" + b.dataset.view);
      v.classList.add("active");
      ({ today: renderToday, calendar: renderCalendar, week: renderWeek, verbote: renderVerbote, reflexion: renderReflexion }[b.dataset.view])();
    });
  });
}

function start() {
  const d = new Date();
  document.getElementById("datestr").textContent = `${WD[d.getDay()]}, ${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
  renderReminder();
  initTabs();
  document.getElementById("cal-prev").addEventListener("click", () => { calMonth.setMonth(calMonth.getMonth() - 1); renderCalendar(); });
  document.getElementById("cal-next").addEventListener("click", () => { calMonth.setMonth(calMonth.getMonth() + 1); renderCalendar(); });
  renderToday();
}

initGate();
