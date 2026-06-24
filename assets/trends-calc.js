/* The Plan — Trends-Aggregationslogik (pur, ohne DOM/Supabase) */
function weekKey(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const wd = (dt.getUTCDay() + 6) % 7; // Mo=0
  dt.setUTCDate(dt.getUTCDate() - wd);
  return dt.toISOString().slice(0, 10);
}

function dailyCompletion(days) {
  return days.map((d) => ({ date: d.date, pct: Math.round(d.pct * 100) }));
}

function weeklyCompletion(days) {
  const w = {};
  days.forEach((d) => { (w[weekKey(d.date)] = w[weekKey(d.date)] || []).push(d.pct); });
  return Object.keys(w).sort().map((k) => ({
    week: k,
    pct: Math.round((w[k].reduce((a, b) => a + b, 0) / w[k].length) * 100),
  }));
}

function weeklyKiHours(days) {
  const w = {};
  days.forEach((d) => { w[weekKey(d.date)] = (w[weekKey(d.date)] || 0) + (d.kiHours || 0); });
  return Object.keys(w).sort().map((k) => ({ week: k, hours: Math.round(w[k] * 10) / 10 }));
}

function currentStreak(days, threshold = 0.8) {
  let arr = days.slice();
  if (arr.length && arr[arr.length - 1].pct < threshold) arr = arr.slice(0, -1);
  let s = 0;
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i].pct >= threshold) s++;
    else break;
  }
  return s;
}

function longestStreak(days, threshold = 0.8) {
  let best = 0, run = 0;
  days.forEach((d) => {
    if (d.pct >= threshold) { run++; best = Math.max(best, run); }
    else run = 0;
  });
  return best;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { weekKey, dailyCompletion, weeklyCompletion, weeklyKiHours, currentStreak, longestStreak };
}
