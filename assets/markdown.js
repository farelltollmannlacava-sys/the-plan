/* The Plan — minimaler, sicherer Markdown->HTML-Renderer (escaped zuerst) */
function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function inlineMd(s) {
  return escapeHtml(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}
function tableCells(line) {
  return line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
}
function isTableSeparator(line) {
  const t = line.trim();
  return /\|/.test(t) && /-/.test(t) && /^[\s|:\-]+$/.test(t);
}
function mdToHtml(md) {
  const lines = (md || "").split(/\r?\n/);
  let html = "";
  let inList = false;
  const closeList = () => { if (inList) { html += "</ul>"; inList = false; } };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd();
    // Tabelle: aktuelle Zeile enthält |, nächste Zeile ist die Trennzeile (|---|---|)
    if (line.includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      closeList();
      const head = tableCells(line);
      let body = "";
      let j = i + 2;
      for (; j < lines.length && lines[j].includes("|"); j++) {
        const c = tableCells(lines[j].trimEnd());
        body += "<tr>" + c.map((x) => `<td>${inlineMd(x)}</td>`).join("") + "</tr>";
      }
      html += "<table><thead><tr>" + head.map((x) => `<th>${inlineMd(x)}</th>`).join("") +
        "</tr></thead><tbody>" + body + "</tbody></table>";
      i = j - 1;
    }
    else if (/^###\s+/.test(line)) { closeList(); html += `<h4>${inlineMd(line.replace(/^###\s+/, ""))}</h4>`; }
    else if (/^##\s+/.test(line)) { closeList(); html += `<h3>${inlineMd(line.replace(/^##\s+/, ""))}</h3>`; }
    else if (/^#\s+/.test(line)) { closeList(); html += `<h2>${inlineMd(line.replace(/^#\s+/, ""))}</h2>`; }
    else if (/^[-*]\s+/.test(line)) { if (!inList) { html += "<ul>"; inList = true; } html += `<li>${inlineMd(line.replace(/^[-*]\s+/, ""))}</li>`; }
    else if (line.trim() === "") { closeList(); }
    else { closeList(); html += `<p>${inlineMd(line)}</p>`; }
  }
  closeList();
  return html;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { mdToHtml };
}
