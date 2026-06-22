/* The Plan — handgemalte SVG-Diagramme (Gold/Schwarz), keine Tooltips */
const _W = 320;
function _empty(h) {
  return `<svg viewBox="0 0 ${_W} ${h}" class="chart"><text x="${_W / 2}" y="${h / 2}" text-anchor="middle" fill="var(--muted)" font-size="12">Noch keine Daten</text></svg>`;
}

function svgBarChart(data, opts) {
  const h = (opts && opts.height) || 160;
  const color = (opts && opts.color) || "var(--gold)";
  if (!data || !data.length) return _empty(h);
  const padB = 22, padT = 10, max = Math.max(...data.map((d) => d.value), 1);
  const gap = 8, bw = (_W - (data.length + 1) * gap) / data.length;
  const usableH = h - padB - padT;
  let bars = "";
  data.forEach((d, i) => {
    const bh = (d.value / max) * usableH;
    const x = gap + i * (bw + gap), y = padT + (usableH - bh);
    bars +=
      `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="2" fill="${color}"/>` +
      `<text x="${(x + bw / 2).toFixed(1)}" y="${h - 8}" text-anchor="middle" fill="var(--muted)" font-size="9">${d.label}</text>`;
  });
  return `<svg viewBox="0 0 ${_W} ${h}" class="chart">${bars}</svg>`;
}

function svgLineChart(data, opts) {
  const h = (opts && opts.height) || 160;
  const color = (opts && opts.color) || "var(--gold)";
  if (!data || !data.length) return _empty(h);
  const padB = 22, padT = 10, padX = 8;
  const usableH = h - padB - padT, usableW = _W - padX * 2;
  const vals = data.map((d) => d.value);
  const max = Math.max(...vals), min = Math.min(...vals, 0);
  const span = max - min || 1;
  const n = data.length;
  const xFor = (i) => padX + (n === 1 ? usableW / 2 : (i / (n - 1)) * usableW);
  const yFor = (v) => padT + (usableH - ((v - min) / span) * usableH);
  const pts = data.map((d, i) => `${xFor(i).toFixed(1)},${yFor(d.value).toFixed(1)}`).join(" ");
  const dots = data.map((d, i) => `<circle cx="${xFor(i).toFixed(1)}" cy="${yFor(d.value).toFixed(1)}" r="2.5" fill="${color}"/>`).join("");
  const firstLbl = `<text x="${padX}" y="${h - 8}" fill="var(--muted)" font-size="9">${data[0].label}</text>`;
  const lastLbl = n > 1 ? `<text x="${_W - padX}" y="${h - 8}" text-anchor="end" fill="var(--muted)" font-size="9">${data[n - 1].label}</text>` : "";
  return `<svg viewBox="0 0 ${_W} ${h}" class="chart"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>${dots}${firstLbl}${lastLbl}</svg>`;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { svgBarChart, svgLineChart };
}
