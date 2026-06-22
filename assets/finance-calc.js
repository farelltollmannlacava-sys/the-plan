/* The Plan — Finanz-Rechenlogik (pur, ohne DOM/Supabase) */
const EXPENSE_CATEGORIES = ["Miete", "Tanken", "Investition", "Konsum", "Sonstiges"];
const FIXED_CATEGORIES = ["Miete", "Tanken", "Investition"];

function computeBalance(startBalance, entries) {
  return entries.reduce(
    (bal, e) => bal + (e.kind === "income" ? e.amount : -e.amount),
    startBalance
  );
}

function monthBudget(entries, year, month) {
  const pre = `${year}-${String(month).padStart(2, "0")}`;
  const exp = entries.filter((e) => e.kind === "expense" && e.date.startsWith(pre));
  const konsum = exp.filter((e) => e.category === "Konsum").reduce((s, e) => s + e.amount, 0);
  const gesamt = exp.filter((e) => !FIXED_CATEGORIES.includes(e.category)).reduce((s, e) => s + e.amount, 0);
  return { konsum, gesamt };
}

function balanceSeries(startBalance, entries) {
  const sorted = [...entries].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  let bal = startBalance;
  const byDate = {};
  sorted.forEach((e) => {
    bal += e.kind === "income" ? e.amount : -e.amount;
    byDate[e.date] = bal;
  });
  return Object.keys(byDate).sort().map((d) => ({ date: d, balance: byDate[d] }));
}

function monthlyTotals(entries, kind) {
  const m = {};
  entries.filter((e) => e.kind === kind).forEach((e) => {
    const k = e.date.slice(0, 7);
    m[k] = (m[k] || 0) + e.amount;
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
