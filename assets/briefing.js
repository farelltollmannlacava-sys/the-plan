/* The Plan — Briefing-Anzeige (oben auf „Heute") */
async function renderBriefing() {
  const el = document.getElementById("briefing");
  if (!el) return;
  const ds = iso(new Date());
  const { data } = await sb.from("briefings").select("content").eq("date", ds).maybeSingle();
  if (!data || !data.content) {
    el.innerHTML = `<div class="briefing-empty">Heute noch kein Briefing.</div>`;
    return;
  }
  el.innerHTML = `<div class="briefing-card">${mdToHtml(data.content)}</div>`;
}
window.renderBriefing = renderBriefing;
