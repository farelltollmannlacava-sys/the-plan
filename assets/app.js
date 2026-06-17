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
}

// ---- WOCHE ----
async function renderWeek() {
  const mon = mondayOf(new Date());
  const days = [...Array(7)].map((_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return d; });
  // alle Checks der Woche holen
  const { data } = await sb.from("day_checks").select("date,block_id,done").gte("date", iso(days[0])).lte("date", iso(days[6]));
  const byDate = {};
  (data || []).forEach((r) => { (byDate[r.date] = byDate[r.date] || {})[r.block_id] = r.done; });

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
      ({ today: renderToday, week: renderWeek, verbote: renderVerbote, reflexion: renderReflexion }[b.dataset.view])();
    });
  });
}

function start() {
  const d = new Date();
  document.getElementById("datestr").textContent = `${WD[d.getDay()]}, ${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
  initTabs();
  renderToday();
}

initGate();
