/* The Plan — Körper-Schnelleingabe (unten auf „Heute") */
const CAF_LIMIT = 400;
function cafColor(mg) {
  const r = mg / CAF_LIMIT;
  if (r >= 1) return "var(--red)";
  if (r >= 0.8) return "var(--gold)";
  return "var(--green)";
}
function sel15(id, val) {
  let o = `<option value="">–</option>`;
  for (let i = 1; i <= 5; i++) o += `<option value="${i}"${String(val) === String(i) ? " selected" : ""}>${i}</option>`;
  return `<select id="${id}">${o}</select>`;
}
function renderCafBar(mg) {
  const el = document.getElementById("b-caf-bar");
  if (!el) return;
  const v = Number(mg) || 0;
  const pct = Math.min(v / CAF_LIMIT, 1) * 100;
  const over = v > CAF_LIMIT ? ` <span style="color:var(--red)">über Limit</span>` : "";
  el.innerHTML =
    `<div class="bud-row"><div class="bud-top"><span class="bud-lbl">Koffein heute (Verbot 1)</span>` +
    `<span class="bud-num">${v} / ${CAF_LIMIT} mg${over}</span></div>` +
    `<div class="bud-track"><i style="width:${pct.toFixed(0)}%;background:${cafColor(v)}"></i></div></div>`;
}

async function renderBody(dateStr) {
  const el = document.getElementById("body");
  if (!el) return;
  const ds = dateStr || iso(new Date());
  const { data } = await sb.from("body_metrics").select("*").eq("date", ds).maybeSingle();
  const r = data || {};
  const v = (x) => (x === null || x === undefined ? "" : x);
  el.innerHTML =
    `<div class="body-card">` +
    `<div class="fin-row"><label class="body-f">Gewicht (kg)<input id="b-weight" type="number" step="0.1" value="${v(r.weight)}"></label>` +
    `<label class="body-f">Koffein (mg)<input id="b-caf" type="number" step="10" value="${v(r.caffeine_mg)}"></label></div>` +
    `<div class="fin-row"><label class="body-f">Schlaf (h)<input id="b-sleep" type="number" step="0.5" value="${v(r.sleep_hours)}"></label>` +
    `<label class="body-f">Schlafqualität ${sel15("b-squal", r.sleep_quality)}</label></div>` +
    `<div class="fin-row"><label class="body-f">Wasser (ml)<input id="b-water" type="number" step="100" value="${v(r.water_ml)}"></label>` +
    `<label class="body-f">Stimmung ${sel15("b-mood", r.mood)}</label>` +
    `<label class="body-f">Hunger ${sel15("b-hunger", r.hunger)}</label></div>` +
    `<div class="fin-row"><label class="body-f">Datum<input id="b-date" type="date" value="${ds}"></label></div>` +
    `<button class="btn" id="b-save">Körper speichern</button><span class="saved-hint" id="b-hint"></span>` +
    `<div id="b-caf-bar"></div>` +
    `</div>`;
  renderCafBar(r.caffeine_mg);

  document.getElementById("b-save").addEventListener("click", async () => {
    const numOrNull = (id) => { const x = parseFloat(document.getElementById(id).value); return isNaN(x) ? null : x; };
    const intOrNull = (id) => { const x = document.getElementById(id).value; return x === "" ? null : Number(x); };
    const date = document.getElementById("b-date").value;
    if (!date) return;
    const row = {
      date,
      weight: numOrNull("b-weight"),
      caffeine_mg: numOrNull("b-caf"),
      sleep_hours: numOrNull("b-sleep"),
      sleep_quality: intOrNull("b-squal"),
      water_ml: numOrNull("b-water"),
      mood: intOrNull("b-mood"),
      hunger: intOrNull("b-hunger"),
      updated_at: new Date().toISOString(),
    };
    await sb.from("body_metrics").upsert(row, { onConflict: "date" });
    await renderBody(date);
    const h = document.getElementById("b-hint");
    if (h) { h.textContent = "Gespeichert ✓"; setTimeout(() => (h.textContent = ""), 2000); }
  });
}
window.renderBody = renderBody;
