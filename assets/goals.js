/* The Plan — Ziele 2026 */
const gfmt = (n) => Math.round(Number(n) || 0).toLocaleString("de-DE");

async function renderGoals() {
  const el = document.getElementById("goals");
  if (!el) return;
  const [{ data: goals }, { data: fin }] = await Promise.all([
    sb.from("goals").select("*").order("sort"),
    sb.from("finance_entries").select("date,kind,amount"),
  ]);
  const best = bestMonthIncome(fin || []);

  el.innerHTML = (goals || []).map((g) => goalRow(g, best)).join("");

  el.querySelectorAll(".goal-check").forEach((b) =>
    b.addEventListener("click", async (ev) => {
      const t = ev.currentTarget;
      const now = !t.classList.contains("on");
      t.classList.toggle("on", now);
      await sb.from("goals").update({ done: now }).eq("key", t.dataset.key);
    })
  );
  el.querySelectorAll(".goal-save").forEach((b) =>
    b.addEventListener("click", async (ev) => {
      const key = ev.currentTarget.dataset.key;
      const val = parseFloat(document.getElementById("gi-" + key).value);
      if (isNaN(val)) return;
      await sb.from("goals").update({ current: val }).eq("key", key);
      renderGoals();
    })
  );
}

function goalRow(g, best) {
  const safe = g.label.replace(/</g, "&lt;");
  if (g.type === "binary") {
    return `<div class="goal-bin"><button class="goal-check${g.done ? " on" : ""}" data-key="${g.key}" aria-label="erreicht">✓</button>` +
      `<span class="goal-lbl${g.done ? " done" : ""}">${safe}</span></div>`;
  }
  const cur = g.type === "auto" ? best : Number(g.current) || 0;
  const target = Number(g.target) || 0;
  const pct = goalPct(cur, target);
  const unit = g.unit ? " " + g.unit : "";
  const reached = pct >= 100;
  const editor = g.type === "numeric"
    ? `<div class="goal-edit"><input id="gi-${g.key}" type="number" value="${Number(g.current) || 0}"><button class="btn goal-save" data-key="${g.key}">Ist speichern</button></div>`
    : `<div class="goal-edit"><span class="goal-auto">automatisch aus Einnahmen</span></div>`;
  return `<div class="goal-num">` +
    `<div class="bud-top"><span class="bud-lbl">${safe}</span>` +
    `<span class="bud-num">${gfmt(cur)} / ${gfmt(target)}${unit}</span></div>` +
    `<div class="bud-track"><i style="width:${pct}%;background:${reached ? "var(--green)" : "var(--gold)"}"></i></div>` +
    editor + `</div>`;
}
window.renderGoals = renderGoals;
