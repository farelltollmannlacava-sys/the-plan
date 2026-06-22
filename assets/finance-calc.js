/* The Plan — Finanz-Rechenlogik (pur, ohne DOM/Supabase) */
const EXPENSE_CATEGORIES = ["Miete", "Tanken", "Investition", "Konsum", "Sonstiges"];
const FIXED_CATEGORIES = ["Miete", "Tanken", "Investition"];

// Supabase/PostgREST liefert numeric als String — überall defensiv in Zahl wandeln
const amt = (e) => Number(e.amount);

function computeBalance(startBalance, entries) {
  return entries.reduce(
    (bal, e) => bal + (e.kind === "income" ? amt(e) : -amt(e)),
    startBalance
  );
}

function monthBudget(entries, year, month) {
  const pre = `${year}-${String(month).padStart(2, "0")}`;
  const exp = entries.filter((e) => e.kind === "expense" && e.date.startsWith(pre));
  const konsum = exp.filter((e) => e.category === "Konsum").reduce((s, e) => s + amt(e), 0);
  const gesamt = exp.filter((e) => !FIXED_CATEGORIES.includes(e.category)).reduce((s, e) => s + amt(e), 0);
  return { konsum, gesamt };
}

function balanceSeries(startBalance, entries) {
  const sorted = [...entries].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  let bal = startBalance;
  const byDate = {};
  sorted.forEach((e) => {
    bal += e.kind === "income" ? amt(e) : -amt(e);
    byDate[e.date] = bal;
  });
  return Object.keys(byDate).sort().map((d) => ({ date: d, balance: byDate[d] }));
}

function monthlyTotals(entries, kind) {
  const m = {};
  entries.filter((e) => e.kind === kind).forEach((e) => {
    const k = e.date.slice(0, 7);
    m[k] = (m[k] || 0) + amt(e);
  });
  return Object.keys(m).sort().map((k) => ({ month: k, total: m[k] }));
}
const monthlyExpenseTotals = (entries) => monthlyTotals(entries, "expense");
const monthlyIncomeTotals = (entries) => monthlyTotals(entries, "income");

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    EXPENSE_CATEGORIES, FIXED_CATEGORIES, computeBalance,
    monthBudget, balanceSeries, monthlyExpenseTotals, monthlyIncomeTotals,
  };
}
