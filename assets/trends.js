/* The Plan — Trends */
function kiHoursForDate(d, checks) {
  return typeForDate(d).blocks
    .filter((b) => b.track && b.cat === "ki" && checks[b.id])
    .reduce((s, b) => s + (b.h || 0), 0);
}

async function renderTrends() {
  const end = new Date();
  const start = new Date(); start.setDate(end.getDate() - 89);
  const { data } = await sb.from("day_checks").select("date,block_id,done").gte("date", iso(start)).lte("date", iso(end));
  const byDate = {};
  (data || []).forEach((r) => { if (r.done) (byDate[r.date] = byDate[r.date] || {})[r.block_id] = true; });

  // 90 kalendarisch lückenlose Tage aufbauen (aufsteigend)
  const days = [];
  for (let i = 89; i >= 0; i--) {
    const d = new Date(end); d.setDate(end.getDate() - i);
    const ds = iso(d);
    const checks = byDate[ds] || {};
    days.push({ date: ds, pct: pctForDate(d, checks), kiHours: kiHoursForDate(d, checks) });
  }

  // Streak-Statistik
  document.getElementById("trends-stats").innerHTML =
    `<div class="tr-stats">` +
    `<div class="tr-stat"><div class="tr-num serif">${currentStreak(days)}</div><div class="tr-cap">Streak aktuell</div></div>` +
    `<div class="tr-stat"><div class="tr-num serif">${longestStreak(days)}</div><div class="tr-cap">Längste Streak</div></div>` +
    `</div>`;

  // Erfüllung 90 Tage (Linie)
  const dc = dailyCompletion(days).map((p) => ({ label: p.date.slice(5), value: p.pct }));
  document.getElementById("trends-completion").innerHTML = `<div class="chart-card">${svgLineChart(dc)}</div>`;

  // Erfüllung pro Woche (Balken)
  const wc = weeklyCompletion(days).map((w) => ({ label: w.week.slice(5), value: w.pct }));
  document.getElementById("trends-weekly").innerHTML = `<div class="chart-card">${svgBarChart(wc, { color: "var(--green)" })}</div>`;

  // KI-Stunden pro Woche (Balken)
  const wk = weeklyKiHours(days).map((w) => ({ label: w.week.slice(5), value: w.hours }));
  document.getElementById("trends-ki").innerHTML = `<div class="chart-card">${svgBarChart(wk, { color: "var(--gold)" })}</div>`;
}
window.renderTrends = renderTrends;
