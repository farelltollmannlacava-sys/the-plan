/* The Plan — Ziele-Logik (pur, ohne DOM/Supabase) */
function bestMonthIncome(entries) {
  const m = {};
  entries.filter((e) => e.kind === "income").forEach((e) => {
    const k = e.date.slice(0, 7);
    m[k] = (m[k] || 0) + Number(e.amount);
  });
  const vals = Object.values(m);
  return vals.length ? Math.max(...vals) : 0;
}

function goalPct(current, target) {
  if (!target || target <= 0 || current <= 0) return 0;
  return Math.round(Math.min(current / target, 1) * 100);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { bestMonthIncome, goalPct };
}
