/* The Plan — Körper-Datenlogik (pur, ohne DOM/Supabase) */
function metricSeries(rows, key) {
  return rows
    .filter((r) => r[key] !== null && r[key] !== undefined && r[key] !== "")
    .map((r) => ({ date: r.date, value: Number(r[key]) }))
    .filter((p) => !isNaN(p.value))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { metricSeries };
}
