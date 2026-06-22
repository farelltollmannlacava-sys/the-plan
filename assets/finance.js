/* The Plan — Finanzen */
const FIN_INCOME_CAT = "Einnahme";
const eur = (n) => (Math.round(n * 100) / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const todayIso = () => iso(new Date());

// ---- Supabase I/O ----
async function loadFinance() {
  const { data } = await sb.from("finance_entries").select("*").order("date", { ascending: false }).order("id", { ascending: false });
  // Supabase liefert numeric/bigint als String — an der Datengrenze in Zahlen wandeln,
  // damit Rechnungen (amount) und der Edit-Abgleich (id) korrekt funktionieren.
  return (data || []).map((r) => ({ ...r, id: Number(r.id), amount: Number(r.amount) }));
}
async function getStartBalance() {
  const { data } = await sb.from("app_settings").select("value").eq("key", "start_balance").maybeSingle();
  return data && data.value != null ? Number(data.value) : null;
}
async function setStartBalance(n) {
  await sb.from("app_settings").upsert({ key: "start_balance", value: n, updated_at: new Date().toISOString() }, { onConflict: "key" });
}
async function addEntry(o) {
  await sb.from("finance_entries").insert(o);
}
async function updateEntry(id, o) {
  await sb.from("finance_entries").update(o).eq("id", id);
}
async function deleteEntry(id) {
  await sb.from("finance_entries").delete().eq("id", id);
}

// ---- Onboarding Startstand ----
function renderOnboard(startBalance) {
  const el = document.getElementById("finance-onboard");
  if (startBalance != null) { el.innerHTML = ""; return; }
  el.innerHTML =
    `<div class="fin-onboard"><div class="fin-onboard-txt">Noch kein Startstand gesetzt. Trag deinen aktuellen Kontostand ein – ab da rechnet alles automatisch.</div>` +
    `<div class="fin-row"><input id="fin-start" type="number" step="0.01" placeholder="z. B. 2000" /><button class="btn" id="fin-start-save">Startstand setzen</button></div></div>`;
  document.getElementById("fin-start-save").addEventListener("click", async () => {
    const v = parseFloat(document.getElementById("fin-start").value);
    if (isNaN(v)) return;
    await setStartBalance(v);
    renderFinance();
  });
}

// ---- Erfassungs-Formular ----
let finEditId = null;
function renderForm() {
  const cats = EXPENSE_CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join("");
  const el = document.getElementById("finance-form");
  el.innerHTML =
    `<div class="fin-form">` +
    `<div class="fin-kind"><button class="fin-k active" data-kind="expense">Ausgabe</button><button class="fin-k" data-kind="income">Einnahme</button></div>` +
    `<div class="fin-row"><input id="fin-amount" type="number" step="0.01" placeholder="Betrag" /><input id="fin-date" type="date" value="${todayIso()}" /></div>` +
    `<div class="fin-row"><select id="fin-cat">${cats}</select><input id="fin-note" type="text" placeholder="Notiz (optional)" /></div>` +
    `<button class="btn" id="fin-save">Buchen</button><span class="saved-hint" id="fin-hint"></span>` +
    (finEditId ? `<button class="linklike" id="fin-cancel">Abbrechen</button>` : "") +
    `</div>`;

  let kind = "expense";
  const catSel = document.getElementById("fin-cat");
  const setKind = (k) => {
    kind = k;
    el.querySelectorAll(".fin-k").forEach((b) => b.classList.toggle("active", b.dataset.kind === k));
    catSel.style.display = k === "income" ? "none" : "";
  };
  el.querySelectorAll(".fin-k").forEach((b) => b.addEventListener("click", () => setKind(b.dataset.kind)));

  document.getElementById("fin-save").addEventListener("click", async () => {
    const amount = parseFloat(document.getElementById("fin-amount").value);
    const date = document.getElementById("fin-date").value;
    if (isNaN(amount) || amount <= 0 || !date) { flashHint("Betrag & Datum prüfen", true); return; }
    const row = {
      date, kind, amount,
      category: kind === "income" ? FIN_INCOME_CAT : catSel.value,
      note: document.getElementById("fin-note").value || null,
    };
    if (finEditId) { await updateEntry(finEditId, row); finEditId = null; }
    else { await addEntry(row); }
    renderFinance();
  });
  if (finEditId) document.getElementById("fin-cancel").addEventListener("click", () => { finEditId = null; renderFinance(); });
}
function flashHint(msg, err) {
  const h = document.getElementById("fin-hint");
  if (!h) return;
  h.style.color = err ? "var(--red)" : "var(--green)";
  h.textContent = msg;
  setTimeout(() => (h.textContent = ""), 2500);
}

// ---- Buchungs-Liste ----
function renderList(entries) {
  const el = document.getElementById("finance-list");
  if (!entries.length) { el.innerHTML = `<div class="muted-line">Noch keine Buchungen.</div>`; return; }
  el.innerHTML = entries.slice(0, 40).map((e) => {
    const sign = e.kind === "income" ? "+" : "−";
    const col = e.kind === "income" ? "var(--green)" : "var(--text)";
    const note = e.note ? ` · ${e.note.replace(/</g, "&lt;")}` : "";
    return `<div class="fin-item" data-id="${e.id}">` +
      `<span class="fin-date">${e.date.slice(8, 10)}.${e.date.slice(5, 7)}</span>` +
      `<span class="fin-cat-lbl">${e.category}${note}</span>` +
      `<span class="fin-amt" style="color:${col}">${sign}${eur(e.amount)}</span>` +
      `<button class="fin-edit" title="Bearbeiten">✎</button>` +
      `<button class="fin-del" title="Löschen">✕</button></div>`;
  }).join("");
  el.querySelectorAll(".fin-del").forEach((b) => b.addEventListener("click", async (ev) => {
    const id = ev.target.closest(".fin-item").dataset.id;
    if (!confirm("Diese Buchung löschen?")) return;
    await deleteEntry(id);
    renderFinance();
  }));
  el.querySelectorAll(".fin-edit").forEach((b) => b.addEventListener("click", (ev) => {
    const id = Number(ev.target.closest(".fin-item").dataset.id);
    const e = entries.find((x) => x.id === id);
    if (!e) return;
    finEditId = id;
    renderForm();
    document.getElementById("fin-amount").value = e.amount;
    document.getElementById("fin-date").value = e.date;
    document.getElementById("fin-note").value = e.note || "";
    document.querySelector(`.fin-k[data-kind="${e.kind}"]`).click();
    if (e.kind === "expense") document.getElementById("fin-cat").value = e.category;
    document.getElementById("finance-form").scrollIntoView({ behavior: "smooth" });
  }));
}

// ---- Header: Kontostand ----
function renderBalanceHead(startBalance, entries) {
  let head = document.getElementById("fin-balance");
  if (!head) {
    head = document.createElement("div");
    head.id = "fin-balance";
    document.getElementById("finance-onboard").insertAdjacentElement("afterend", head);
  }
  if (startBalance == null) { head.innerHTML = ""; return; }
  const bal = computeBalance(startBalance, entries);
  head.innerHTML = `<div class="fin-bal-cap">Kontostand</div><div class="fin-bal serif">${eur(bal)}</div>` +
    `<button class="linklike" id="fin-edit-start">Stand korrigieren</button>`;
  document.getElementById("fin-edit-start").addEventListener("click", async () => {
    const v = prompt("Neuen Startstand setzen (überschreibt den bisherigen Startwert):", String(startBalance));
    if (v == null) return;
    const n = parseFloat(v);
    if (isNaN(n)) return;
    await setStartBalance(n);
    renderFinance();
  });
}

// ---- Haupt-Render ----
async function renderFinance() {
  const [startBalance, entries] = await Promise.all([getStartBalance(), loadFinance()]);
  renderOnboard(startBalance);
  renderBalanceHead(startBalance, entries);
  renderForm();
  renderBudget(entries);   // in Task 6 definiert
  renderCharts(startBalance, entries); // in Task 6 definiert
  renderList(entries);
}
window.renderFinance = renderFinance;

// ---- Budget-Balken (Verbote 4 + 5) ----
const LIMIT_KONSUM = 80, LIMIT_GESAMT = 400;
function budgetColor(spent, limit) {
  const r = spent / limit;
  if (r >= 1) return "var(--red)";
  if (r >= 0.8) return "var(--gold)";
  return "var(--green)";
}
function budgetBar(label, spent, limit) {
  const pct = Math.min(spent / limit, 1) * 100;
  const col = budgetColor(spent, limit);
  const over = spent > limit ? ` <span style="color:var(--red)">über Limit</span>` : "";
  return `<div class="bud-row"><div class="bud-top"><span class="bud-lbl">${label}</span>` +
    `<span class="bud-num">${eur(spent)} / ${eur(limit)}${over}</span></div>` +
    `<div class="bud-track"><i style="width:${pct.toFixed(1)}%;background:${col}"></i></div></div>`;
}
function renderBudget(entries) {
  const now = new Date();
  const { konsum, gesamt } = monthBudget(entries, now.getFullYear(), now.getMonth() + 1);
  document.getElementById("finance-budget").innerHTML =
    budgetBar("Konsum (Verbot 5)", konsum, LIMIT_KONSUM) +
    budgetBar("Gesamtausgaben (Verbot 4)", gesamt, LIMIT_GESAMT);
}

// ---- Diagramme ----
const MON_SHORT = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];
const monLabel = (ym) => MON_SHORT[Number(ym.slice(5, 7)) - 1];
function renderCharts(startBalance, entries) {
  const el = document.getElementById("finance-charts");
  if (startBalance == null || !entries.length) { el.innerHTML = `<div class="muted-line">Sobald Buchungen da sind, erscheinen hier Verläufe.</div>`; return; }
  const bal = balanceSeries(startBalance, entries).map((p) => ({ label: p.date.slice(5, 10), value: p.balance }));
  const exp = monthlyExpenseTotals(entries).map((m) => ({ label: monLabel(m.month), value: m.total }));
  const inc = monthlyIncomeTotals(entries).map((m) => ({ label: monLabel(m.month), value: m.total }));
  el.innerHTML =
    `<div class="chart-card"><div class="chart-cap">Kontostand-Verlauf</div>${svgLineChart(bal)}</div>` +
    `<div class="chart-card"><div class="chart-cap">Ausgaben pro Monat</div>${svgBarChart(exp, { color: "var(--red)" })}</div>` +
    `<div class="chart-card"><div class="chart-cap">Einnahmen pro Monat</div>${svgBarChart(inc, { color: "var(--green)" })}</div>`;
}
